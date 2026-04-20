export interface UserPreferences {
	notifications?: {
		enabled?: boolean;
		resourceTypes?: string[];
		namespaces?: string[];
		events?: ('success' | 'failure' | 'warning' | 'info' | 'error')[];
	};
	// Legacy compatibility fields. Dashboard readiness no longer reads/writes these.
	onboarding?: {
		adminChecklistDismissed?: boolean;
		adminChecklistCompletedItems?: string[];
	};
	theme?: 'light' | 'dark' | 'system';
}
