export interface UserPreferences {
	notifications?: {
		enabled?: boolean;
		resourceTypes?: string[];
		namespaces?: string[];
		events?: ('success' | 'failure' | 'warning' | 'info' | 'error')[];
	};
	onboarding?: {
		adminChecklistDismissed?: boolean;
		adminChecklistCompletedItems?: string[];
	};
	theme?: 'light' | 'dark' | 'system';
}
