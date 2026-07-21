import { BrowserWindow, app } from "electron";
import { setupMenus } from "./menu/menu";
import { init } from "./init";
import { createMainWindow, setupMainWindow } from "./window/window_setup";
import { currentBrowserWindow } from "../infrastructure";
import { isWindows, IPC_CHANNELS } from "../common";
import { setupSendToShortcut } from "./clean_exif_send_to";
import { parseCleanExifFilePaths } from "./clean_exif_launch_args";

// Maintain reference to window to
// prevent it from being garbage collected
let browserWindow: BrowserWindow | null = null;

// Registered before setupMainWindow() loads the renderer, since ready-to-show
// can fire during loadFile in packaged builds (window_setup.ts does the same).
function sendCleanExifFilesOnReady(window: BrowserWindow): void {
	if (!isWindows()) {
		return;
	}
	const cleanExifPaths = parseCleanExifFilePaths(process.argv);
	if (cleanExifPaths.length === 0) {
		return;
	}
	window.once("ready-to-show", () => {
		window.webContents.send(IPC_CHANNELS.FILE_OPEN_ADD_FILES, cleanExifPaths);
	});
}

async function createAndShowWindow(): Promise<void> {
	browserWindow = createMainWindow();
	sendCleanExifFilesOnReady(browserWindow);
	await init({ browserWindow });
	setupMenus();
	setupMainWindow(browserWindow);
}

async function setup(): Promise<void> {
	await app.whenReady();

	setupSendToShortcut();

	// keep reference to main window to prevent losing it on GC
	browserWindow = currentBrowserWindow({ browserWindow });
	if (!browserWindow) {
		await createAndShowWindow();
	}

	// macOS: re-create window when dock icon clicked and all windows are closed
	app.on("activate", async () => {
		if (BrowserWindow.getAllWindows().length === 0) {
			await createAndShowWindow();
		}
	});
}

setup();
