<script lang="ts">
	import type { K8sCondition } from '$lib/types/flux';
	import { getResourceHealth, getHealthLabel } from '$lib/utils/flux';
	import { getStatusBadgeStyles } from './status-badge-styles';
	import { cn } from '$lib/utils';
	import { Check, Loader2, AlertTriangle, Pause, HelpCircle } from '@lucide/svelte';

	interface Props {
		conditions?: K8sCondition[];
		suspended?: boolean;
		observedGeneration?: number;
		generation?: number;
		size?: 'sm' | 'md';
	}

	let {
		conditions,
		suspended = false,
		observedGeneration,
		generation,
		size = 'md'
	}: Props = $props();

	const health = $derived(getResourceHealth(conditions, suspended, observedGeneration, generation));
	const label = $derived(getHealthLabel(health));

	const styles = $derived(getStatusBadgeStyles(health));

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
