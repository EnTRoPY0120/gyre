<script lang="ts">
	import type { K8sCondition } from '$lib/types/flux';
	import { getResourceHealth, getHealthLabel } from '$lib/utils/flux';
	import { cn } from '$lib/utils';
	import { Check, Loader2, AlertTriangle, Pause, HelpCircle } from 'lucide-svelte';

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
					icon: 'text-emerald-500'
				};
			case 'progressing':
				return {
					badge: 'bg-blue-500/10 text-blue-500 border-blue-500/20 animate-pulse',
					icon: 'text-blue-500'
				};
			case 'failed':
				return {
					badge:
						'bg-red-500/10 text-red-500 border-red-500/20 shadow-[0_0_10px_rgba(239,68,68,0.1)]',
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
	});

	const sizeClasses = $derived(size === 'sm' ? 'px-2 py-0.5 text-[10px]' : 'px-2.5 py-1 text-xs');
	const iconSize = $derived(size === 'sm' ? 12 : 14);
</script>

<div
	class={cn(
		'inline-flex items-center gap-1.5 rounded-full border font-bold tracking-wider uppercase backdrop-blur-sm transition-all',
		sizeClasses,
		styles.badge
	)}
>
	{#if health === 'healthy'}
		<Check size={iconSize} class={cn(styles.icon)} />
	{:else if health === 'progressing'}
		<Loader2 size={iconSize} class={cn('animate-spin', styles.icon)} />
	{:else if health === 'failed'}
		<AlertTriangle size={iconSize} class={cn(styles.icon)} />
	{:else if health === 'suspended'}
		<Pause size={iconSize} class={cn(styles.icon)} />
	{:else}
		<HelpCircle size={iconSize} class={cn(styles.icon)} />
	{/if}
	{label}
</div>
