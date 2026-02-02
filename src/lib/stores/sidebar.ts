import { writable } from 'svelte/store';
import { browser } from '$app/environment';

function createSidebarStore() {
	// Load from localStorage if in browser
	const stored = browser ? localStorage.getItem('gyre:sidebar-open') : null;
	const initial = stored !== null ? stored === 'true' : true; // Default to open

	const { subscribe, set, update } = writable<boolean>(initial);

	return {
		subscribe,
		set: (value: boolean) => {
			if (browser) {
				localStorage.setItem('gyre:sidebar-open', value.toString());
			}
			set(value);
		},
		toggle: () => {
			update((open) => {
				const newValue = !open;
				if (browser) {
					localStorage.setItem('gyre:sidebar-open', newValue.toString());
				}
				return newValue;
			});
		},
		open: () => {
			if (browser) {
				localStorage.setItem('gyre:sidebar-open', 'true');
			}
			set(true);
		},
		close: () => {
			if (browser) {
				localStorage.setItem('gyre:sidebar-open', 'false');
			}
			set(false);
		}
	};
}

export const sidebarOpen = createSidebarStore();
