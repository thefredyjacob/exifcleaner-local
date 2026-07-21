import { describe, it, expect } from "vitest";
import { registerSendToShortcut } from "../../src/main/clean_exif_send_to";
import type { ShellShortcutPort } from "../../src/main/clean_exif_send_to";

const SHORTCUT_PATH =
	"C:\\Users\\fake\\AppData\\Roaming\\SendTo\\Clean EXIF.lnk";
const EXEC_PATH = "C:\\Program Files\\ExifCleaner\\ExifCleaner.exe";

interface FakeShell extends ShellShortcutPort {
	writeCalls: Array<{ path: string; target: string }>;
}

function createFakeShell(
	existingTarget: string | null,
	writeSucceeds = true,
): FakeShell {
	return {
		writeCalls: [],
		writeShortcutLink(shortcutPath, _operation, options) {
			this.writeCalls.push({ path: shortcutPath, target: options.target });
			return writeSucceeds;
		},
		readShortcutLink() {
			if (existingTarget === null) {
				throw new Error("no such shortcut");
			}
			return { target: existingTarget };
		},
	};
}

describe("registerSendToShortcut", () => {
	it("creates the shortcut when none exists", () => {
		const shell = createFakeShell(null);

		registerSendToShortcut({
			shell,
			existsSync: () => false,
			shortcutPath: SHORTCUT_PATH,
			execPath: EXEC_PATH,
		});

		expect(shell.writeCalls).toEqual([
			{ path: SHORTCUT_PATH, target: EXEC_PATH },
		]);
	});

	it("skips writing when shortcut already targets the current exe", () => {
		const shell = createFakeShell(EXEC_PATH);

		registerSendToShortcut({
			shell,
			existsSync: () => true,
			shortcutPath: SHORTCUT_PATH,
			execPath: EXEC_PATH,
		});

		expect(shell.writeCalls).toEqual([]);
	});

	it("recreates the shortcut when its target is stale", () => {
		const shell = createFakeShell("C:\\OldInstallPath\\ExifCleaner.exe");

		registerSendToShortcut({
			shell,
			existsSync: () => true,
			shortcutPath: SHORTCUT_PATH,
			execPath: EXEC_PATH,
		});

		expect(shell.writeCalls).toEqual([
			{ path: SHORTCUT_PATH, target: EXEC_PATH },
		]);
	});

	it("recreates the shortcut when it exists but is unreadable/corrupt", () => {
		const shell = createFakeShell(null);

		registerSendToShortcut({
			shell,
			existsSync: () => true,
			shortcutPath: SHORTCUT_PATH,
			execPath: EXEC_PATH,
		});

		expect(shell.writeCalls).toEqual([
			{ path: SHORTCUT_PATH, target: EXEC_PATH },
		]);
	});

	it("logs and does not throw when writeShortcutLink fails", () => {
		const shell = createFakeShell(null, false);

		expect(() =>
			registerSendToShortcut({
				shell,
				existsSync: () => false,
				shortcutPath: SHORTCUT_PATH,
				execPath: EXEC_PATH,
			}),
		).not.toThrow();

		expect(shell.writeCalls).toEqual([
			{ path: SHORTCUT_PATH, target: EXEC_PATH },
		]);
	});
});
