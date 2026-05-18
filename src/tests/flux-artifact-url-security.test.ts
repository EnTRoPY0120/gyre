import { afterEach, describe, expect, test } from 'vitest';
import { validateFluxArtifactUrl } from '../lib/server/kubernetes/flux/artifact-url-security.js';

afterEach(() => {
	delete process.env.FLUX_SOURCE_CONTROLLER_SERVICE;
});

describe('validateFluxArtifactUrl', () => {
	test('accepts default source-controller service URL', () => {
		const result = validateFluxArtifactUrl(
			'http://source-controller.flux-system.svc/gitrepository/default/app.tar.gz',
			'flux-system'
		);

		expect(result.url).toBe(
			'http://source-controller.flux-system.svc/gitrepository/default/app.tar.gz'
		);
		expect(result.pathname).toBe('/gitrepository/default/app.tar.gz');
	});

	test('normalizes trailing cluster.local dot', () => {
		const result = validateFluxArtifactUrl(
			'http://source-controller.flux-system.svc.cluster.local./artifact.tar.gz',
			'flux-system'
		);

		expect(result.url).toBe(
			'http://source-controller.flux-system.svc.cluster.local/artifact.tar.gz'
		);
	});

	test('accepts customized Flux namespace', () => {
		const result = validateFluxArtifactUrl(
			'https://source-controller.platform-flux.svc.cluster.local/artifact.tar.gz',
			'platform-flux'
		);

		expect(result.url).toBe(
			'https://source-controller.platform-flux.svc.cluster.local/artifact.tar.gz'
		);
	});

	test('accepts configured source-controller service name', () => {
		process.env.FLUX_SOURCE_CONTROLLER_SERVICE = 'gyre-source-controller';

		const result = validateFluxArtifactUrl(
			'http://gyre-source-controller.flux-system.svc.cluster.local/artifact.tar.gz',
			'flux-system'
		);

		expect(result.url).toBe(
			'http://gyre-source-controller.flux-system.svc.cluster.local/artifact.tar.gz'
		);
	});

	test.each([
		'http://169.254.169.254/latest/meta-data',
		'http://localhost/artifact.tar.gz',
		'http://evil.example.com/artifact.tar.gz',
		'http://kubernetes.default.svc/artifact.tar.gz',
		'http://user:pass@source-controller.flux-system.svc/artifact.tar.gz',
		'file:///tmp/artifact.tar.gz',
		'ftp://source-controller.flux-system.svc/artifact.tar.gz'
	])('rejects untrusted artifact URL %p', (artifactUrl) => {
		expect(() => validateFluxArtifactUrl(artifactUrl, 'flux-system')).toThrow();
	});
});
