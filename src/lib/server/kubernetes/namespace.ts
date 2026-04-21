import { readFileSync } from 'node:fs';

export const IN_CLUSTER_NAMESPACE_PATH = '/var/run/secrets/kubernetes.io/serviceaccount/namespace';

export function getCurrentNamespace(): string {
	try {
		const namespace = readFileSync(IN_CLUSTER_NAMESPACE_PATH, 'utf-8').trim();
		return namespace || 'default';
	} catch {
		return 'default';
	}
}
