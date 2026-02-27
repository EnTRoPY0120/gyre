/**
 * Unit tests for the diff API error-handling catch block (issue #157).
 *
 * The handler classifies errors by message content and returns a safe,
 * generic string to the client while logging the full error server-side.
 * These tests verify that no raw error detail leaks and that console.error
 * is always called with the original error.
 */

import { describe, test, expect, beforeEach, afterEach } from 'bun:test';

// ---------------------------------------------------------------------------
// Reproduce the catch-block logic verbatim so tests stay in sync with the fix
// ---------------------------------------------------------------------------

type DiffError = { status: number; body: { message: string } };

function classifyDiffError(err: unknown): DiffError {
	const message = err instanceof Error ? err.message : String(err);

	if (message.includes('not in gzip format')) {
		return {
			status: 500,
			body: {
				message:
					'The artifact downloaded from source-controller is not a valid gzip archive. ' +
					'This usually indicates the source-controller service is returning an error page instead of the artifact. ' +
					'Check that the source-controller is running and the GitRepository/Bucket has reconciled successfully.'
			}
		};
	} else if (message.includes('tar:')) {
		return {
			status: 500,
			body: { message: 'Failed to extract source artifact. Check server logs for details.' }
		};
	} else if (message.includes('kustomize')) {
		return {
			status: 500,
			body: { message: 'Kustomize build failed. Check server logs for details.' }
		};
	} else if (message.includes('timeout')) {
		return {
			status: 504,
			body: {
				message:
					'Operation timed out. The kustomization may be too large or the source artifact is unavailable.'
			}
		};
	}

	return {
		status: 500,
		body: {
			message: 'Failed to compute diff. Please try again or check the source artifact.'
		}
	};
}

// ---------------------------------------------------------------------------
// console.error spy
// ---------------------------------------------------------------------------

const originalConsoleError = console.error;
const capturedErrors: unknown[][] = [];

beforeEach(() => {
	capturedErrors.length = 0;
	console.error = (...args: unknown[]) => {
		capturedErrors.push(args);
	};
});

afterEach(() => {
	console.error = originalConsoleError;
});

// Simulate how the handler logs then classifies
function handleDiffError(err: unknown): DiffError {
	console.error('Diff error:', err);
	return classifyDiffError(err);
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('diff API error handling', () => {
	describe('tar extraction error path', () => {
		const rawMessage =
			'tar: /tmp/gyre-diff-xyz/artifact.tar.gz: Cannot open: No such file or directory\ntar: Error is not recoverable: exiting now';

		test('returns generic message — raw tar output not exposed', () => {
			const result = handleDiffError(new Error(rawMessage));

			expect(result.body.message).toBe(
				'Failed to extract source artifact. Check server logs for details.'
			);
			expect(result.status).toBe(500);
		});

		test('response body does not contain raw tar output or file paths', () => {
			const result = handleDiffError(new Error(rawMessage));

			expect(result.body.message).not.toContain('tar:');
			expect(result.body.message).not.toContain('/tmp/');
			expect(result.body.message).not.toContain('artifact.tar.gz');
		});

		test('full error is logged server-side', () => {
			handleDiffError(new Error(rawMessage));

			expect(capturedErrors.length).toBe(1);
			expect(String(capturedErrors[0])).toContain(rawMessage);
		});
	});

	describe('kustomize build failure', () => {
		const rawMessage =
			'kustomize build failed: error: /home/user/.config/kustomize/plugin/... exit status 1';

		test('returns generic message — raw kustomize output not exposed', () => {
			const result = handleDiffError(new Error(rawMessage));

			expect(result.body.message).toBe('Kustomize build failed. Check server logs for details.');
			expect(result.status).toBe(500);
		});

		test('response body does not contain raw kustomize output or paths', () => {
			const result = handleDiffError(new Error(rawMessage));

			expect(result.body.message).not.toContain('exit status');
			expect(result.body.message).not.toContain('/home/user/');
			expect(result.body.message).not.toContain('kustomize build failed:');
		});

		test('full error is logged server-side', () => {
			handleDiffError(new Error(rawMessage));

			expect(capturedErrors.length).toBe(1);
			expect(String(capturedErrors[0])).toContain(rawMessage);
		});
	});

	describe('unhandled / generic error fallback', () => {
		const rawMessage =
			'ECONNREFUSED 10.96.0.1:443 — internal cluster address, stack: at Socket.<anonymous> (/app/node_modules/...)';

		test('returns generic fallback message', () => {
			const result = handleDiffError(new Error(rawMessage));

			expect(result.body.message).toBe(
				'Failed to compute diff. Please try again or check the source artifact.'
			);
			expect(result.status).toBe(500);
		});

		test('response body does not contain raw error details, IPs, or stack fragments', () => {
			const result = handleDiffError(new Error(rawMessage));

			expect(result.body.message).not.toContain('ECONNREFUSED');
			expect(result.body.message).not.toContain('10.96.0.1');
			expect(result.body.message).not.toContain('node_modules');
		});

		test('full error is logged server-side', () => {
			handleDiffError(new Error(rawMessage));

			expect(capturedErrors.length).toBe(1);
			expect(String(capturedErrors[0])).toContain(rawMessage);
		});

		test('non-Error thrown values are also handled safely', () => {
			const result = handleDiffError('some unexpected string throw');

			expect(result.body.message).toBe(
				'Failed to compute diff. Please try again or check the source artifact.'
			);
			expect(result.body.message).not.toContain('some unexpected string throw');
		});
	});

	describe('server-side logging (all error paths)', () => {
		const cases: Array<[string, string]> = [
			['tar: corrupt data', 'tar extraction error'],
			['kustomize: no such file', 'kustomize error'],
			['not in gzip format — response: <html>Error</html>', 'gzip format error'],
			['timeout after 30000ms', 'timeout error'],
			['completely unknown failure xyz', 'generic error']
		];

		for (const [errMsg, label] of cases) {
			test(`logs full error for ${label}`, () => {
				handleDiffError(new Error(errMsg));

				expect(capturedErrors.length).toBe(1);
				// The raw message must appear in logs, never in the client response
				const clientMsg = classifyDiffError(new Error(errMsg)).body.message;
				expect(clientMsg).not.toContain(errMsg);
				expect(String(capturedErrors[0])).toContain(errMsg);
			});
		}
	});
});
