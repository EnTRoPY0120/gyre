import { logger } from '../logger.js';
import * as k8s from '@kubernetes/client-node';

/**
 * Parse kubeconfig and extract contexts
 */
export function parseKubeconfig(kubeconfig: string): {
	contexts: string[];
	currentContext: string | null;
} {
	try {
		const kc = new k8s.KubeConfig();
		kc.loadFromString(kubeconfig);

		const contexts = kc.getContexts().map((ctx) => ctx.name);
		const currentContext = kc.getCurrentContext();

		return { contexts, currentContext };
	} catch {
		logger.error('Failed to parse kubeconfig: parse error (sanitized)');
		return { contexts: [], currentContext: null };
	}
}
