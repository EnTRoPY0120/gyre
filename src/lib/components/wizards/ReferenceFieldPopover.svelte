<script lang="ts">
	import { cn } from '$lib/utils';
	import { ChevronsUpDown } from '@lucide/svelte';
	import { onMount } from 'svelte';
	import type { ReferenceOption } from './reference-fetch';
	import ReferenceResourceMenu from './ReferenceResourceMenu.svelte';

	let {
		id,
		value,
		displayValue,
		open,
		loading,
		filteredResources,
		focusedIndex,
		isSelectedResource,
		searchQuery = $bindable(),
		searchInput = $bindable(),
		disabled = false,
		error = '',
		onToggle,
		onClose,
		onKeydown,
		onSelect
	}: {
		id?: string;
		value: string;
		displayValue: string;
		open: boolean;
		loading: boolean;
		filteredResources: ReferenceOption[];
		focusedIndex: number;
		isSelectedResource: (resource: ReferenceOption) => boolean;
		searchQuery: string;
		searchInput: HTMLInputElement | undefined;
		disabled?: boolean;
		error?: string;
		onToggle: () => void;
		onClose: () => void;
		onKeydown: (event: KeyboardEvent) => void;
		onSelect: (resource: ReferenceOption) => void;
	} = $props();

	let container: HTMLDivElement | undefined = $state();

	onMount(() => {
		const handleClickOutside = (event: MouseEvent) => {
			if (container && !container.contains(event.target as Node)) onClose();
		};

		document.addEventListener('click', handleClickOutside);
		return () => document.removeEventListener('click', handleClickOutside);
	});
</script>

<div
	role="presentation"
	class="relative w-full"
	bind:this={container}
	tabindex="-1"
	onkeydown={onKeydown}
>
	<button
		{id}
		type="button"
		class={cn(
			'flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50',
			error && 'border-red-500'
		)}
		onclick={onToggle}
		{disabled}
		role="combobox"
		aria-controls={open ? 'resource-listbox' : undefined}
		aria-expanded={open}
		aria-haspopup="listbox"
	>
		<span class={cn('truncate', !value && 'text-muted-foreground')}>{displayValue}</span>
		<ChevronsUpDown class="ml-2 h-4 w-4 shrink-0 opacity-50" />
	</button>

	{#if open}
		<ReferenceResourceMenu
			{loading}
			{filteredResources}
			{focusedIndex}
			{isSelectedResource}
			bind:searchQuery
			bind:searchInput
			onSelect={onSelect}
		/>
	{/if}
</div>
