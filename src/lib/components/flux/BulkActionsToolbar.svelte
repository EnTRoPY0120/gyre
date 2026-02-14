<script lang="ts">
	import type { FluxResource } from '$lib/types/flux';
	import { Button } from '$lib/components/ui/button';
	import {
		AlertDialog,
		AlertDialogAction,
		AlertDialogCancel,
		AlertDialogContent,
		AlertDialogDescription,
		AlertDialogFooter,
		AlertDialogHeader,
		AlertDialogTitle
	} from '$lib/components/ui/alert-dialog';
	import { Pause, Play, RefreshCw, Trash2, X } from 'lucide-svelte';
	import { toast } from 'svelte-sonner';

	interface Props {
		selectedResources: FluxResource[];
		onClearSelection: () => void;
		onOperationComplete?: () => void;
	}

	let { selectedResources, onClearSelection, onOperationComplete }: Props = $props();

	let isProcessing = $state(false);
	let showDeleteDialog = $state(false);
	let currentOperation = $state<string | null>(null);

	interface BatchResourceItem {
		type: string;
		namespace: string;
		name: string;
	}

	interface BatchOperationResult {
		resource: BatchResourceItem;
		success: boolean;
		message: string;
	}

	interface BatchOperationResponse {
		results: BatchOperationResult[];
		summary: {
			total: number;
			successful: number;
			failed: number;
		};
	}

	function getResourceType(resource: FluxResource): string {
		return resource.kind || '';
	}

	async function performBatchOperation(action: 'suspend' | 'resume' | 'reconcile' | 'delete') {
		if (selectedResources.length === 0) return;

		isProcessing = true;
		currentOperation = action;

		const resources = selectedResources.map((r) => ({
			type: getResourceType(r),
			namespace: r.metadata.namespace || '',
			name: r.metadata.name || ''
		}));

		try {
			const response = await fetch(`/api/flux/batch/${action}`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ resources })
			});

			if (!response.ok) {
				throw new Error(`Failed to ${action} resources`);
			}

			const data: BatchOperationResponse = await response.json();

			// Show results
			if (data.summary.failed === 0) {
				toast.success(`Successfully ${action}ed ${data.summary.successful} resource(s)`, {
					description: `All operations completed successfully`
				});
			} else if (data.summary.successful === 0) {
				toast.error(`Failed to ${action} resources`, {
					description: `All ${data.summary.failed} operations failed`
				});
			} else {
				toast.warning(`Partially completed ${action} operation`, {
					description: `${data.summary.successful} succeeded, ${data.summary.failed} failed`
				});
			}

			// Clear selection and notify parent
			onClearSelection();
			if (onOperationComplete) {
				onOperationComplete();
			}
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
	class="fixed bottom-6 left-1/2 z-50 -translate-x-1/2 transform rounded-xl border border-border bg-card/95 px-6 py-4 shadow-2xl backdrop-blur-lg transition-all duration-300"
>
	<div class="flex items-center gap-4">
		<div class="flex items-center gap-2 border-r border-border pr-4">
			<span class="font-mono text-sm font-medium">
				{selectedCount}
				{selectedCount === 1 ? 'resource' : 'resources'} selected
			</span>
			<Button
				variant="ghost"
				size="sm"
				onclick={onClearSelection}
				disabled={isProcessing}
				aria-label="Clear selection"
			>
				<X size={16} />
			</Button>
		</div>

		<div class="flex items-center gap-2">
			<Button
				variant="outline"
				size="sm"
				onclick={handleSuspend}
				disabled={isProcessing}
				aria-label="Suspend selected resources"
			>
				<Pause size={16} />
				<span class="ml-2">Suspend</span>
			</Button>

			<Button
				variant="outline"
				size="sm"
				onclick={handleResume}
				disabled={isProcessing}
				aria-label="Resume selected resources"
			>
				<Play size={16} />
				<span class="ml-2">Resume</span>
			</Button>

			<Button
				variant="outline"
				size="sm"
				onclick={handleReconcile}
				disabled={isProcessing}
				aria-label="Reconcile selected resources"
			>
				<RefreshCw size={16} class={currentOperation === 'reconcile' ? 'animate-spin' : ''} />
				<span class="ml-2">Reconcile</span>
			</Button>

			<Button
				variant="destructive"
				size="sm"
				onclick={handleDeleteClick}
				disabled={isProcessing}
				aria-label="Delete selected resources"
			>
				<Trash2 size={16} />
				<span class="ml-2">Delete</span>
			</Button>
		</div>
	</div>
</div>

<AlertDialog bind:open={showDeleteDialog}>
	<AlertDialogContent>
		<AlertDialogHeader>
			<AlertDialogTitle>Delete {selectedCount} resource(s)?</AlertDialogTitle>
			<AlertDialogDescription>
				This action cannot be undone. This will permanently delete the selected FluxCD resources
				from your cluster.
			</AlertDialogDescription>
		</AlertDialogHeader>
		<AlertDialogFooter>
			<AlertDialogCancel>Cancel</AlertDialogCancel>
			<AlertDialogAction onclick={handleDeleteConfirm}>Delete</AlertDialogAction>
		</AlertDialogFooter>
	</AlertDialogContent>
</AlertDialog>

{#if isProcessing}
	<div
		class="fixed inset-0 z-40 flex items-center justify-center bg-background/50 backdrop-blur-sm"
	>
		<div class="rounded-lg border border-border bg-card p-6 shadow-xl">
			<div class="flex items-center gap-3">
				<RefreshCw size={20} class="animate-spin text-primary" />
				<p class="text-sm font-medium">
					Processing {currentOperation} operation...
				</p>
			</div>
		</div>
	</div>
{/if}
