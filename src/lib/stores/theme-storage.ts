import type { Theme } from './theme.svelte';

export function getStoredThemeValue(stored: string | null | undefined): Theme {
	return stored === 'light' || stored === 'dark' || stored === 'system' ? stored : 'system';
}
