import { describe, expect, test } from 'vitest';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const TEST_DIR = dirname(fileURLToPath(import.meta.url));

function readRepoFile(relativePath: string): string {
	return readFileSync(resolve(TEST_DIR, '..', relativePath), 'utf8');
}

describe('helm chart regressions', () => {
	test('clusterrole includes Flux image automation resources and read-only status rules', () => {
		const source = readRepoFile('../charts/gyre/templates/clusterrole.yaml');

		expect(source).toContain('apiGroups: ["image.toolkit.fluxcd.io"]');
		expect(source).toContain('- imagerepositories');
		expect(source).toContain('- imagepolicies');
		expect(source).toContain('- imageupdateautomations');
		expect(source).toContain('- imagerepositories/status');
		expect(source).toContain('- imagepolicies/status');
		expect(source).toContain('- imageupdateautomations/status');
		expect(source).toContain('verbs: ["get", "list", "watch"]');
	});

	test('role includes encryption.existingSecret alongside generated secret access', () => {
		const source = readRepoFile('../charts/gyre/templates/role.yaml');

		expect(source).toContain('.Values.encryption.existingSecret');
		expect(source).toContain('$generatedEncryptionSecretName');
		expect(source).toContain('uniq $secretNames');
	});

	test('admin secret reuses existing passwords with lookup and is no longer kept across uninstalls', () => {
		const source = readRepoFile('../charts/gyre/templates/secret-admin.yaml');

		expect(source).toContain('lookup "v1" "Secret" .Release.Namespace .Values.admin.secretName');
		expect(source).toContain('b64dec');
		expect(source).not.toContain('helm.sh/resource-policy');
		expect(source).not.toContain('helm.sh/hook');
	});

	test('deployment uses shared provider-name sanitization and origin override support', () => {
		const source = readRepoFile('../charts/gyre/templates/deployment.yaml');

		expect(source).toContain('.Values.origin');
		expect(source).toContain('.Values.gatewayApi.tls');
		expect(source).toContain(
			'auth.providersExistingSecret is required when auth.providers is non-empty'
		);
		expect(source).toContain('contains forbidden field clientSecret');
		expect(source).toContain('{{- $seen := dict }}');
		expect(source).toContain('regexReplaceAll "[^A-Z0-9]" ($provider.name | upper) "_"');
		expect(source).toContain('hasKey $seen $providerKey');
		expect(source).toContain('index $seen $providerKey');
		expect(source).toContain('GYRE_AUTH_PROVIDER_{{ $providerKey }}_CLIENT_SECRET');
		expect(source).toContain('PROVIDER_{{ $providerKey }}_CLIENT_SECRET');
		expect(source).toContain('optional: false');
		expect(source).toContain('BACKUP_ENCRYPTION_KEY');
		expect(source).toContain('BETTER_AUTH_SECRET');
		expect(source).toContain('GYRE_METRICS_TOKEN');
		expect(source).toContain(
			'metrics.existingSecret is required unless metrics.autoGenerate is enabled'
		);
	});

	test('encryption and metrics secrets are generated only when absent and retained', () => {
		const encryption = readRepoFile('../charts/gyre/templates/secret-encryption.yaml');
		const metrics = readRepoFile('../charts/gyre/templates/secret-metrics.yaml');

		expect(encryption).toContain('lookup "v1" "Secret" .Release.Namespace $encryptionSecretName');
		expect(encryption).toContain('.Values.encryption.autoGenerate');
		expect(encryption).toContain('gyre.io/generated: "true"');
		expect(encryption).toContain('helm.sh/resource-policy: keep');
		expect(encryption).toContain('randAlphaNum 64 | sha256sum');
		expect(encryption).toContain('Generated encryption Secret');

		expect(metrics).toContain('lookup "v1" "Secret" .Release.Namespace $metricsSecretName');
		expect(metrics).toContain('.Values.metrics.autoGenerate');
		expect(metrics).toContain('gyre.io/generated: "true"');
		expect(metrics).toContain('helm.sh/resource-policy: keep');
		expect(metrics).toContain('GYRE_METRICS_TOKEN: {{ randAlphaNum 64 | b64enc | quote }}');
	});

	test('values and templates include deployability defaults for service account and body size limit', () => {
		const values = readRepoFile('../charts/gyre/values.yaml');
		const configMap = readRepoFile('../charts/gyre/templates/configmap.yaml');
		const deployment = readRepoFile('../charts/gyre/templates/deployment.yaml');

		expect(values).toContain('automount: true');
		expect(values).toContain('bodySizeLimit: 500M');
		expect(configMap).toContain('BODY_SIZE_LIMIT: {{ .Values.config.bodySizeLimit | quote }}');
		expect(deployment).toContain('- name: BODY_SIZE_LIMIT');
		expect(deployment).toContain('key: BODY_SIZE_LIMIT');
		expect(deployment).toContain('$reservedAdditionalConfig');
		expect(deployment).toContain('config.additionalConfig.%s is reserved');
		expect(deployment).toContain('^GYRE_AUTH_PROVIDER_.*_CLIENT_SECRET$');
		expect(deployment).toContain('"BETTER_AUTH_SECRET"');
	});

	test('values schema includes origin, gatewayApi.tls, and networkPolicy.egress.apiServer', () => {
		const schema = JSON.parse(readRepoFile('../charts/gyre/values.schema.json'));

		expect(schema.properties.origin.anyOf).toBeDefined();
		expect(schema.properties.origin.anyOf[0].const).toBe('');
		expect(schema.properties.origin.anyOf[1].pattern).toBe('^https?://\\S+$');
		expect(schema.properties.gatewayApi.properties.tls.type).toBe('boolean');
		expect(schema.properties.networkPolicy.properties.egress.properties.apiServer).toBeDefined();
		expect(
			schema.properties.networkPolicy.properties.egress.properties.apiServer.properties.ipBlocks
				.items.type
		).toBe('string');
		expect(
			schema.properties.networkPolicy.properties.egress.properties.apiServer.properties.ports.items
				.type
		).toBe('integer');
		expect(schema.properties.config.properties.bodySizeLimit.type).toBe('string');
		expect(schema.properties.config.properties.bodySizeLimit.pattern).toBe(
			'^(?:[0-9]+(?:[KMG])?|Infinity)$'
		);
		expect(schema.properties.encryption.properties.backupKey.type).toBe('string');
		expect(schema.properties.encryption.properties.betterAuthSecret.type).toBe('string');
		expect(schema.properties.encryption.properties.autoGenerate.type).toBe('boolean');
		expect(schema.properties.encryption.then.properties.backupKey.pattern).toBe(
			'^[0-9a-fA-F]{64}$'
		);
		expect(schema.properties.encryption.then.properties.betterAuthSecret.minLength).toBe(32);
		expect(schema.properties.encryption.then.required).toContain('betterAuthSecret');
		expect(schema.properties.auth.properties.providers.items.additionalProperties).toBe(false);
		expect(schema.properties.auth.then.required).toContain('providersExistingSecret');
		expect(schema.properties.metrics.properties.existingSecret.type).toBe('string');
		expect(schema.properties.metrics.properties.autoGenerate.type).toBe('boolean');
		expect(
			schema.properties.auth.properties.providers.items.properties.clientSecret
		).toBeUndefined();
	});

	test('inline encryption secret template includes BACKUP_ENCRYPTION_KEY and BETTER_AUTH_SECRET', () => {
		const source = readRepoFile('../charts/gyre/templates/secret-encryption.yaml');
		expect(source).toContain('BACKUP_ENCRYPTION_KEY');
		expect(source).toContain('.Values.encryption.backupKey');
		expect(source).toContain('BETTER_AUTH_SECRET');
		expect(source).toContain('.Values.encryption.betterAuthSecret');
	});
});
