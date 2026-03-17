/**
 * Test-only helper: XOR-encrypt a plaintext string using the same algorithm as
 * the legacy format that migrateKubeconfigs() reads from the database.
 *
 * Reads the key directly from GYRE_ENCRYPTION_KEY so it stays in sync with
 * whatever key decryptLegacyXorKubeconfig() will use during the test.
 * Must not be imported from production code.
 */
export function encryptLegacyXorKubeconfig(plaintext: string): string {
	const key = process.env.GYRE_ENCRYPTION_KEY ?? '';
	if (!key) {
		throw new Error('GYRE_ENCRYPTION_KEY must be set for tests');
	}
	const buffer = Buffer.from(plaintext, 'utf-8');
	const encrypted = Buffer.alloc(buffer.length);
	for (let i = 0; i < buffer.length; i++) {
		encrypted[i] = buffer[i] ^ key.charCodeAt(i % key.length);
	}
	return encrypted.toString('base64');
}
