<script lang="ts">
	import { untrack } from 'svelte';
	import { preferences, ITEMS_PER_PAGE_OPTIONS } from '$lib/stores/preferences.svelte';
	import type { FluxResource } from '$lib/types/flux';
	import BulkActionsToolbar from './BulkActionsToolbar.svelte';
	import ResourceTableBody from './ResourceTableBody.svelte';
import ResourceTableHeader from './ResourceTableHeader.svelte';
import ResourceTablePagination from './ResourceTablePagination.svelte';
import { isResourceSelectionTarget } from './resource-row-click';

	const MIN_PAGE_SIZE = Math.min(...ITEMS_PER_PAGE_OPTIONS.filter((size) => size > 0));

	interface Props {
		resources: FluxResource[];
		showNamespace?: boolean;
		onRowClick?: (resource: FluxResource) => void;
		onOperationComplete?: () => void;
	}

	let { resources, showNamespace = true, onRowClick, onOperationComplete }: Props = $props();

	const VIRTUAL_OVERSCAN = 3;
	let currentPage = $state(1);
	const itemsPerPage = $derived(preferences.itemsPerPage);
	const showAll = $derived(itemsPerPage === 0);
	let selectedResourceIds = $state<Set<string>>(new Set());
	let scrollTop = $state(0);
	let containerHeight = $state(480);
	let rowHeight = $state(57);
	let tbodyEl = $state<HTMLElement | null>(null);
	let scrollContainer = $state<HTMLElement | null>(null);

	const totalPages = $derived(showAll ? 0 : Math.ceil(resources.length / itemsPerPage));
	const paginatedResources = $derived(
		showAll ? [] : resources.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage)
	);
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
	const displayedRows = $derived(showAll ? resources : paginatedResources);
	const selectedResources = $derived(
		resources.filter((resource) => selectedResourceIds.has(resource.metadata.uid || ''))
	);
	const selectableDisplayedRows = $derived(displayedRows.filter((resource) => !!resource.metadata.uid));
	const allDisplayedSelected = $derived(
		selectableDisplayedRows.length > 0 &&
			selectableDisplayedRows.every((resource) =>
				selectedResourceIds.has(resource.metadata.uid!)
			)
	);
	const someDisplayedSelected = $derived(
		selectableDisplayedRows.some((resource) => selectedResourceIds.has(resource.metadata.uid!)) &&
			!allDisplayedSelected
	);

	function handleRowClick(resource: FluxResource, event: MouseEvent) {
		if (isResourceSelectionTarget(event.target)) return;
		onRowClick?.(resource);
	}

	function toggleResourceSelection(resource: FluxResource) {
		const uid = resource.metadata.uid;
		if (!uid) return;
		const nextSelection = new Set(selectedResourceIds);
		if (nextSelection.has(uid)) nextSelection.delete(uid);
		else nextSelection.add(uid);
		selectedResourceIds = nextSelection;
	}

	function toggleSelectAll() {
		const targets = showAll ? resources : paginatedResources;
		const nextSelection = new Set(selectedResourceIds);
		if (allDisplayedSelected) {
			targets.forEach((resource) => {
				if (resource.metadata.uid) nextSelection.delete(resource.metadata.uid);
			});
		} else {
			targets.forEach((resource) => {
				if (resource.metadata.uid) nextSelection.add(resource.metadata.uid);
			});
		}
		selectedResourceIds = nextSelection;
	}

	function clearSelection() {
		selectedResourceIds = new Set();
	}

	function setSelection(nextResources: FluxResource[]) {
		selectedResourceIds = new Set(
			nextResources
				.map((resource) => resource.metadata.uid)
				.filter((uid): uid is string => Boolean(uid))
		);
	}

	function handleScroll(event: Event) {
		if (showAll) scrollTop = (event.target as HTMLElement).scrollTop;
	}

	function handleItemsPerPageChange(size: number) {
		currentPage = 1;
		if (size === 0) {
			scrollTop = 0;
			if (scrollContainer) scrollContainer.scrollTop = 0;
		}
	}

	$effect(() => {
		if (!showAll && currentPage > totalPages && totalPages > 0) currentPage = totalPages;
	});

	$effect(() => {
		void resources;
		if (!tbodyEl) return;
		const rows = tbodyEl.querySelectorAll<HTMLElement>('tr.group');
		if (rows.length >= 2) rowHeight = rows[1].offsetTop - rows[0].offsetTop;
		else if (rows.length === 1 && rows[0].offsetHeight > 0) rowHeight = rows[0].offsetHeight;
	});

	$effect(() => {
		const currentUids = new Set(resources.map((resource) => resource.metadata.uid || ''));
		const previousSelection = untrack(() => selectedResourceIds);
		if (previousSelection.size === 0) return;
		const filteredSelection = new Set(
			[...previousSelection].filter((id) => currentUids.has(id))
		);
		if (filteredSelection.size !== previousSelection.size) {
			selectedResourceIds = filteredSelection;
		}
	});
</script>

<div class="flex flex-col gap-4">
	<div class="rounded-xl border border-border bg-card/60 shadow-sm backdrop-blur-sm">
		<div
			class="scrollbar-thin overflow-x-auto {showAll ? 'max-h-[480px] overflow-y-auto' : 'overflow-hidden'}"
			onscroll={handleScroll}
			bind:clientHeight={containerHeight}
			bind:this={scrollContainer}
		>
			<table class="w-full min-w-[700px] text-left text-sm">
				<ResourceTableHeader
					{showAll}
					{showNamespace}
					{allDisplayedSelected}
					{someDisplayedSelected}
					onToggleSelectAll={toggleSelectAll}
				/>
				<ResourceTableBody
					{resources}
					{showAll}
					{showNamespace}
					{virtualRows}
					{paginatedResources}
					{topSpacerHeight}
					{bottomSpacerHeight}
					{selectedResourceIds}
					bind:tbodyEl
					onRowClick={handleRowClick}
					onToggleSelection={toggleResourceSelection}
				/>
			</table>
		</div>
	</div>

	<ResourceTablePagination
		resourceCount={resources.length}
		{showAll}
		{itemsPerPage}
		{currentPage}
		{totalPages}
		onPageChange={(page) => (currentPage = page)}
		onItemsPerPageChange={handleItemsPerPageChange}
	/>

	{#if selectedResources.length > 0}
		<BulkActionsToolbar
			{selectedResources}
			onClearSelection={clearSelection}
			onSetSelection={setSelection}
			{onOperationComplete}
		/>
	{/if}
</div>
