import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
	return twMerge(clsx(inputs));
}

export type { ClassValue };

// Helper types for shadcn-svelte
export type WithElementRef<T> = T & {
	ref?: HTMLElement | null;
};

// Relaxed types to avoid strict children checking issues
export type WithoutChild<T> = T;
export type WithoutChildrenOrChild<T> = T;
