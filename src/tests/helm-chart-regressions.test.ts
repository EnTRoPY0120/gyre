import { describe, expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const TEST_DIR = import.meta.dir;

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
		expect(source).toContain('{{- $seen := dict }}');
		expect(source).toContain('regexReplaceAll "[^A-Z0-9]" ($provider.name | upper) "_"');
		expect(source).toContain('hasKey $seen $providerKey');
		expect(source).toContain('index $seen $providerKey');
		expect(source).toContain('GYRE_AUTH_PROVIDER_{{ $providerKey }}_CLIENT_SECRET');
		expect(source).toContain('PROVIDER_{{ $providerKey }}_CLIENT_SECRET');
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
		expect(deployment).toContain('config.additionalConfig.BODY_SIZE_LIMIT is reserved');
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
	});
});
