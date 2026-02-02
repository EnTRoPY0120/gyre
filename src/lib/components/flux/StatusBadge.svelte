<script lang="ts">
	import type { K8sCondition } from '$lib/types/flux';
	import { getResourceHealth, getHealthLabel } from '$lib/utils/flux';
	import { cn } from '$lib/utils';

	interface Props {
		conditions?: K8sCondition[];
		suspended?: boolean;
		size?: 'sm' | 'md';
	}

	let { conditions, suspended = false, size = 'md' }: Props = $props();

	const health = $derived(getResourceHealth(conditions, suspended));
	const label = $derived(getHealthLabel(health));

	const styles = $derived.by(() => {
		switch (health) {
			case 'healthy':
				return {
					badge:
						'bg-emerald-500/10 text-emerald-500 border-emerald-500/20 shadow-[0_0_10px_rgba(16,185,129,0.1)]',
					dot: 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]'
				};
			case 'progressing':
				return {
					badge: 'bg-blue-500/10 text-blue-500 border-blue-500/20 animate-pulse',
					dot: 'bg-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.5)]'
				};
			case 'failed':
				return {
					badge:
						'bg-red-500/10 text-red-500 border-red-500/20 shadow-[0_0_10px_rgba(239,68,68,0.1)]',
					dot: 'bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.5)]'
				};
			case 'suspended':
				return {
					badge: 'bg-amber-500/10 text-amber-500 border-amber-500/20',
					dot: 'bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.5)]'
				};
			default:
				return {
					badge: 'bg-zinc-500/10 text-zinc-500 border-zinc-500/20',
					dot: 'bg-zinc-500'
				};
		}
	});

	const sizeClasses = $derived(size === 'sm' ? 'px-2 py-0.5 text-[10px]' : 'px-2.5 py-1 text-xs');
	const dotSize = $derived(size === 'sm' ? 'h-1 w-1' : 'h-1.5 w-1.5');
</script>

<div
	class={cn(
		'inline-flex items-center gap-1.5 rounded-full border font-bold tracking-wider uppercase backdrop-blur-sm transition-all',
		sizeClasses,
		styles.badge
	)}
>
	<div class={cn('rounded-full', dotSize, styles.dot)}></div>
	{label}
</div>
