<script lang="ts">
	import type { FluxResource } from '$lib/types/flux';
	import { formatTimestamp } from '$lib/utils/flux';
	import StatusBadge from './StatusBadge.svelte';
	import BulkActionsToolbar from './BulkActionsToolbar.svelte';
	import { PackageX, ChevronLeft, ChevronRight } from 'lucide-svelte';
	import { preferences } from '$lib/stores/preferences.svelte';

	interface Props {
		resources: FluxResource[];
		showNamespace?: boolean;
		onRowClick?: (resource: FluxResource) => void;
		onOperationComplete?: () => void;
	}

	let { resources, showNamespace = true, onRowClick, onOperationComplete }: Props = $props();

	const PAGE_SIZE_OPTIONS = [10, 25, 50] as const;

	// Pagination state
	let currentPage = $state(1);
	const itemsPerPage = $derived(preferences.itemsPerPage);

	// Selection state
	let selectedResourceIds = $state<Set<string>>(new Set());

	const totalPages = $derived(Math.ceil(resources.length / itemsPerPage));
	const paginatedResources = $derived(
		resources.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage)
	);
	const selectedResources = $derived(
		resources.filter((r) => selectedResourceIds.has(r.metadata.uid || ''))
	);
	const allCurrentPageSelected = $derived(
		paginatedResources.length > 0 &&
			paginatedResources.every((r) => selectedResourceIds.has(r.metadata.uid || ''))
	);
	const someCurrentPageSelected = $derived(
		paginatedResources.some((r) => selectedResourceIds.has(r.metadata.uid || '')) &&
			!allCurrentPageSelected
	);

	function handleRowClick(resource: FluxResource, event: MouseEvent) {
		// Don't trigger row click if clicking checkbox
		const target = event.target as HTMLElement;
		if (
			target instanceof HTMLInputElement &&
			target.type === 'checkbox' ||
			target.closest('input[type="checkbox"]')
		) {
			return;
		}

		if (onRowClick) {
			onRowClick(resource);
		}
	}

	function toggleResourceSelection(resource: FluxResource) {
		const uid = resource.metadata.uid || '';
		const newSet = new Set(selectedResourceIds);

		if (newSet.has(uid)) {
			newSet.delete(uid);
		} else {
			newSet.add(uid);
		}

		selectedResourceIds = newSet;
	}

	function toggleSelectAll() {
		if (allCurrentPageSelected) {
			// Deselect all on current page
			const newSet = new Set(selectedResourceIds);
			paginatedResources.forEach((r) => {
				newSet.delete(r.metadata.uid || '');
			});
			selectedResourceIds = newSet;
		} else {
			// Select all on current page
			const newSet = new Set(selectedResourceIds);
			paginatedResources.forEach((r) => {
				newSet.add(r.metadata.uid || '');
			});
			selectedResourceIds = newSet;
		}
	}

	function clearSelection() {
		selectedResourceIds = new Set();
	}

	function getReadyMessage(resource: FluxResource): string {
		const ready = resource.status?.conditions?.find((c) => c.type === 'Ready');
		return ready?.message || '-';
	}

	// Reset page when resources change
	$effect(() => {
		if (currentPage > totalPages && totalPages > 0) {
			currentPage = totalPages;
		}
	});

	// Clear selection when resources change
	$effect(() => {
		void resources;
		selectedResourceIds = new Set();
	});
</script>

