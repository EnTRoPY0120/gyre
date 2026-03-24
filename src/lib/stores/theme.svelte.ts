import { browser } from '$app/environment';
import { safeGetItem, safeSetItem } from '$lib/utils/storage';

export type Theme = 'light' | 'dark' | 'system';

interface ThemeStore {
	theme: Theme;
	resolvedTheme: 'light' | 'dark';
}

const STORAGE_KEY = 'gyre-theme';
const DEFAULT_THEME: Theme = 'system';

function getSystemTheme(): 'light' | 'dark' {
	if (!browser) return 'light';
	return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

function getStoredTheme(): Theme {
	if (!browser) return DEFAULT_THEME;
	const stored = safeGetItem(STORAGE_KEY);
	if (stored === 'light' || stored === 'dark' || stored === 'system') {
		return stored;
	}
	return DEFAULT_THEME;
}

function resolveTheme(theme: Theme): 'light' | 'dark' {
	if (theme === 'system') {
		return getSystemTheme();
	}
	return theme;
}

function applyTheme(resolvedTheme: 'light' | 'dark') {
	if (!browser) return;

	const root = document.documentElement;
	if (resolvedTheme === 'dark') {
		root.classList.add('dark');
	} else {
		root.classList.remove('dark');
	}
}

function createThemeStore() {
	const initialTheme = getStoredTheme();
	const initialResolved = resolveTheme(initialTheme);

	const store = $state<ThemeStore>({
		theme: initialTheme,
		resolvedTheme: initialResolved
	});

	let mediaQuery: MediaQueryList | null = null;
	let mediaQueryListener: ((event: MediaQueryListEvent) => void) | null = null;

	// Apply on init
	if (browser) {
		applyTheme(store.resolvedTheme);

		// Listen for system theme changes
		mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
		mediaQueryListener = () => {
			if (store.theme === 'system') {
				store.resolvedTheme = getSystemTheme();
				applyTheme(store.resolvedTheme);
			}
		};
		mediaQuery.addEventListener('change', mediaQueryListener);
	}

	return {
		get theme() {
			return store.theme;
		},
		get resolvedTheme() {
			return store.resolvedTheme;
		},
		get isDark() {
			return store.resolvedTheme === 'dark';
		},
		setTheme(newTheme: Theme) {
			store.theme = newTheme;
			store.resolvedTheme = resolveTheme(newTheme);
			applyTheme(store.resolvedTheme);

			if (browser) {
				safeSetItem(STORAGE_KEY, newTheme);
			}
		},
		toggle() {
			// Cycle through: light -> dark -> system -> light
			const nextTheme: Theme =
				store.theme === 'light' ? 'dark' : store.theme === 'dark' ? 'system' : 'light';
			this.setTheme(nextTheme);
		},
		destroy() {
			// Clean up event listener to prevent memory leak
			if (mediaQuery && mediaQueryListener) {
				mediaQuery.removeEventListener('change', mediaQueryListener);
				mediaQuery = null;
				mediaQueryListener = null;
			}
		}
	};
}

export const theme = createThemeStore();
