<script lang="ts">
	import type { FluxResource } from '$lib/types/flux';
	import { toast } from 'svelte-sonner';
	import { getCsrfToken } from '$lib/utils/csrf';
	import BulkActionsDeleteDialog from './BulkActionsDeleteDialog.svelte';
	import BulkActionsProcessingOverlay from './BulkActionsProcessingOverlay.svelte';
	import BulkActionsRetryPanel from './BulkActionsRetryPanel.svelte';
	import BulkActionsSelectionBar from './BulkActionsSelectionBar.svelte';
	import {
		partitionBatchOperationResult,
		toBatchResourceItem,
		type BatchAction,
		type BatchOperationResponse,
		type FailedBatchResource
	} from './bulk-actions';

	interface Props {
		selectedResources: FluxResource[];
		onClearSelection: () => void;
		onSetSelection: (resources: FluxResource[]) => void;
		onOperationComplete?: () => void;
	}

	let { selectedResources, onClearSelection, onSetSelection, onOperationComplete }: Props = $props();

	let isProcessing = $state(false);
	let showDeleteDialog = $state(false);
	let currentOperation = $state<BatchAction | null>(null);
	let lastBatchResult = $state<{
		action: BatchAction;
		failedResources: FailedBatchResource[];
	} | null>(null);

	const pastTenseMap: Record<BatchAction, string> = {
		suspend: 'suspended',
		resume: 'resumed',
		reconcile: 'reconciled',
		delete: 'deleted'
	};

	function getResourceKey(resource: FluxResource): string {
		return `${resource.kind || ''}:${resource.metadata.namespace || ''}:${resource.metadata.name || ''}`;
	}

	function selectionMatchesFailedResources(
		selection: FluxResource[],
		failedResources: FailedBatchResource[]
	): boolean {
		if (selection.length !== failedResources.length) return false;

		const selectedKeys = new Set(selection.map((resource) => getResourceKey(resource)));
		return failedResources.every((failure) => selectedKeys.has(getResourceKey(failure.originalResource)));
	}

	$effect(() => {
		if (!lastBatchResult) return;

		if (!selectionMatchesFailedResources(selectedResources, lastBatchResult.failedResources)) {
			lastBatchResult = null;
		}
	});

	async function performBatchOperation(
		action: BatchAction,
		resourcesToOperateOn: FluxResource[] = selectedResources
	) {
		if (resourcesToOperateOn.length === 0) return;

		isProcessing = true;
		currentOperation = action;
		const resources = resourcesToOperateOn.map((resource) => toBatchResourceItem(resource));

		try {
			const response = await fetch(`/api/v1/flux/batch/${action}`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': getCsrfToken() },
				body: JSON.stringify({ resources })
			});

			if (!response.ok) throw new Error(`Failed to ${action} resources`);

			const data: BatchOperationResponse = await response.json();
			const result = partitionBatchOperationResult(resourcesToOperateOn, data);

			if (result.allSucceeded) {
				toast.success(`Successfully ${pastTenseMap[action]} ${data.summary.successful} resource(s)`, {
					description: 'All operations completed successfully'
				});
				lastBatchResult = null;
				onClearSelection();
			} else if (result.allFailed) {
				toast.error(`Failed to ${action} resources`, {
					description: `All ${data.summary.failed} operations failed`
				});
				lastBatchResult = { action, failedResources: result.failedResources };
				onSetSelection(result.nextSelectedResources);
			} else {
				toast.warning(`Partially completed ${action} operation`, {
					description: `${data.summary.successful} succeeded, ${data.summary.failed} failed`
				});
				lastBatchResult = { action, failedResources: result.failedResources };
				onSetSelection(result.nextSelectedResources);
			}

			if (onOperationComplete) onOperationComplete();
		} catch (err) {
			toast.error(`Error performing ${action} operation`, {
				description: err instanceof Error ? err.message : 'Unknown error'
			});
		} finally {
			isProcessing = false;
			currentOperation = null;
		}
	}

	async function handleSuspend() {
		await performBatchOperation('suspend');
	}

	async function handleResume() {
		await performBatchOperation('resume');
	}

	async function handleReconcile() {
		await performBatchOperation('reconcile');
	}

	async function handleRetryFailed() {
		if (!lastBatchResult || lastBatchResult.failedResources.length === 0) return;

		const resourcesToRetry = lastBatchResult.failedResources.map((failure) => failure.originalResource);
		await performBatchOperation(lastBatchResult.action, resourcesToRetry);
	}

	function handleDeleteClick() {
		showDeleteDialog = true;
	}

	async function handleDeleteConfirm() {
		showDeleteDialog = false;
		await performBatchOperation('delete');
	}

	const selectedCount = $derived(selectedResources.length);
</script>

<div
	class="fixed bottom-6 left-1/2 z-50 w-[min(92vw,56rem)] -translate-x-1/2 transform rounded-xl border border-border bg-card/95 px-6 py-4 shadow-2xl backdrop-blur-lg transition-all duration-300"
>
	<div class="space-y-4">
		<BulkActionsSelectionBar
			{selectedCount}
			{isProcessing}
			{currentOperation}
			onClearSelection={onClearSelection}
			onSuspend={handleSuspend}
			onResume={handleResume}
			onReconcile={handleReconcile}
			onDelete={handleDeleteClick}
		/>

		{#if lastBatchResult && lastBatchResult.failedResources.length > 0}
			<BulkActionsRetryPanel
				{lastBatchResult}
				{isProcessing}
				{currentOperation}
				onRetryFailed={handleRetryFailed}
			/>
		{/if}
	</div>
</div>

<BulkActionsDeleteDialog
	bind:open={showDeleteDialog}
		{selectedCount}
	onConfirm={handleDeleteConfirm}
/>

{#if isProcessing}
	<BulkActionsProcessingOverlay {currentOperation} />
{/if}
