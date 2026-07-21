const CLEAN_EXIF_FLAG = "--clean-exif";

// Everything after --clean-exif is a file path from Send To / drag-onto-shortcut.
// Nothing else trails it on the command line, so no further filtering is needed.
export function parseCleanExifFilePaths(argv: string[]): string[] {
	const flagIndex = argv.indexOf(CLEAN_EXIF_FLAG);
	if (flagIndex === -1) {
		return [];
	}
	return argv.slice(flagIndex + 1);
}
