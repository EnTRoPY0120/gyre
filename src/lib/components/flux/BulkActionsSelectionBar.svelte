<script lang="ts">
	import { Button } from '$lib/components/ui/button';
import { Pause, Play, RefreshCw, Trash2, X } from '@lucide/svelte';
import type { BatchAction } from './bulk-actions';

	let {
		selectedCount,
		isProcessing,
		currentOperation,
		onClearSelection,
		onSuspend,
		onResume,
		onReconcile,
		onDelete
	}: {
		selectedCount: number;
		isProcessing: boolean;
		currentOperation: BatchAction | null;
		onClearSelection: () => void;
		onSuspend: () => void | Promise<void>;
		onResume: () => void | Promise<void>;
		onReconcile: () => void | Promise<void>;
		onDelete: () => void;
	} = $props();
</script>

<div class="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
	<div class="flex items-center gap-2 lg:border-r lg:border-border lg:pr-4">
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

	<div class="flex flex-wrap items-center gap-2">
		<Button
			variant="outline"
			size="sm"
			onclick={onSuspend}
			disabled={isProcessing}
			aria-label="Suspend selected resources"
		>
			<Pause size={16} />
			<span class="ml-2">Suspend</span>
		</Button>

		<Button
			variant="outline"
			size="sm"
			onclick={onResume}
			disabled={isProcessing}
			aria-label="Resume selected resources"
		>
			<Play size={16} />
			<span class="ml-2">Resume</span>
		</Button>

		<Button
			variant="outline"
			size="sm"
			onclick={onReconcile}
			disabled={isProcessing}
			aria-label="Reconcile selected resources"
		>
			<RefreshCw size={16} class={currentOperation === 'reconcile' ? 'animate-spin' : ''} />
			<span class="ml-2">Reconcile</span>
		</Button>

		<Button
			variant="destructive"
			size="sm"
			onclick={onDelete}
			disabled={isProcessing}
			aria-label="Delete selected resources"
		>
			<Trash2 size={16} />
			<span class="ml-2">Delete</span>
		</Button>
	</div>
</div>
