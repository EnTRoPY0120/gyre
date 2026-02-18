<script lang="ts">
	import { cn } from '$lib/utils';
	import { getPluralByKind } from '$lib/templates';
	import { Check, ChevronsUpDown, Loader2, Search } from 'lucide-svelte';
	import { onMount } from 'svelte';

	let {
		id,
		value = $bindable(''),
		referenceType,
		referenceTypeField,
		formValues = {},
		placeholder = 'Select resource...',
		disabled = false,
		error = '',
		onValueChange
	}: {
		id?: string;
		value: string;
		referenceType?: string | string[];
		referenceTypeField?: string;
		formValues?: Record<string, unknown>;
		placeholder?: string;
		disabled?: boolean;
		error?: string;
		onValueChange?: (value: string) => void;
	} = $props();

	let open = $state(false);
	let loading = $state(false);
	let resources = $state<string[]>([]);
	let searchQuery = $state('');
	let focusedIndex = $state(-1);
	let container: HTMLDivElement | undefined = $state();
	let searchInput: HTMLInputElement | undefined = $state();

	// Resolve the actual resource types to fetch
	const activeReferenceTypes = $derived.by(() => {
		if (referenceTypeField) {
			const typeFromField = formValues[referenceTypeField];
			return typeFromField ? [String(typeFromField)] : [];
		}
		if (Array.isArray(referenceType)) return referenceType;
		if (referenceType) return [referenceType];
		return [];
	});

	const filteredResources = $derived(
		searchQuery === ''
			? resources
			: resources.filter((r) => r.toLowerCase().includes(searchQuery.toLowerCase()))
	);

	async function fetchResources() {
		if (activeReferenceTypes.length === 0) {
			resources = [];
			return;
		}

		loading = true;
		resources = []; // Clear resources before starting fetch
		try {
			const allNames: string[] = [];
			for (const kind of activeReferenceTypes) {
				// Special case for '*' in some fields (like Alert sources)
				if (kind === '*') continue;

				const plural = getPluralByKind(kind);
				// If not found in templates, try lowercase-plural as fallback
				const pluralToUse = plural || kind.toLowerCase() + 's';

				const res = await fetch(`/api/flux/${pluralToUse}`);
				if (res.ok) {
					const data = await res.json();
					if (data.items) {
						data.items.forEach((item: any) => {
							allNames.push(item.metadata.name);
						});
					}
				} else {
					const errorBody = await res.text();
					console.error(
						`Failed to fetch ${pluralToUse}: ${res.status} ${res.statusText}`,
						errorBody
					);
				}
			}
			// Deduplicate and sort
			resources = [...new Set(allNames)].sort();
		} catch (err) {
			console.error('Failed to fetch resources:', err);
			resources = []; // Clear on error
		} finally {
			loading = false;
		}
	}

	function handleToggle() {
		if (disabled) return;
		open = !open;
		if (open) {
			searchQuery = '';
			focusedIndex = -1;
			fetchResources();
			// Focus search input on next tick
			setTimeout(() => {
				searchInput?.focus();
			}, 0);
		}
	}

	function handleSelect(resource: string) {
		value = resource;
		open = false;
		onValueChange?.(resource);
	}

	function handleKeydown(e: KeyboardEvent) {
		if (!open) {
			if (e.key === 'Enter' || e.key === 'ArrowDown' || e.key === 'ArrowUp') {
				e.preventDefault();
				handleToggle();
			}
			return;
		}

		switch (e.key) {
			case 'ArrowDown':
				e.preventDefault();
				if (filteredResources.length > 0) {
					focusedIndex = (focusedIndex + 1) % filteredResources.length;
				}
				break;
			case 'ArrowUp':
				e.preventDefault();
				if (filteredResources.length > 0) {
					focusedIndex =
						focusedIndex <= 0 ? filteredResources.length - 1 : focusedIndex - 1;
				}
				break;
			case 'Enter':
				e.preventDefault();
				if (focusedIndex >= 0 && focusedIndex < filteredResources.length) {
					handleSelect(filteredResources[focusedIndex]);
				}
				break;
			case 'Escape':
				e.preventDefault();
				open = false;
				break;
			case 'Tab':
				open = false;
				break;
		}
	}

	// Close on click outside
	onMount(() => {
		const handleClickOutside = (event: MouseEvent) => {
			if (container && !container.contains(event.target as Node)) {
				open = false;
			}
		};

		document.addEventListener('click', handleClickOutside);
		return () => {
			document.removeEventListener('click', handleClickOutside);
		};
	});
</script>

<div class="relative w-full" bind:this={container} tabindex="-1" onkeydown={handleKeydown}>
	<button
		{id}
		type="button"
		class={cn(
			'flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50',
			error && 'border-red-500'
		)}
		onclick={handleToggle}
		{disabled}
		role="combobox"
		aria-controls={open ? 'resource-listbox' : undefined}
		aria-expanded={open}
		aria-haspopup="listbox"
	>
		<span class={cn('truncate', !value && 'text-muted-foreground')}>
			{value || placeholder}
		</span>
		<ChevronsUpDown class="ml-2 h-4 w-4 shrink-0 opacity-50" />
	</button>

	{#if open}
		<div
			id="resource-listbox"
			class="absolute z-50 mt-1 w-full overflow-hidden rounded-md border border-zinc-800 bg-zinc-900 shadow-xl"
			role="listbox"
		>
			<div class="flex items-center border-b border-zinc-800 px-3">
				<Search class="mr-2 h-4 w-4 shrink-0 opacity-50" />
				<input
					bind:this={searchInput}
					class="flex h-10 w-full rounded-md bg-transparent py-3 text-sm outline-none placeholder:text-zinc-500 disabled:cursor-not-allowed disabled:opacity-50"
					placeholder="Search resources..."
					bind:value={searchQuery}
				/>
			</div>
			<div class="max-h-[200px] overflow-y-auto p-1">
				{#if loading}
					<div class="flex items-center justify-center py-6 text-sm text-zinc-500">
						<Loader2 class="mr-2 h-4 w-4 animate-spin" />
						Loading resources...
					</div>
				{:else if filteredResources.length === 0}
					<div class="py-6 text-center text-sm text-zinc-500">No resources found.</div>
				{:else}
					{#each filteredResources as resource, i}
						<button
							type="button"
							class={cn(
								'relative flex w-full cursor-default select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none hover:bg-zinc-800 hover:text-zinc-50 data-[disabled]:pointer-events-none data-[disabled]:opacity-50',
								focusedIndex === i && 'bg-zinc-800 text-zinc-50'
							)}
							onclick={() => handleSelect(resource)}
							role="option"
							aria-selected={value === resource}
							tabindex="-1"
						>
							<Check
								class={cn('mr-2 h-4 w-4', value === resource ? 'opacity-100' : 'opacity-0')}
							/>
							{resource}
						</button>
					{/each}
				{/if}
			</div>
		</div>
	{/if}
</div>
