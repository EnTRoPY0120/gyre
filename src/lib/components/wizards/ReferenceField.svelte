<script lang="ts">
	import { cn } from '$lib/utils';
	import { logger } from '$lib/utils/logger.js';
	import { ChevronsUpDown } from '@lucide/svelte';
	import { onMount } from 'svelte';
	import { fetchReferenceResources, isAbortError, type ReferenceOption } from './reference-fetch';
	import { getReferenceKeyAction } from './reference-keyboard';
	import ReferenceResourceMenu from './ReferenceResourceMenu.svelte';

	export type { ReferenceOption } from './reference-fetch';

	let {
		id,
		value = $bindable(''),
		referenceType,
		referenceTypeField,
		referenceNamespace = '',
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
		referenceNamespace?: string;
		formValues?: Record<string, unknown>;
		placeholder?: string;
		disabled?: boolean;
		error?: string;
		onValueChange?: (value: string, selection?: ReferenceOption) => void;
	} = $props();

	function getInitialReferenceTypes(): string[] {
		if (referenceTypeField) {
			const typeFromField = formValues[referenceTypeField];
			return typeFromField ? [String(typeFromField)] : [];
		}
		if (Array.isArray(referenceType)) return referenceType;
		if (referenceType) return [referenceType];
		return [];
	}

	function getInitialReferenceNamespace(): string {
		return referenceNamespace;
	}

	function getInitialReferenceTypeKey(): string {
		return getInitialReferenceTypes().join('\u0000');
	}

	let open = $state(false);
	let loading = $state(false);
	let resources = $state<ReferenceOption[]>([]);
	let searchQuery = $state('');
	let focusedIndex = $state(-1);
	let container: HTMLDivElement | undefined = $state();
	let searchInput: HTMLInputElement | undefined = $state();
	let selectedKey = $state<string | null>(null);
	let selectedLabel = $state('');
	let lastSelectedValue = $state(value);
	let lastReferenceNamespace = $state(getInitialReferenceNamespace());
	let lastReferenceType = $state(getInitialReferenceTypeKey());
	let fetchRequestId = 0;
	let activeFetchController: AbortController | null = null;

	function cancelActiveFetch() {
		activeFetchController?.abort();
		activeFetchController = null;
		fetchRequestId += 1;
		loading = false;
	}

	function parseOptionKey(key: string) {
		const firstSeparator = key.indexOf(':');
		const secondSeparator = key.indexOf(':', firstSeparator + 1);
		return {
			kind: key.slice(0, firstSeparator),
			namespace: key.slice(firstSeparator + 1, secondSeparator),
			name: key.slice(secondSeparator + 1)
		};
	}

	function optionMatchesCurrentValue(resource: Pick<ReferenceOption, 'name' | 'namespace'>): boolean {
		return (
			resource.name === value &&
			(!referenceNamespace || (resource.namespace ?? '') === referenceNamespace)
		);
	}

	// Resolve the actual resource types to fetch
	const activeReferenceTypes = $derived.by(() => getInitialReferenceTypes());

	const filteredResources = $derived.by(() => {
		const query = searchQuery.trim().toLowerCase();
		if (query === '') return resources;
		return resources.filter((resource) => resource.searchText.includes(query));
	});

	const selectedResource = $derived.by(() => {
		if (!value) return null;

		if (selectedKey) {
			const selectedByKey = resources.find((resource) => resource.key === selectedKey);
			if (selectedByKey && optionMatchesCurrentValue(selectedByKey)) {
				return selectedByKey;
			}
		}

		const matches = resources.filter((resource) => optionMatchesCurrentValue(resource));
		return matches.length === 1 ? matches[0] : null;
	});

	const displayValue = $derived.by(() => {
		if (!value) return placeholder;

		if (selectedResource) {
			return selectedResource.label;
		}

		if (selectedKey) {
			const selectedIdentity = parseOptionKey(selectedKey);
			if (
				selectedIdentity.name === value &&
				(!referenceNamespace || selectedIdentity.namespace === referenceNamespace)
			) {
				return selectedLabel;
			}
		}

		return referenceNamespace ? `${value} (${referenceNamespace})` : value;
	});

	$effect(() => {
		const currentNamespace = referenceNamespace;
		const currentReferenceType = activeReferenceTypes.join('\u0000');

		if (currentNamespace !== lastReferenceNamespace) {
			lastSelectedValue = value;
			if (open) {
				cancelActiveFetch();
				void fetchResources();
			}
			lastReferenceNamespace = currentNamespace;
		}

		if (currentReferenceType !== lastReferenceType) {
			cancelActiveFetch();
			selectedKey = null;
			selectedLabel = '';
			lastSelectedValue = value;
			resources = [];
			lastReferenceType = currentReferenceType;
			if (open) {
				void fetchResources();
			}
		}
	});

	$effect(() => {
		const currentValue = value;
		if (currentValue !== lastSelectedValue) {
			selectedKey = null;
			selectedLabel = '';
			lastSelectedValue = currentValue;
		}
	});

	async function fetchResources() {
		cancelActiveFetch();
		const controller = new AbortController();
		activeFetchController = controller;
		const currentFetchId = ++fetchRequestId;

		if (activeReferenceTypes.length === 0) {
			if (currentFetchId === fetchRequestId) {
				resources = [];
				loading = false;
				activeFetchController = null;
			}
			return;
		}

		loading = true;
		try {
			if (currentFetchId === fetchRequestId) {
				const result = await fetchReferenceResources(activeReferenceTypes, resources, controller.signal);
				if (result.resources.length > 0 || !result.sawFailure) resources = result.resources;
			}
		} catch (err) {
			if (currentFetchId === fetchRequestId && !isAbortError(err)) {
				logger.error(err, 'Failed to fetch resources:');
			}
		} finally {
			if (currentFetchId === fetchRequestId) {
				activeFetchController = null;
				loading = false;
			}
		}
	}

	function handleToggle() {
		if (disabled) return;
		open = !open;
		if (open) {
			searchQuery = '';
			focusedIndex = -1;
			fetchResources();
			setTimeout(() => {
				searchInput?.focus();
			}, 0);
		}
	}

	function handleSelect(resource: ReferenceOption) {
		selectedKey = resource.key;
		lastSelectedValue = resource.name;
		selectedLabel = resource.label;
		value = resource.name;
		open = false;
		onValueChange?.(resource.name, resource);
	}

	function handleKeydown(e: KeyboardEvent) {
		const action = getReferenceKeyAction(
			e.key,
			open,
			focusedIndex,
			filteredResources.length
		);
		if (action.preventDefault) e.preventDefault();

		switch (action.type) {
			case 'toggle':
				handleToggle();
				break;
			case 'move':
				focusedIndex = action.index;
				break;
			case 'select':
				handleSelect(filteredResources[action.index]);
				break;
			case 'close':
				open = false;
				break;
		}
	}

	function isSelectedResource(resource: ReferenceOption): boolean {
		return selectedResource?.key === resource.key;
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

<div
	role="presentation"
	class="relative w-full"
	bind:this={container}
	tabindex="-1"
	onkeydown={handleKeydown}
>
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
			{displayValue}
		</span>
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
			onSelect={handleSelect}
		/>
	{/if}
</div>
