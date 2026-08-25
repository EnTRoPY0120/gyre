import type { ResourceHealth } from '$lib/types/view';

export interface StatusBadgeStyles {
	badge: string;
	icon: string;
}

export function getStatusBadgeStyles(health: ResourceHealth): StatusBadgeStyles {
	switch (health) {
		case 'healthy':
			return {
				badge:
					'bg-emerald-500/10 text-emerald-500 border-emerald-500/20 shadow-[0_0_10px_rgba(16,185,129,0.1)]',
				icon: 'text-emerald-500'
			};
		case 'progressing':
			return {
				badge: 'bg-primary/10 text-primary border-primary/20 animate-pulse',
				icon: 'text-primary'
			};
		case 'failed':
			return {
				badge: 'bg-red-500/10 text-red-500 border-red-500/20 shadow-[0_0_10px_rgba(239,68,68,0.1)]',
				icon: 'text-red-500'
			};
		case 'suspended':
			return {
				badge: 'bg-amber-500/10 text-amber-500 border-amber-500/20',
				icon: 'text-amber-500'
			};
		default:
			return {
				badge: 'bg-zinc-500/10 text-zinc-500 border-zinc-500/20',
				icon: 'text-zinc-500'
			};
	}
}
