import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadAll } from 'js-yaml';
import { describe, expect, test } from 'vitest';

const TEST_DIR = dirname(fileURLToPath(import.meta.url));
const CHART_DIR = resolve(TEST_DIR, '../../charts/gyre');

interface EnvironmentVariable {
	name: string;
	value?: string;
	valueFrom?: {
		configMapKeyRef?: { name: string; key: string };
		secretKeyRef?: { name: string; key: string; optional?: boolean };
	};
}

interface RenderedManifest {
	kind?: string;
	metadata?: { name?: string; annotations?: Record<string, string> };
	data?: Record<string, string>;
	stringData?: Record<string, string>;
	rules?: Array<{
		apiGroups?: string[];
		resources?: string[];
		verbs?: string[];
		resourceNames?: string[];
	}>;
	spec?: {
		template?: {
			spec?: { containers?: Array<{ env?: EnvironmentVariable[] }> };
		};
	};
}

function renderChart(overrides: string[] = []): RenderedManifest[] {
	const args = ['template', 'gyre', CHART_DIR, '--namespace', 'gyre'];
	for (const override of overrides) args.push('--set', override);

	const output = execFileSync('helm', args, { encoding: 'utf8' });
	return loadAll(output).filter((document): document is RenderedManifest => {
		return document !== null && typeof document === 'object';
	});
}

function findManifest(manifests: RenderedManifest[], kind: string, name?: string) {
	const manifest = manifests.find(
		(candidate) =>
			candidate.kind === kind && (name === undefined || candidate.metadata?.name === name)
	);
	expect(manifest, `Expected rendered ${kind}${name ? ` ${name}` : ''}`).toBeDefined();
	return manifest!;
}

function getContainerEnv(manifests: RenderedManifest[]): EnvironmentVariable[] {
	const deployment = findManifest(manifests, 'Deployment', 'gyre');
	const env = deployment.spec?.template?.spec?.containers?.[0]?.env;
	expect(env, 'Expected rendered deployment container environment').toBeDefined();
	return env!;
}

function readTemplate(relativePath: string): string {
	return readFileSync(resolve(CHART_DIR, relativePath), 'utf8');
}

function expectTemplateFailure(overrides: string[], message: string): void {
	try {
		renderChart(overrides);
	} catch (error) {
		const detail = error as Error & { stderr?: Buffer | string };
		const output = `${detail.message}\n${detail.stderr?.toString() ?? ''}`;
		expect(output).toContain(message);
		return;
	}

	throw new Error(`Expected helm template to fail with: ${message}`);
}

