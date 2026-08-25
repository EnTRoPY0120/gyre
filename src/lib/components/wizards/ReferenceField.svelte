<script lang="ts">
	import { logger } from '$lib/utils/logger.js';
	import {
		fetchReferenceResources,
		getReferenceResourcesAfterFetch,
		isAbortError,
		type ReferenceFetchResult,
		type ReferenceOption
	} from './reference-fetch';
	import { getReferenceKeyAction, type ReferenceKeyAction } from './reference-keyboard';
	import { getReferenceDisplayValue } from './reference-display';
	import ReferenceFieldPopover from './ReferenceFieldPopover.svelte';

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
		return referenceType ? [referenceType] : [];
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

	function optionMatchesCurrentValue(resource: Pick<ReferenceOption, 'name' | 'namespace'>): boolean {
		return (
			resource.name === value &&
			(!referenceNamespace || (resource.namespace ?? '') === referenceNamespace)
		);
	}

	function getSelectedResourceByKey(): ReferenceOption | null {
		if (!selectedKey) return null;
		const selectedByKey = resources.find((resource) => resource.key === selectedKey);
		return selectedByKey && optionMatchesCurrentValue(selectedByKey) ? selectedByKey : null;
	}

	function findSelectedResource(): ReferenceOption | null {
		if (!value) return null;

		const selectedByKey = getSelectedResourceByKey();
		if (selectedByKey) return selectedByKey;

		const matches = resources.filter((resource) => optionMatchesCurrentValue(resource));
		return matches.length === 1 ? matches[0] : null;
	}

	function isCurrentFetch(fetchId: number): boolean {
		return fetchId === fetchRequestId;
	}

	function clearEmptyFetch(fetchId: number) {
		if (!isCurrentFetch(fetchId)) return;
		resources = [];
		loading = false;
		activeFetchController = null;
	}

	function commitFetchResult(fetchId: number, result: ReferenceFetchResult) {
		if (!isCurrentFetch(fetchId)) return;
		resources = getReferenceResourcesAfterFetch(result, resources);
	}

	function logFetchError(fetchId: number, err: unknown) {
		if (isCurrentFetch(fetchId) && !isAbortError(err)) {
			logger.error(err, 'Failed to fetch resources:');
		}
	}

	function finishFetch(fetchId: number) {
		if (!isCurrentFetch(fetchId)) return;
		activeFetchController = null;
		loading = false;
	}

	// Resolve the actual resource types to fetch
	const activeReferenceTypes = $derived.by(() => getInitialReferenceTypes());

	const filteredResources = $derived.by(() => {
		const query = searchQuery.trim().toLowerCase();
		if (query === '') return resources;
		return resources.filter((resource) => resource.searchText.includes(query));
	});

	const selectedResource = $derived.by(findSelectedResource);

	const displayValue = $derived.by(() => {
		return getReferenceDisplayValue({
			value,
			placeholder,
			selectedResource,
			selectedKey,
			selectedLabel,
			referenceNamespace
		});
	});

	function syncReferenceNamespace(currentNamespace: string) {
		lastSelectedValue = value;
		if (open) {
			cancelActiveFetch();
			void fetchResources();
		}
		lastReferenceNamespace = currentNamespace;
	}

	function syncReferenceType(currentReferenceType: string) {
		cancelActiveFetch();
		selectedKey = null;
		selectedLabel = '';
		lastSelectedValue = value;
		resources = [];
		lastReferenceType = currentReferenceType;
		if (open) void fetchResources();
	}

	$effect(() => {
		const currentNamespace = referenceNamespace;
		const currentReferenceType = activeReferenceTypes.join('\u0000');

		if (currentNamespace !== lastReferenceNamespace) {
			syncReferenceNamespace(currentNamespace);
		}

		if (currentReferenceType !== lastReferenceType) {
			syncReferenceType(currentReferenceType);
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
			clearEmptyFetch(currentFetchId);
			return;
		}

		loading = true;
		try {
			const result = await fetchReferenceResources(activeReferenceTypes, resources, controller.signal);
			commitFetchResult(currentFetchId, result);
		} catch (err) {
			logFetchError(currentFetchId, err);
		} finally {
			finishFetch(currentFetchId);
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

	function applyReferenceKeyAction(action: ReferenceKeyAction, index?: number): void {
		const handlers: Record<ReferenceKeyAction['type'], (index?: number) => void> = {
			toggle: () => handleToggle(),
			move: (nextIndex) => {
				focusedIndex = nextIndex as number;
			},
			select: (selectedIndex) => {
				handleSelect(filteredResources[selectedIndex as number]);
			},
			close: () => {
				open = false;
			},
			none: () => {}
		};

		handlers[action.type](index);
	}

	function handleKeydown(e: KeyboardEvent) {
		const action = getReferenceKeyAction(
			e.key,
			open,
			focusedIndex,
			filteredResources.length
		);
		if (action.preventDefault) e.preventDefault();
		applyReferenceKeyAction(action, 'index' in action ? action.index : undefined);
	}

	function isSelectedResource(resource: ReferenceOption): boolean {
		return selectedResource?.key === resource.key;
	}

</script>

<ReferenceFieldPopover
	{id}
	{value}
	{displayValue}
	{open}
	{loading}
	{filteredResources}
	{focusedIndex}
	{isSelectedResource}
	bind:searchQuery
	bind:searchInput
	{disabled}
	{error}
	onToggle={handleToggle}
	onClose={() => (open = false)}
	onKeydown={handleKeydown}
	onSelect={handleSelect}
/>
