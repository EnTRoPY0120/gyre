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

export function createSettingsModuleStub(
	overrides: Partial<{
		SETTINGS_KEYS: {
			AUTH_LOCAL_LOGIN_ENABLED: string;
			AUTH_ALLOW_SIGNUP: string;
			AUTH_DOMAIN_ALLOWLIST: string;
			AUDIT_LOG_RETENTION_DAYS: string;
		};
		getSetting: (key: string) => string | Promise<string>;
		setSetting: (key: string, value: string) => void | Promise<void>;
		getAuthSettings: () =>
			| {
					localLoginEnabled: boolean;
					allowSignup: boolean;
					domainAllowlist: string[];
			  }
			| Promise<{
					localLoginEnabled: boolean;
					allowSignup: boolean;
					domainAllowlist: string[];
			  }>;
		getAuditLogRetentionDays: () => number | Promise<number>;
		isSettingOverriddenByEnv: (key: string) => boolean;
		seedAuthSettings: () => void | Promise<void>;
		isLocalLoginEnabled: () => boolean | Promise<boolean>;
		isSignupAllowed: () => boolean | Promise<boolean>;
		getDomainAllowlist: () => string[] | Promise<string[]>;
	}> = {}
) {
	const SETTINGS_KEYS = {
		AUTH_LOCAL_LOGIN_ENABLED: 'auth.localLoginEnabled',
		AUTH_ALLOW_SIGNUP: 'auth.allowSignup',
		AUTH_DOMAIN_ALLOWLIST: 'auth.domainAllowlist',
		AUDIT_LOG_RETENTION_DAYS: 'audit.retentionDays'
	};

	const stub = {
		SETTINGS_KEYS,
		getSetting: async (key: string) => {
			if (key === SETTINGS_KEYS.AUTH_LOCAL_LOGIN_ENABLED) return 'true';
			if (key === SETTINGS_KEYS.AUTH_ALLOW_SIGNUP) return 'true';
			if (key === SETTINGS_KEYS.AUTH_DOMAIN_ALLOWLIST) return '[]';
			if (key === SETTINGS_KEYS.AUDIT_LOG_RETENTION_DAYS) return '90';
			return '';
		},
		setSetting: async () => {},
		getAuthSettings: async () => ({
			localLoginEnabled: true,
			allowSignup: true,
			domainAllowlist: []
		}),
		getAuditLogRetentionDays: async () => 90,
		isSettingOverriddenByEnv: () => false,
		seedAuthSettings: async () => {},
		isLocalLoginEnabled: async () => true,
		isSignupAllowed: async () => true,
		getDomainAllowlist: async () => []
	};

	return { ...stub, ...overrides };
}

export function createKubernetesErrorsModuleStub(
	overrides: Partial<{
		KubernetesError: typeof Error;
		ResourceNotFoundError: typeof Error;
		AuthenticationError: typeof Error;
		AuthorizationError: typeof Error;
		ClusterUnavailableError: typeof Error;
		KubernetesTimeoutError: typeof Error;
		ConfigurationError: typeof Error;
		sanitizeK8sErrorMessage: (message: string) => string;
		handleApiError: (err: unknown, contextMessage?: string) => never;
		errorToHttpResponse: (error: unknown) => {
			status: number;
			body: { error: string; message?: string; code?: string };
		};
	}> = {}
) {
	class StubKubernetesError extends Error {
		constructor(
			message: string,
			public readonly code: number,
			public readonly reason?: string
		) {
			super(message);
			this.name = 'KubernetesError';
		}
	}

	class StubResourceNotFoundError extends StubKubernetesError {
		constructor(resourceType: string, namespace?: string, name?: string) {
			const identifier =
				namespace && name ? `${namespace}/${name}` : namespace || name || 'resources';
			super(`${resourceType} not found: ${identifier}`, 404, 'NotFound');
			this.name = 'ResourceNotFoundError';
		}
	}

	class StubAuthenticationError extends StubKubernetesError {
		constructor(message = 'Failed to authenticate with Kubernetes API') {
			super(message, 401, 'Unauthorized');
			this.name = 'AuthenticationError';
		}
	}

	class StubAuthorizationError extends StubKubernetesError {
		constructor(message = 'Insufficient permissions to access resource') {
			super(message, 403, 'Forbidden');
			this.name = 'AuthorizationError';
		}
	}

	class StubClusterUnavailableError extends StubKubernetesError {
		constructor(message = 'Kubernetes cluster is currently unavailable') {
			super(message, 503, 'ServiceUnavailable');
			this.name = 'ClusterUnavailableError';
		}
	}

	class StubKubernetesTimeoutError extends StubKubernetesError {
		constructor(operation: string, timeoutMs: number) {
			super(
				`Kubernetes API request timed out after ${timeoutMs}ms: ${operation}`,
				504,
				'GatewayTimeout'
			);
			this.name = 'KubernetesTimeoutError';
		}
	}

	class StubConfigurationError extends Error {
		constructor(message: string) {
			super(message);
			this.name = 'ConfigurationError';
		}
	}

	const stub = {
		KubernetesError: StubKubernetesError,
		ResourceNotFoundError: StubResourceNotFoundError,
		AuthenticationError: StubAuthenticationError,
		AuthorizationError: StubAuthorizationError,
		ClusterUnavailableError: StubClusterUnavailableError,
		KubernetesTimeoutError: StubKubernetesTimeoutError,
		ConfigurationError: StubConfigurationError,
		sanitizeK8sErrorMessage: (message: string) => message || 'An unknown error occurred',
		handleApiError: (err: unknown) => {
			throw err;
		},
		errorToHttpResponse: (error: unknown) => {
			if (
				typeof error === 'object' &&
				error !== null &&
				'status' in error &&
				'body' in error &&
				typeof (error as { status: unknown }).status === 'number'
			) {
				const httpError = error as { status: number; body: { message?: string; code?: string } };
				return {
					status: httpError.status,
					body: {
						error: httpError.body?.message ?? 'An unexpected error occurred',
						message: httpError.body?.message,
						code: httpError.body?.code
					}
				};
			}

			if (error instanceof StubConfigurationError) {
				return {
					status: 500,
					body: {
						error: 'Configuration error',
						code: 'ConfigurationError'
					}
				};
			}

			if (error instanceof StubKubernetesError) {
				return {
					status: error.code,
					body: {
						error: error.message,
						code: error.reason
					}
				};
			}

			return {
				status: 500,
				body: {
					error: 'An unexpected error occurred',
					code: 'InternalServerError'
				}
			};
		}
	};

	return { ...stub, ...overrides };
}
