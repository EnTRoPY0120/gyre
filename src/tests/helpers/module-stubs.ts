import { createHash, randomBytes } from 'node:crypto';

export function createLoggerModuleStub() {
	return {
		logger: {
			debug: () => {},
			info: () => {},
			warn: () => {},
			error: () => {}
		},
		withRequestContext: async <T>(requestId: string, fn: () => T | Promise<T>) => {
			void requestId;
			return await fn();
		}
	};
}

function computeAuthTag(ivHex: string, ciphertext: string) {
	return createHash('sha256')
		.update(ivHex)
		.update(':')
		.update(ciphertext)
		.digest('hex')
		.slice(0, 32);
}

export function createAuthCryptoModuleStub(
	overrides: Partial<{
		decryptSecret: (value: string) => string;
		encryptSecret: (value: string) => string;
		generateEncryptionKey: () => string;
		isUsingDevelopmentKey: () => boolean;
		testEncryption: () => boolean;
		_resetKeyCache: () => void;
	}> = {}
) {
	const stub = {
		decryptSecret: (value: string) => {
			const parts = value.split(':');
			if (parts.length === 3) {
				const [ivHex, ciphertext, authTag] = parts;
				if (!/^[0-9a-f]{32}$/.test(ivHex) || !/^[0-9a-f]{32}$/.test(authTag)) {
					throw new Error('Invalid encrypted secret format');
				}

				if (computeAuthTag(ivHex, ciphertext) !== authTag) {
					throw new Error('Authentication failed');
				}

				return Buffer.from(ciphertext, 'base64').toString('utf8');
			}

			if (parts.length !== 1) {
				throw new Error('Invalid encrypted secret format');
			}

			if (value.includes('secret')) {
				return `decrypted_${value}`;
			}

			throw new Error('Invalid encrypted secret format');
		},
		encryptSecret: (value: string) => {
			const ivHex = randomBytes(16).toString('hex');
			const ciphertext = Buffer.from(value, 'utf8').toString('base64');
			const authTag = computeAuthTag(ivHex, ciphertext);
			return `${ivHex}:${ciphertext}:${authTag}`;
		},
		generateEncryptionKey: () => randomBytes(32).toString('hex'),
		isUsingDevelopmentKey: () => !process.env.AUTH_ENCRYPTION_KEY,
		testEncryption: () => {
			const encrypted = stub.encryptSecret('test-value');
			return stub.decryptSecret(encrypted) === 'test-value';
		},
		_resetKeyCache: () => {}
	};

	return { ...stub, ...overrides };
}

export function createRateLimiterModuleStub() {
	return {
		checkRateLimit: () => {},
		tryCheckRateLimit: () => ({ limited: false, retryAfter: 0 }),
		accountLockout: {
			check: () => ({ locked: false, retryAfter: 0 }),
			recordFailure: () => {},
			recordSuccess: () => {}
		},
		sseConnectionLimiter: {
			acquire: () => ({
				allowed: true as const,
				release: () => {}
			}),
			getConnectionCounts: () => ({ session: 0, user: 0 })
		}
	};
}

export function createRbacModuleStub(
	overrides: Partial<{
		checkPermission: (
			...args: [unknown, 'read' | 'write' | 'admin', string?, string?, string?]
		) => boolean | Promise<boolean>;
		checkClusterWideReadPermission: (...args: [unknown, string?]) => boolean | Promise<boolean>;
		requirePermission: (
			...args: [unknown, 'read' | 'write' | 'admin', string?, string?, string?]
		) => void | Promise<void>;
		isAdmin: (user: { role?: string } | null | undefined) => boolean;
		RbacError: typeof Error;
	}> = {}
) {
	class StubRbacError extends Error {
		status = 403;
		body: { message: string; code: string };

		constructor(
			message: string,
			public action: 'read' | 'write' | 'admin',
			public resourceType?: string
		) {
			super(message);
			this.name = 'RbacError';
			this.body = {
				message,
				code: 'Forbidden'
			};
		}
	}

	const stub = {
		checkPermission: async () => true,
		checkClusterWideReadPermission: async () => true,
		requirePermission: async (
			user: unknown,
			action: 'read' | 'write' | 'admin',
			resourceType?: string,
			namespace?: string,
			clusterId?: string
		) => {
			const hasPermission = await stub.checkPermission(
				user,
				action,
				resourceType,
				namespace,
				clusterId
			);
			if (!hasPermission) {
				throw new StubRbacError(
					`Permission denied: ${action} on ${resourceType || 'resource'}`,
					action,
					resourceType
				);
			}
		},
		isAdmin: (user: { role?: string } | null | undefined) => user?.role === 'admin',
		RbacError: StubRbacError
	};

	return { ...stub, ...overrides };
}
