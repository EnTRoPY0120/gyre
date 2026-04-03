<script lang="ts">
	import { resolveResourceRouteType } from '$lib/config/resources';
	import { cn } from '$lib/utils';
	import { fetchWithRetry } from '$lib/utils/fetch';
	import { logger } from '$lib/utils/logger.js';
	import { Check, ChevronsUpDown, Loader2, Search } from 'lucide-svelte';
	import { onMount } from 'svelte';

	interface K8sResourceItem {
		kind?: string;
		metadata: {
			name: string;
			namespace?: string;
		};
	}

	interface K8sResourceList {
		items?: K8sResourceItem[];
	}

	export interface ReferenceOption {
		key: string;
		kind: string;
		name: string;
		namespace?: string;
		label: string;
		searchText: string;
	}

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
	let lastReferenceNamespace = $state('');
	let fetchRequestId = 0;

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

	function buildOptionLabel(
		name: string,
		namespace: string | undefined,
		kind: string,
		includeKind: boolean
	): string {
		const details: string[] = [];
		if (namespace) details.push(namespace);
		if (includeKind) details.push(kind);
		return details.length > 0 ? `${name} (${details.join(', ')})` : name;
	}

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
		if (currentNamespace !== lastReferenceNamespace) {
			selectedKey = null;
			selectedLabel = '';
			lastSelectedValue = value;
			lastReferenceNamespace = currentNamespace;
			fetchRequestId += 1;
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
		const currentFetchId = ++fetchRequestId;

		if (activeReferenceTypes.length === 0) {
			if (currentFetchId === fetchRequestId) {
				resources = [];
				loading = false;
			}
			return;
		}

		loading = true;
		resources = [];
		try {
			const includeKindInLabel = activeReferenceTypes.length > 1;
			const fetchPromises = activeReferenceTypes
				.filter((kind) => kind !== '*')
				.map(async (kind) => {
					const routeType = resolveResourceRouteType(kind);
					if (!routeType) {
						throw new Error(`Unknown reference type: ${kind}`);
					}

					const res = await fetchWithRetry(`/api/v1/flux/${routeType}`);
					if (!res.ok) {
						const errorBody = await res.text();
						throw new Error(
							`Failed to fetch ${routeType}: ${res.status} ${res.statusText} - ${errorBody}`
						);
					}

					const data = (await res.json()) as K8sResourceList;
					return (
						data.items?.map((item) => {
							const optionKind = item.kind || kind;
							const optionNamespace = item.metadata.namespace;
							const label = buildOptionLabel(
								item.metadata.name,
								optionNamespace,
								optionKind,
								includeKindInLabel
							);

							return {
								key: `${optionKind}:${optionNamespace || ''}:${item.metadata.name}`,
								kind: optionKind,
								name: item.metadata.name,
								namespace: optionNamespace,
								label,
								searchText: [item.metadata.name, optionNamespace, optionKind]
									.filter(Boolean)
									.join(' ')
									.toLowerCase()
							} satisfies ReferenceOption;
						}) || []
					);
				});

			const results = await Promise.allSettled(fetchPromises);
			const nextResources: ReferenceOption[] = [];

			results.forEach((result) => {
				if (currentFetchId !== fetchRequestId) return;

				if (result.status === 'fulfilled') {
					nextResources.push(...result.value);
				} else {
					logger.error(
						result.reason instanceof Error ? result.reason : new Error(String(result.reason)),
						'Failed to fetch resources:'
					);
				}
			});

			if (currentFetchId === fetchRequestId) {
				resources = Array.from(
					new Map(nextResources.map((resource) => [resource.key, resource])).values()
				).sort((a, b) => a.label.localeCompare(b.label));
			}
		} catch (err) {
			if (currentFetchId === fetchRequestId) {
				logger.error(err, 'Failed to fetch resources:');
				resources = [];
			}
		} finally {
			if (currentFetchId === fetchRequestId) {
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
					focusedIndex = focusedIndex <= 0 ? filteredResources.length - 1 : focusedIndex - 1;
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
					{#each filteredResources as resource, i (resource.key)}
						<button
							type="button"
							class={cn(
								'relative flex w-full cursor-default select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none hover:bg-zinc-800 hover:text-zinc-50 data-[disabled]:pointer-events-none data-[disabled]:opacity-50',
								focusedIndex === i && 'bg-zinc-800 text-zinc-50'
							)}
							onclick={() => handleSelect(resource)}
							role="option"
							aria-selected={isSelectedResource(resource)}
							tabindex="-1"
						>
							<Check
								class={cn(
									'mr-2 h-4 w-4',
									isSelectedResource(resource) ? 'opacity-100' : 'opacity-0'
								)}
							/>
							{resource.label}
						</button>
					{/each}
				{/if}
			</div>
		</div>
	{/if}
</div>
