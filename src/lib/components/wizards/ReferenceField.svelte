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

	function isAbortError(error: unknown): boolean {
		return error instanceof DOMException
			? error.name === 'AbortError'
			: error instanceof Error && error.name === 'AbortError';
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
			const includeKindInLabel = activeReferenceTypes.length > 1;
			const existingResourcesByKind = new Map<string, ReferenceOption[]>();
			for (const resource of resources) {
				const kindResources = existingResourcesByKind.get(resource.kind) ?? [];
				kindResources.push(resource);
				existingResourcesByKind.set(resource.kind, kindResources);
			}

			const fetchTargets = activeReferenceTypes
				.filter((kind) => kind !== '*')
				.map((kind) => ({
					kind,
					promise: (async () => {
					const routeType = resolveResourceRouteType(kind);
					if (!routeType) {
						throw new Error(`Unknown reference type: ${kind}`);
					}

					const res = await fetchWithRetry(
						`/api/v1/flux/${routeType}`,
						{ signal: controller.signal },
						{ maxRetries: 0 }
					);
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
					})()
				}));

			const results = await Promise.allSettled(fetchTargets.map((target) => target.promise));
			const freshResourcesByKind = new Map<string, ReferenceOption[]>();
			let sawFailure = false;

			results.forEach((result, index) => {
				if (currentFetchId !== fetchRequestId) return;

				const { kind } = fetchTargets[index];

				if (result.status === 'fulfilled') {
					freshResourcesByKind.set(kind, result.value);
				} else if (!isAbortError(result.reason)) {
					sawFailure = true;
				} else {
					return;
				}

				if (result.status === 'rejected' && !isAbortError(result.reason)) {
					logger.error(
						result.reason instanceof Error ? result.reason : new Error(String(result.reason)),
						'Failed to fetch resources:'
					);
				}
			});

			if (currentFetchId === fetchRequestId) {
				const allKindsSucceeded = fetchTargets.every(({ kind }) => freshResourcesByKind.has(kind));
				const mergedResources = new Map<string, ReferenceOption>();

				for (const { kind } of fetchTargets) {
					const kindResources = freshResourcesByKind.get(kind) ?? existingResourcesByKind.get(kind) ?? [];
					for (const resource of kindResources) {
						mergedResources.set(resource.key, resource);
					}
				}

				if (allKindsSucceeded) {
					resources = Array.from(mergedResources.values()).sort((a, b) =>
						a.label.localeCompare(b.label)
					);
				} else if (!sawFailure) {
					resources = Array.from(mergedResources.values()).sort((a, b) =>
						a.label.localeCompare(b.label)
					);
				} else if (mergedResources.size > 0) {
					resources = Array.from(mergedResources.values()).sort((a, b) =>
						a.label.localeCompare(b.label)
					);
				}
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
