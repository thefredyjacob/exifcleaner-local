import { describe, it, expect } from "vitest";
import { parseCleanExifFilePaths } from "../../src/main/clean_exif_launch_args";

describe("parseCleanExifFilePaths", () => {
	it("returns empty array when flag is absent", () => {
		const result = parseCleanExifFilePaths(["exe.exe", "--other-flag"]);
		expect(result).toEqual([]);
	});

	it("returns single path after flag", () => {
		const result = parseCleanExifFilePaths([
			"exe.exe",
			"--clean-exif",
			"C:\\photos\\a.jpg",
		]);
		expect(result).toEqual(["C:\\photos\\a.jpg"]);
	});

	it("returns multiple paths after flag (multi-select)", () => {
		const result = parseCleanExifFilePaths([
			"exe.exe",
			"--clean-exif",
			"C:\\photos\\a.jpg",
			"C:\\photos\\b.png",
		]);
		expect(result).toEqual(["C:\\photos\\a.jpg", "C:\\photos\\b.png"]);
	});

	it("does not drop a path starting with a dash", () => {
		const result = parseCleanExifFilePaths([
			"exe.exe",
			"--clean-exif",
			"C:\\photos\\-vacation.jpg",
		]);
		expect(result).toEqual(["C:\\photos\\-vacation.jpg"]);
	});

	it("returns empty array when flag is last argument", () => {
		const result = parseCleanExifFilePaths(["exe.exe", "--clean-exif"]);
		expect(result).toEqual([]);
	});
});
