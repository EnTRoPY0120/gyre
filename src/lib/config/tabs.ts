export type TabId =
	| 'overview'
	| 'spec'
	| 'status'
	| 'events'
	| 'logs'
	| 'history'
	| 'diff';

export interface TabConfig {
	id: TabId;
	label: string;
}

export const BASE_TABS: TabConfig[] = [
	{ id: 'overview', label: 'Overview' },
	{ id: 'spec', label: 'YAML' },
	{ id: 'status', label: 'Status' },
	{ id: 'events', label: 'Events' },
	{ id: 'logs', label: 'Logs' },
	{ id: 'history', label: 'History' }
];

export const DIFF_TAB: TabConfig = { id: 'diff', label: 'Drift (Diff)' };
