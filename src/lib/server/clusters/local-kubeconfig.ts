import { type ClusterOption } from '$lib/clusters/identity.js';
import { logger } from '$lib/server/logger.js';
import * as k8s from '@kubernetes/client-node';

export function shouldUseLocalKubeconfigContexts(): boolean {
	return !process.env.KUBERNETES_SERVICE_HOST;
}

export function loadLocalKubeConfig(): k8s.KubeConfig | null {
	if (!shouldUseLocalKubeconfigContexts()) {
		return null;
	}

	const config = new k8s.KubeConfig();
	try {
		config.loadFromDefault();
		return config;
	} catch (error) {
		logger.debug(error, 'Local kubeconfig contexts are not available');
		return null;
	}
}

export function getLocalKubeconfigContextNames(): string[] {
	const config = loadLocalKubeConfig();
	if (!config) {
		return [];
	}

	return [
		...new Set(
			config
				.getContexts()
				.map((context) => context.name)
				.filter(Boolean)
		)
	];
}

export function hasLocalKubeconfigContext(contextName: string): boolean {
	return getLocalKubeconfigContextNames().includes(contextName);
}

export function getDefaultLocalKubeconfigContext(): string | null {
	const config = loadLocalKubeConfig();
	if (!config) {
		return null;
	}

	const currentContext = config.getCurrentContext();
	if (currentContext && config.getContexts().some((context) => context.name === currentContext)) {
		return currentContext;
	}

	return config.getContexts()[0]?.name ?? null;
}

export function getLocalKubeconfigOptions(currentContext?: string | null): ClusterOption[] {
	const config = loadLocalKubeConfig();
	if (!config) {
		return [];
	}

	const activeContext = currentContext || config.getCurrentContext();
	return config.getContexts().map((context) => ({
		id: context.name,
		name: context.name,
		description: context.cluster
			? `Local kubeconfig context for ${context.cluster}`
			: 'Local kubeconfig context',
		source: 'local-kubeconfig' as const,
		isActive: true,
		currentContext: context.name === activeContext ? context.name : null
	}));
}
