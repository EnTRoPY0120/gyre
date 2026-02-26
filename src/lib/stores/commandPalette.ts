import { writable } from 'svelte/store';

const { subscribe, set, update } = writable(false);

export const commandPaletteOpen = {
	subscribe,
	open: () => set(true),
	close: () => set(false),
	toggle: () => update((v) => !v)
};
