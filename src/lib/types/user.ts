export interface UserPreferences {
	notifications?: {
		enabled?: boolean;
		resourceTypes?: string[];
		namespaces?: string[];
		events?: ('success' | 'failure' | 'warning' | 'info' | 'error')[];
	};
	theme?: 'light' | 'dark' | 'system';
}