describe('Helm chart rendered regressions', () => {
	test('default values render core configuration, Flux read access, and generated secrets', () => {
		const manifests = renderChart();
		const configMap = findManifest(manifests, 'ConfigMap', 'gyre-config');
		const clusterRole = findManifest(manifests, 'ClusterRole', 'gyre');
		const adminSecret = findManifest(manifests, 'Secret', 'gyre-initial-admin-secret');
		const encryptionSecret = findManifest(manifests, 'Secret', 'gyre-encryption');
		const metricsSecret = findManifest(manifests, 'Secret', 'gyre-metrics');
		const env = getContainerEnv(manifests);

		expect(configMap.data).toMatchObject({
			BODY_SIZE_LIMIT: '500M',
			GYRE_POLL_INTERVAL_MS: '5000'
		});
		expect(clusterRole.rules).toContainEqual(
			expect.objectContaining({
				apiGroups: ['image.toolkit.fluxcd.io'],
				resources: expect.arrayContaining([
					'imagerepositories/status',
					'imagepolicies/status',
					'imageupdateautomations/status'
				]),
				verbs: ['get', 'list', 'watch']
			})
		);
		expect(adminSecret.stringData?.password).toBeTruthy();
		expect(adminSecret.metadata?.annotations?.['helm.sh/resource-policy']).toBeUndefined();
		expect(adminSecret.metadata?.annotations?.['helm.sh/hook']).toBeUndefined();
		expect(encryptionSecret.metadata?.annotations?.['helm.sh/resource-policy']).toBe('keep');
		expect(encryptionSecret.data).toEqual(
			expect.objectContaining({
				GYRE_ENCRYPTION_KEY: expect.any(String),
				AUTH_ENCRYPTION_KEY: expect.any(String),
				BACKUP_ENCRYPTION_KEY: expect.any(String),
				BETTER_AUTH_SECRET: expect.any(String)
			})
		);
		expect(metricsSecret.metadata?.annotations?.['helm.sh/resource-policy']).toBe('keep');
		expect(metricsSecret.data?.GYRE_METRICS_TOKEN).toBeTruthy();
		expect(
			env.find((entry) => entry.name === 'GYRE_ENCRYPTION_KEY')?.valueFrom?.secretKeyRef
		).toEqual({ name: 'gyre-encryption', key: 'GYRE_ENCRYPTION_KEY', optional: false });
		expect(
			env.find((entry) => entry.name === 'GYRE_METRICS_TOKEN')?.valueFrom?.secretKeyRef
		).toEqual({ name: 'gyre-metrics', key: 'GYRE_METRICS_TOKEN', optional: false });
	});

	test('external secrets and custom admin secret names are wired into rendered resources', () => {
		const manifests = renderChart([
			'encryption.existingSecret=external-encryption',
			'encryption.autoGenerate=false',
			'metrics.existingSecret=external-metrics',
			'metrics.autoGenerate=false',
			'admin.secretName=custom-admin-secret'
		]);
		const role = findManifest(manifests, 'Role', 'gyre-secrets');
		const env = getContainerEnv(manifests);

		expect(env.find((entry) => entry.name === 'GYRE_ADMIN_SECRET_NAME')?.value).toBe(
			'custom-admin-secret'
		);
		expect(
			findManifest(manifests, 'Secret', 'custom-admin-secret').stringData?.password
		).toBeTruthy();
		expect(
			manifests.some(
				(manifest) =>
					manifest.kind === 'Secret' &&
					['external-encryption', 'external-metrics'].includes(manifest.metadata?.name ?? '')
			)
		).toBe(false);
		expect(role.rules?.flatMap((rule) => rule.resourceNames ?? [])).toEqual(
			expect.arrayContaining(['custom-admin-secret', 'gyre-encryption', 'external-encryption'])
		);
		expect(
			env.find((entry) => entry.name === 'GYRE_ENCRYPTION_KEY')?.valueFrom?.secretKeyRef?.name
		).toBe('external-encryption');
		expect(
			env.find((entry) => entry.name === 'GYRE_METRICS_TOKEN')?.valueFrom?.secretKeyRef?.name
		).toBe('external-metrics');
	});

	test('config.create=false omits the ConfigMap and its environment references', () => {
		const manifests = renderChart(['config.create=false', 'admin.secretName=custom-admin-secret']);
		const env = getContainerEnv(manifests);

		expect(env.find((entry) => entry.name === 'GYRE_ADMIN_SECRET_NAME')?.value).toBe(
			'custom-admin-secret'
		);
		expect(manifests.some((manifest) => manifest.kind === 'ConfigMap')).toBe(false);
		expect(env.some((entry) => entry.valueFrom?.configMapKeyRef !== undefined)).toBe(false);
	});

	test.each([
		[
			['config.additionalConfig.GYRE_ADMIN_SECRET_NAME=shadow-admin'],
			'GYRE_ADMIN_SECRET_NAME is reserved'
		],
		[
			['config.additionalConfig.BETTER_AUTH_SECRET=shadow-secret'],
			'BETTER_AUTH_SECRET is reserved'
		],
		[['config.additionalConfig.GYRE_AUTH_PROVIDER_SSO_CLIENT_SECRET=secret'], 'is reserved'],
		[['encryption.allowInline=true', 'encryption.gyreKey=invalid'], 'encryption'],
		[
			['metrics.existingSecret=', 'metrics.autoGenerate=false'],
			'metrics.existingSecret is required'
		],
		[
			[
				'auth.providers[0].name=sso',
				'auth.providers[0].type=oidc',
				'auth.providers[0].clientId=client'
			],
			'providersExistingSecret'
		],
		[
			[
				'auth.providersExistingSecret=oauth',
				'auth.providers[0].name=sso',
				'auth.providers[0].type=oidc',
				'auth.providers[0].clientId=client',
				'auth.providers[0].clientSecret=inline-secret'
			],
			'clientSecret'
		],
		[
			[
				'auth.providersExistingSecret=oauth',
				'auth.providers[0].name=enterprise-sso',
				'auth.providers[0].type=oidc',
				'auth.providers[0].clientId=client',
				'auth.providers[1].name=enterprise.sso',
				'auth.providers[1].type=oidc',
				'auth.providers[1].clientId=client'
			],
			'collides'
		]
	] as const)('rejects unsafe chart configuration %j', (overrides, message) => {
		expectTemplateFailure([...overrides], message);
	});

	test('provider credentials come from sanitized Secret keys and preserve the configured origin', () => {
		const env = getContainerEnv(
			renderChart([
				'origin=https://gyre.example.com',
				'auth.providersExistingSecret=oauth',
				'auth.providers[0].name=enterprise-sso',
				'auth.providers[0].type=oidc',
				'auth.providers[0].clientId=client'
			])
		);
		expect(env.find((entry) => entry.name === 'ORIGIN')?.value).toBe('https://gyre.example.com');
		expect(
			env.find((entry) => entry.name === 'GYRE_AUTH_PROVIDER_ENTERPRISE_SSO_CLIENT_SECRET')
				?.valueFrom?.secretKeyRef
		).toEqual({
			name: 'oauth',
			key: 'PROVIDER_ENTERPRISE_SSO_CLIENT_SECRET',
			optional: false
		});
		const providers = JSON.parse(env.find((entry) => entry.name === 'GYRE_AUTH_PROVIDERS')!.value!);
		expect(providers).toEqual([{ name: 'enterprise-sso', type: 'oidc', clientId: 'client' }]);
	});

	test('generated Secret templates look up existing Secret names before rendering replacements', () => {
		expect(readTemplate('templates/secret-admin.yaml')).toContain(
			'lookup "v1" "Secret" .Release.Namespace .Values.admin.secretName'
		);
		expect(readTemplate('templates/secret-encryption.yaml')).toContain(
			'lookup "v1" "Secret" .Release.Namespace $encryptionSecretName'
		);
		expect(readTemplate('templates/secret-metrics.yaml')).toContain(
			'lookup "v1" "Secret" .Release.Namespace $metricsSecretName'
		);
	});
});
