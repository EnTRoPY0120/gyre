import { readFileSync } from 'node:fs';

export const IN_CLUSTER_NAMESPACE_PATH = '/var/run/secrets/kubernetes.io/serviceaccount/namespace';

export function getCurrentNamespace(): string {
	try {
		return readFileSync(IN_CLUSTER_NAMESPACE_PATH, 'utf-8').trim();
	} catch {
		return 'default';
	}
}
