import { expect } from 'bun:test';

export async function expectOAuthErrorCode(promise: Promise<unknown>, code: string) {
	try {
		await promise;
		throw new Error(`Expected rejection with OAuthError code ${code}`);
	} catch (error) {
		expect((error as { name?: string }).name).toBe('OAuthError');
		expect((error as { code?: string }).code).toBe(code);
	}
}
