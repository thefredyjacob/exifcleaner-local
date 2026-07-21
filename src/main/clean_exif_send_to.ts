import { app, shell } from "electron";
import { existsSync } from "node:fs";
import path from "node:path";
import { isWindows, logError } from "../common";

const SHORTCUT_NAME = "Clean EXIF.lnk";
const CLEAN_EXIF_ARGS = "--clean-exif";

export interface ShellShortcutPort {
	writeShortcutLink(
		shortcutPath: string,
		operation: "create",
		options: {
			target: string;
			args: string;
			description: string;
			icon: string;
			iconIndex: number;
		},
	): boolean;
	// Throws on a corrupt or inaccessible .lnk — callers treat that as "stale, rewrite it"
	readShortcutLink(shortcutPath: string): { target: string };
}

interface RegisterSendToShortcutParams {
	shell: ShellShortcutPort;
	existsSync: (filePath: string) => boolean;
	shortcutPath: string;
	execPath: string;
}

function shortcutIsCurrent({
	shell,
	existsSync,
	shortcutPath,
	execPath,
}: RegisterSendToShortcutParams): boolean {
	if (!existsSync(shortcutPath)) {
		return false;
	}
	// Safe: existsSync confirmed the file is present, readShortcutLink only
	// throws for a malformed .lnk (not our concern — treat as stale and rewrite)
	try {
		return shell.readShortcutLink(shortcutPath).target === execPath;
	} catch {
		return false;
	}
}

// Takes injected deps instead of reading electron/node globals directly,
// matching this codebase's fake-based test convention (D-34).
export function registerSendToShortcut(
	params: RegisterSendToShortcutParams,
): void {
	if (shortcutIsCurrent(params)) {
		return;
	}

	const succeeded = params.shell.writeShortcutLink(
		params.shortcutPath,
		"create",
		{
			target: params.execPath,
			args: CLEAN_EXIF_ARGS,
			description: "Strip EXIF/metadata with ExifCleaner",
			icon: params.execPath,
			iconIndex: 0,
		},
	);

	// Best-effort: Send To registration failing (e.g. permission denied,
	// disk full) should never block app startup — log and move on.
	if (!succeeded) {
		logError(
			"clean-exif-send-to",
			new Error(`writeShortcutLink failed for ${params.shortcutPath}`),
		);
	}
}

export function setupSendToShortcut(): void {
	if (!isWindows()) {
		return;
	}

	registerSendToShortcut({
		shell,
		existsSync,
		shortcutPath: path.join(
			app.getPath("appData"),
			"Microsoft",
			"Windows",
			"SendTo",
			SHORTCUT_NAME,
		),
		execPath: process.execPath,
	});
}
