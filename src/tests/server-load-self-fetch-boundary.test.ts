import { describe, expect, test } from 'bun:test';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

const ROUTES_DIR = join(process.cwd(), 'src', 'routes');
const SERVER_LOAD_FILE_PATTERN = /^\+(page|layout)\.server\.ts$/;
const DISALLOWED_SELF_FETCH_PATTERNS = [
	"fetch('/api/",
	'fetch("/api/',
	"event.fetch('/api/",
	'event.fetch("/api/'
];

function collectServerLoadFiles(dir: string): string[] {
	const files: string[] = [];

	for (const entry of readdirSync(dir)) {
		const fullPath = join(dir, entry);
		const stats = statSync(fullPath);
		if (stats.isDirectory()) {
			files.push(...collectServerLoadFiles(fullPath));
			continue;
		}
		if (SERVER_LOAD_FILE_PATTERN.test(entry)) {
			files.push(fullPath);
		}
	}

	return files;
}

describe('server load self-fetch boundary', () => {
	test('server loads do not fetch internal API routes over HTTP', () => {
		const offendingFiles = collectServerLoadFiles(ROUTES_DIR).flatMap((filePath) => {
			const source = readFileSync(filePath, 'utf8');
			const matches = DISALLOWED_SELF_FETCH_PATTERNS.filter((pattern) => source.includes(pattern));
			return matches.length > 0 ? [`${filePath}: ${matches.join(', ')}`] : [];
		});

		expect(offendingFiles).toEqual([]);
	});
});
