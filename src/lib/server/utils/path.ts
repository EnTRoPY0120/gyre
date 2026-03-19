import { resolve } from 'node:path';

/**
 * Validates that a path does not contain raw traversal sequences.
 * This should be checked BEFORE normalization.
 */
export function validateSafePath(inputPath: string): void {
	if (inputPath.includes('..')) {
		throw new Error(`Path traversal detected: ${inputPath}`);
	}
}

/**
 * Validates that a path is safe from traversal and ultimately resolves 
 * within the expected directory tree.
 */
export function validateSafePathPrefix(inputPath: string, expectedPrefix: string): void {
	validateSafePath(inputPath);
	const resolvedPath = resolve(inputPath);
	const resolvedPrefix = resolve(expectedPrefix);
	
	if (!resolvedPath.startsWith(resolvedPrefix)) {
		throw new Error(`Path breaks out of expected directory bounds: ${inputPath}`);
	}
}
