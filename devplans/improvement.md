# Windows "Send To" Clean EXIF Integration

**Status: implemented, unit-tested, typechecked. Not yet manually QA'd on real Windows Explorer (see Manual QA below).**

## What this is

Right-click file(s) in Explorer → Send To → "Clean EXIF" → app launches (or focuses if already running) → files load and process automatically — same outcome as dragging files onto the app, no dialog, no extra click.

## How it works (as built)

### 1. Self-registering shortcut — `src/main/clean_exif_send_to.ts`

On every app startup (Windows only), the app checks whether a `Clean EXIF.lnk` shortcut exists in `%APPDATA%\Microsoft\Windows\SendTo\` and points at the *current* `process.execPath`. If missing or stale (pointing at an old install location), it (re)creates it via Electron's `shell.writeShortcutLink()`.

- `registerSendToShortcut(params)` — pure-ish core logic, takes injected `shell`/`existsSync`/paths so it's testable without touching the real filesystem or Electron. Exported.
- `setupSendToShortcut()` — thin wrapper supplying the real `electron.shell`, `node:fs.existsSync`, and `app.getPath("appData")`; guarded by `isWindows()`. Called once from `src/main/index.ts` `setup()`.
- Shortcut target is `--clean-exif` (static arg baked into the `.lnk`). Windows appends every file selected in Explorer as additional argv when the shortcut is invoked — identical to drag-and-drop onto a shortcut icon. This is what makes multi-select work with zero extra registry config.
- `writeShortcutLink` failures (permission denied, disk full) are logged via `logError` and swallowed — Send To registration is best-effort and must never block app startup.
- No installer, no registry, no NSIS. Works identically for NSIS-installed and portable builds, since it self-registers at runtime rather than at install time.

### 2. Argv parsing — `src/main/clean_exif_launch_args.ts`

```ts
export function parseCleanExifFilePaths(argv: string[]): string[]
```

Finds `--clean-exif` in argv, returns everything after it verbatim (no filtering — the flag is always the last static argument, Windows appends only real file paths after it, so a naive dash-prefix filter would incorrectly drop legal filenames like `-vacation.jpg`).

### 3. Wiring — two entry points, both Windows-only

- **Fresh launch** (`src/main/index.ts`, `sendCleanExifFilesOnReady`): registers a `browserWindow.once("ready-to-show", ...)` listener *before* `setupMainWindow()` loads the renderer (same ordering constraint as the existing white-flash-prevention code in `window_setup.ts`). Once the window is ready, sends parsed paths over `IPC_CHANNELS.FILE_OPEN_ADD_FILES`.
- **App already running** (`src/main/lifecycle/app_setup.ts`, `openMinimizedIfAlreadyExists`, inside the `second-instance` handler): parses the incoming instance's argv, sends the same IPC channel to the existing window, then focuses it. Checked *before* the pre-existing `--open-file` flag handling, so both code paths coexist.
- Both funnel into `IPC_CHANNELS.FILE_OPEN_ADD_FILES` — the same channel `File > Open` already uses. `DropZone.tsx` (renderer, untouched by this feature) already listens on it and calls `processFiles()` immediately. **Zero renderer or preload changes were needed.**

## Files changed

| File | Change |
|---|---|
| `src/main/clean_exif_send_to.ts` | new — shortcut registration |
| `tests/main/clean_exif_send_to.test.ts` | new — 5 tests |
| `src/main/clean_exif_launch_args.ts` | new — argv parser |
| `tests/main/clean_exif_launch_args.test.ts` | new — 5 tests |
| `src/main/index.ts` | + `setupSendToShortcut()` call, + `sendCleanExifFilesOnReady()` |
| `src/main/lifecycle/app_setup.ts` | + clean-exif branch in `second-instance` handler |

Untouched: renderer, preload, `api_types.ts`, IPC channel list, `package.json` build config. No new dependencies.

## Security considerations (carried from design, still accurate)

**Unattended write, no consent gate.** `--clean-exif` goes straight to `removeMetadata` (in-place write), no dialog. Any local process — not just Explorer's Send To — can invoke `ExifCleaner.exe --clean-exif "<path>"` and trigger silent processing; second-instance/fresh-launch argv has no origin check.

Accepted, unchanged from design:
- **Bounded blast radius** — `DropZone.tsx`'s existing `isSupportedFile` filter means this can only ever touch the ~30 supported media/document extensions.
- **Trust ceiling matches existing model** — an attacker who can invoke the exe with argv already has code execution as the current user, i.e. already has direct file access. No new access is granted, only a new trigger for an action already reachable.

Not fixed, by design: no confirmation prompt, no audit trail distinguishing "launched from Send To" vs "launched from CLI/script."

## Test coverage (automated, already green)

- `parseCleanExifFilePaths`: no flag, single path, multiple paths (multi-select), dash-prefixed filename, flag with no trailing paths — 5/5 pass.
- `registerSendToShortcut`: creates when missing, skips when target current, recreates when target stale, recreates when `.lnk` is corrupt/unreadable, logs-and-continues when write fails — 5/5 pass.
- `tsc --noEmit`: clean. `prettier --check`: clean. Full suite: 273/275 pass (2 pre-existing unrelated failures in `settings_service.test.ts`, confirmed untouched by this change).
- **Not coverable by Vitest/Playwright**: anything involving real Explorer Send To menu, real `.lnk` shell integration, real second-instance IPC across OS processes. That's what Manual QA below is for.

## Manual QA (Windows required — not yet executed)

Run in order. Each step lists exact action → expected result. Stop and report if any step fails — later steps assume earlier ones passed.

### Setup
1. `yarn packwin` — produces both NSIS installer and portable `.exe` in `dist/`.
2. Have on hand: one supported file (`.jpg`), one unsupported file (`.txt`), and at least 2 more supported files of different types (e.g. `.png`, `.pdf`) for multi-select.

### A — Shortcut self-registration
3. Install via the NSIS build (default path). Launch the app once, then close it.
4. Open `%APPDATA%\Microsoft\Windows\SendTo\` in Explorer. **Expect:** `Clean EXIF.lnk` present.
5. Right-click the `.lnk` → Properties → check "Target" field. **Expect:** points at the installed `ExifCleaner.exe` path, "Target arguments" (or full target string) includes `--clean-exif`.
6. Uninstall, then run the **portable** `.exe` directly (no install). Launch once, close.
7. Repeat step 4-5. **Expect:** shortcut now points at the portable exe's path — confirms self-registration works without an installer.

### B — Basic Send To flow (fresh launch)
8. With the app **not running**, right-click the `.jpg` file in Explorer → Send To → Clean EXIF. **Expect:** app launches, file appears in the list, processes automatically within a couple seconds — no dialog, no manual drop needed.
9. Check the file's metadata after (e.g. via `exiftool` or file Properties → Details). **Expect:** EXIF/metadata stripped, matching the same result as a normal drag-and-drop of that file.

### C — Multi-select
10. Close the app. Select 3 supported files of different types together in Explorer → right-click → Send To → Clean EXIF. **Expect:** app launches **once** (not 3 times), all 3 files appear and process. This is the step that specifically confirms Send To's "invoke once with all files" behavior, not "once per file."

### D — Unsupported file
11. Close the app. Right-click the `.txt` file → Send To → Clean EXIF. **Expect:** app launches, but the file is silently ignored (not added to the list, nothing processes) — confirms `isSupportedFile` filtering still gates correctly even without extension-scoped registration.

### E — Already-running instance (second-instance path)
12. Launch the app normally (double-click), leave it open and idle.
13. Right-click a different supported file → Send To → Clean EXIF. **Expect:** the *existing* window comes to focus (not a second window/process), the new file is added and processed, previously-processed files in the list are undisturbed.

### F — Mixed selection
14. Select the `.jpg` and `.txt` together → Send To → Clean EXIF (if Explorer even offers the item for a mixed selection — note whether it does or doesn't, that's useful data). **Expect:** if it launches, only the `.jpg` processes, `.txt` is ignored, no error/crash.

### G — Stale shortcut recovery
15. With the app installed at path A, manually edit the `.lnk`'s target (via Properties, or delete it) to simulate staleness/corruption.
16. Launch the app once. **Expect:** shortcut is silently repaired back to the correct current path (re-check via step 5's method).

### H — Uninstall behavior
17. Uninstall the app (NSIS uninstaller). **Expect:** `Clean EXIF.lnk` is left behind in SendTo (by design — no uninstall hook, see Design section). Confirm clicking it afterward fails gracefully (Explorer shows "can't find the file" or similar) — no crash, no orphaned registry state elsewhere (there is none, since this feature never touches the registry).

### Sign-off criteria
All of B, C, D, E must pass for this feature to ship. A, F, G, H are supporting/edge confirmations — note results even if not blocking.
