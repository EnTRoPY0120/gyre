<script lang="ts">
	import { untrack } from 'svelte';
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

	const PAGE_SIZE_OPTIONS = [10, 25, 50, 0] as const;

	// Virtual scroll constants
	// rowHeight is measured from the first rendered data row after mount;
	// 57 is the pre-mount fallback (py-4 top + py-4 bottom + ~25 px content).
	// All rows share the same structure so a single measurement is sufficient.
	const VIRTUAL_OVERSCAN = 3; // extra rows rendered above/below visible area

	// Pagination state
	let currentPage = $state(1);
	const itemsPerPage = $derived(preferences.itemsPerPage);
	const showAll = $derived(itemsPerPage === 0);

	// Selection state
	let selectedResourceIds = $state<Set<string>>(new Set());

	// Virtual scroll state
	let scrollTop = $state(0);
	let containerHeight = $state(480);
	let rowHeight = $state(57); // updated by measurement effect below
	let tbodyEl = $state<HTMLElement | null>(null);
	let scrollContainer = $state<HTMLElement | null>(null);

	const totalPages = $derived(showAll ? 0 : Math.ceil(resources.length / itemsPerPage));
	const paginatedResources = $derived(
		showAll ? [] : resources.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage)
	);

	// Virtual scroll derived values
	const visibleStart = $derived(
		showAll ? Math.max(0, Math.floor(scrollTop / rowHeight) - VIRTUAL_OVERSCAN) : 0
	);
	const visibleEnd = $derived(
		showAll
			? Math.min(
					resources.length,
					Math.ceil((scrollTop + containerHeight) / rowHeight) + VIRTUAL_OVERSCAN
				)
			: 0
	);
	const virtualRows = $derived(showAll ? resources.slice(visibleStart, visibleEnd) : []);
	const topSpacerHeight = $derived(showAll ? visibleStart * rowHeight : 0);
	const bottomSpacerHeight = $derived(
		showAll ? Math.max(0, resources.length - visibleEnd) * rowHeight : 0
	);

	// In virtual mode, selection targets all resources; in paginated mode, current page only
	const displayedRows = $derived(showAll ? resources : paginatedResources);
	const selectedResources = $derived(
		resources.filter((r) => selectedResourceIds.has(r.metadata.uid || ''))
	);
	const selectableDisplayedRows = $derived(displayedRows.filter((r) => !!r.metadata.uid));
	const allDisplayedSelected = $derived(
		selectableDisplayedRows.length > 0 &&
			selectableDisplayedRows.every((r) => selectedResourceIds.has(r.metadata.uid!))
	);
	const someDisplayedSelected = $derived(
		selectableDisplayedRows.some((r) => selectedResourceIds.has(r.metadata.uid!)) &&
			!allDisplayedSelected
	);

	function handleRowClick(resource: FluxResource, event: MouseEvent) {
		// Don't trigger row click if clicking checkbox
		const target = event.target as HTMLElement;
		if (
			(target instanceof HTMLInputElement && target.type === 'checkbox') ||
			target.closest('input[type="checkbox"]')
		) {
			return;
		}

		if (onRowClick) {
			onRowClick(resource);
		}
	}

	function toggleResourceSelection(resource: FluxResource) {
		const uid = resource.metadata.uid;
		if (!uid) return;
		const newSet = new Set(selectedResourceIds);

		if (newSet.has(uid)) {
			newSet.delete(uid);
		} else {
			newSet.add(uid);
		}

		selectedResourceIds = newSet;
	}

	function toggleSelectAll() {
		const targets = showAll ? resources : paginatedResources;
		if (allDisplayedSelected) {
			const newSet = new Set(selectedResourceIds);
			targets.forEach((r) => {
				if (!r.metadata.uid) return;
				newSet.delete(r.metadata.uid);
			});
			selectedResourceIds = newSet;
		} else {
			const newSet = new Set(selectedResourceIds);
			targets.forEach((r) => {
				if (!r.metadata.uid) return;
				newSet.add(r.metadata.uid);
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

	function handleScroll(e: Event) {
		if (showAll) {
			scrollTop = (e.target as HTMLElement).scrollTop;
		}
	}

	// Reset page when resources change (not applicable in virtual mode)
	$effect(() => {
		if (!showAll && currentPage > totalPages && totalPages > 0) {
			currentPage = totalPages;
		}
	});

	// Measure actual row stride from the vertical distance between two consecutive
	// rendered rows so that divide-y borders are included in the calculation.
	// Falls back to offsetHeight when only one row is visible.
	$effect(() => {
		void resources; // re-measure whenever the resource list changes
		if (!tbodyEl) return;
		const rows = tbodyEl.querySelectorAll<HTMLElement>('tr.group');
		if (rows.length >= 2) {
			rowHeight = rows[1].offsetTop - rows[0].offsetTop;
		} else if (rows.length === 1 && rows[0].offsetHeight > 0) {
			rowHeight = rows[0].offsetHeight;
		}
	});

	// Drop selections for UIDs that no longer exist; preserve everything else.
	$effect(() => {
		const currentUids = new Set(resources.map((r) => r.metadata.uid || ''));
		const prev = untrack(() => selectedResourceIds);
		if (prev.size === 0) return;
		const filtered = new Set([...prev].filter((id) => currentUids.has(id)));
		if (filtered.size !== prev.size) {
			selectedResourceIds = filtered;
		}
	});
</script>

{#snippet tableRow(resource: FluxResource)}
	<tr
		class="group cursor-pointer transition-colors hover:bg-accent/40 hover:text-accent-foreground"
		onclick={(e) => handleRowClick(resource, e)}
	>
		<td class="px-4 py-4">
			<input
				type="checkbox"
				checked={!!resource.metadata.uid && selectedResourceIds.has(resource.metadata.uid)}
				onchange={() => toggleResourceSelection(resource)}
				onclick={(e) => e.stopPropagation()}
				class="size-4 cursor-pointer rounded border-border bg-background text-primary focus:ring-2 focus:ring-primary focus:ring-offset-0"
				aria-label={`Select ${resource.metadata.name}`}
			/>
		</td>
		<td class="px-6 py-4 whitespace-nowrap transition-all duration-200 group-hover:pl-7">
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
			<div class="truncate text-xs text-muted-foreground/80 group-hover:text-muted-foreground">
				{getReadyMessage(resource)}
			</div>
		</td>
	</tr>
{/snippet}

<div class="flex flex-col gap-4">
	<div
		class="rounded-xl border border-border bg-card/60 shadow-sm backdrop-blur-sm"
	>
		<div
			class="scrollbar-thin overflow-x-auto {showAll
				? 'max-h-[480px] overflow-y-auto'
				: 'overflow-hidden'}"
			onscroll={handleScroll}
			bind:clientHeight={containerHeight}
			bind:this={scrollContainer}
		>
			<table class="w-full min-w-[700px] text-left text-sm">
				<thead
					class="{showAll
						? 'sticky top-0 z-10 shadow-[0_1px_0_0_hsl(var(--border))]'
						: ''} border-b border-border bg-card"
				>
					<tr>
						<th class="w-12 px-4 py-4">
							<input
								type="checkbox"
								checked={allDisplayedSelected}
								indeterminate={someDisplayedSelected}
								onchange={toggleSelectAll}
								class="size-4 cursor-pointer rounded border-border bg-background text-primary focus:ring-2 focus:ring-primary focus:ring-offset-0"
								aria-label={showAll
									? 'Select all resources'
									: 'Select all resources on current page'}
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
				<tbody class="divide-y divide-border/40" bind:this={tbodyEl}>
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
					{:else if showAll}
						{#if topSpacerHeight > 0}
							<tr style="height: {topSpacerHeight}px" aria-hidden="true">
								<td colspan={showNamespace ? 6 : 5}></td>
							</tr>
						{/if}
						{#each virtualRows as resource (resource.metadata.uid || '')}
							{@render tableRow(resource)}
						{/each}
						{#if bottomSpacerHeight > 0}
							<tr style="height: {bottomSpacerHeight}px" aria-hidden="true">
								<td colspan={showNamespace ? 6 : 5}></td>
							</tr>
						{/if}
					{:else}
						{#each paginatedResources as resource (resource.metadata.uid || '')}
							{@render tableRow(resource)}
						{/each}
					{/if}
				</tbody>
			</table>
		</div>
	</div>

	{#if resources.length > PAGE_SIZE_OPTIONS[0]}
		<div class="flex items-center justify-between px-2">
			<div class="flex items-center gap-3">
				{#if showAll}
					<div class="text-xs text-muted-foreground">
						Showing all <span class="font-medium">{resources.length}</span> results
					</div>
				{:else}
					<div class="text-xs text-muted-foreground">
						Showing <span class="font-medium"
							>{Math.min((currentPage - 1) * itemsPerPage + 1, resources.length)}</span
						>
						to
						<span class="font-medium">{Math.min(currentPage * itemsPerPage, resources.length)}</span>
						of <span class="font-medium">{resources.length}</span> results
					</div>
				{/if}
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
								if (size === 0) {
									scrollTop = 0;
									if (scrollContainer) scrollContainer.scrollTop = 0;
								}
							}}
							aria-pressed={itemsPerPage === size}
						>
							{size === 0 ? 'All' : size}
						</button>
					{/each}
				</div>
			</div>
			{#if !showAll && totalPages > 1}
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