<div class="flex flex-col gap-4">
	<div
		class="overflow-hidden rounded-xl border border-border bg-card/60 shadow-sm backdrop-blur-sm"
	>
		<div class="scrollbar-thin overflow-x-auto">
			<table class="w-full min-w-[700px] text-left text-sm">
				<thead class="border-b border-border bg-muted/30">
					<tr>
						<th class="w-12 px-4 py-4">
							<input
								type="checkbox"
								checked={allCurrentPageSelected}
								indeterminate={someCurrentPageSelected}
								onchange={toggleSelectAll}
								class="size-4 cursor-pointer rounded border-border bg-background text-primary focus:ring-2 focus:ring-primary focus:ring-offset-0"
								aria-label="Select all resources on current page"
							/>
						</th>
						<th
							class="px-6 py-4 font-display text-[10px] font-black tracking-[0.2em] text-muted-foreground/80 uppercase"
						>
							Resource
						</th>
						{#if showNamespace}
							<th
								class="px-6 py-4 font-display text-[10px] font-black tracking-[0.2em] text-muted-foreground/80 uppercase"
							>
								Namespace
							</th>
						{/if}
						<th
							class="px-6 py-4 font-display text-[10px] font-black tracking-[0.2em] text-muted-foreground/80 uppercase"
						>
							Status
						</th>
						<th
							class="px-6 py-4 font-display text-[10px] font-black tracking-[0.2em] text-muted-foreground/80 uppercase"
						>
							Age
						</th>
						<th
							class="px-6 py-4 font-display text-[10px] font-black tracking-[0.2em] text-muted-foreground/80 uppercase"
						>
							Message
						</th>
					</tr>
				</thead>
				<tbody class="divide-y divide-border/40">
					{#if resources.length === 0}
						<tr>
							<td
								colspan={showNamespace ? 6 : 5}
								class="px-6 py-12 text-center text-sm text-muted-foreground"
							>
								<div class="flex flex-col items-center gap-3">
									<PackageX size={40} class="text-muted-foreground/40" />
									<p class="font-medium">No resources found</p>
									<p class="text-xs text-muted-foreground/60">
										Try adjusting your filters or checking connection.
									</p>
								</div>
							</td>
						</tr>
					{:else}
						{#each paginatedResources as resource (resource.metadata.uid)}
							<tr
								class="group cursor-pointer transition-colors hover:bg-accent/40 hover:text-accent-foreground"
								onclick={(e) => handleRowClick(resource, e)}
							>
								<td class="px-4 py-4">
									<input
										type="checkbox"
										checked={selectedResourceIds.has(resource.metadata.uid || '')}
										onchange={() => toggleResourceSelection(resource)}
										onclick={(e) => e.stopPropagation()}
										class="size-4 cursor-pointer rounded border-border bg-background text-primary focus:ring-2 focus:ring-primary focus:ring-offset-0"
										aria-label={`Select ${resource.metadata.name}`}
									/>
								</td>
								<td
									class="px-6 py-4 whitespace-nowrap transition-all duration-200 group-hover:pl-7"
								>
									<div
										class="font-mono text-[13px] font-medium text-foreground transition-colors group-hover:text-primary"
									>
										{resource.metadata.name}
									</div>
								</td>
								{#if showNamespace}
									<td class="px-6 py-4 whitespace-nowrap">
										<div
											class="inline-flex items-center rounded-md border border-transparent bg-secondary/40 px-2 py-1 text-[11px] font-medium text-muted-foreground transition-all group-hover:border-border/50"
										>
											{resource.metadata.namespace || '-'}
										</div>
									</td>
								{/if}
								<td class="px-6 py-4 whitespace-nowrap">
									<StatusBadge
										conditions={resource.status?.conditions}
										suspended={resource.spec?.suspend as boolean | undefined}
										observedGeneration={resource.status?.observedGeneration}
										generation={resource.metadata?.generation}
										size="sm"
									/>
								</td>
								<td class="px-6 py-4 whitespace-nowrap">
									<div class="font-mono text-xs font-medium text-muted-foreground">
										{formatTimestamp(resource.metadata.creationTimestamp)}
									</div>
								</td>
								<td class="max-w-[300px] px-6 py-4">
									<div
										class="truncate text-xs text-muted-foreground/80 group-hover:text-muted-foreground"
									>
										{getReadyMessage(resource)}
									</div>
								</td>
							</tr>
						{/each}
					{/if}
				</tbody>
			</table>
		</div>
	</div>

	{#if resources.length > PAGE_SIZE_OPTIONS[0]}
		<div class="flex items-center justify-between px-2">
			<div class="flex items-center gap-3">
				<div class="text-xs text-muted-foreground">
					Showing <span class="font-medium"
						>{Math.min((currentPage - 1) * itemsPerPage + 1, resources.length)}</span
					>
					to
					<span class="font-medium">{Math.min(currentPage * itemsPerPage, resources.length)}</span>
					of <span class="font-medium">{resources.length}</span> results
				</div>
				<div class="flex items-center gap-1.5">
					<span class="text-xs text-muted-foreground">Per page:</span>
					{#each PAGE_SIZE_OPTIONS as size (size)}
						<button
							class="rounded px-2 py-0.5 text-xs transition-colors {itemsPerPage === size
								? 'bg-primary text-primary-foreground'
								: 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'}"
							onclick={() => {
								preferences.setItemsPerPage(size);
								currentPage = 1;
							}}
							aria-pressed={itemsPerPage === size}
						>
							{size}
						</button>
					{/each}
				</div>
			</div>
			{#if totalPages > 1}
				<div class="flex items-center gap-2">
					<button
						class="flex size-8 items-center justify-center rounded-md border border-border bg-card/60 text-muted-foreground transition-all hover:bg-accent disabled:opacity-30"
						onclick={() => (currentPage = Math.max(1, currentPage - 1))}
						disabled={currentPage === 1}
						aria-label="Previous page"
					>
						<ChevronLeft size={16} />
					</button>
					<div class="text-xs font-medium">
						Page {currentPage} of {totalPages}
					</div>
					<button
						class="flex size-8 items-center justify-center rounded-md border border-border bg-card/60 text-muted-foreground transition-all hover:bg-accent disabled:opacity-30"
						onclick={() => (currentPage = Math.min(totalPages, currentPage + 1))}
						disabled={currentPage === totalPages}
						aria-label="Next page"
					>
						<ChevronRight size={16} />
					</button>
				</div>
			{/if}
		</div>
	{/if}

	{#if selectedResources.length > 0}
		<BulkActionsToolbar
			{selectedResources}
			onClearSelection={clearSelection}
			{onOperationComplete}
		/>
	{/if}
</div>
