export function formatEnvironment(nodeEnv: string | undefined): string | null {
	if (!nodeEnv) return null;

	switch (nodeEnv.toLowerCase()) {
		case 'development':
			return 'Development';
		case 'production':
			return 'Production';
		case 'test':
			return 'Test';
		default:
			return nodeEnv;
	}
}
