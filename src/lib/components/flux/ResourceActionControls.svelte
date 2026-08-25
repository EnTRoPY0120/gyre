<script lang="ts">
	import { Button } from '$lib/components/ui/button';
	import { Loader2, Pause, Pencil, Play, RefreshCw, Trash2 } from '@lucide/svelte';
	import type { ActionFeedbackTone, ResourceAction } from './action-feedback';
	import ResourceActionPermission from './ResourceActionPermission.svelte';

	let {
		canWrite,
		isLoading,
		isSuspended,
		feedback,
		onAction,
		onEdit,
		onSuspend,
		onDelete
	}: {
		canWrite: boolean;
		isLoading: boolean;
		isSuspended: boolean;
		feedback: { tone: ActionFeedbackTone; message: string } | null;
		onAction: (action: ResourceAction) => void;
		onEdit: () => void;
		onSuspend: () => void;
		onDelete: () => void;
	} = $props();
</script>

<div class="flex items-center gap-2">
	{#if feedback}
		<span
			role="alert"
			aria-live="assertive"
			class="animate-in fade-in slide-in-from-right-2 text-sm {feedback.tone === 'warning'
				? 'text-amber-600'
				: 'text-red-600'}"
		>
			{feedback.message}
		</span>
	{/if}

	{#snippet primaryActions()}
	<ResourceActionPermission {canWrite} action="edit">
		<Button
			variant="outline"
			size="sm"
			disabled={!canWrite}
			onclick={onEdit}
			class={!canWrite ? 'pointer-events-none' : ''}
			aria-label="Edit"
		>
			<Pencil class="h-4 w-4 md:mr-2" />
			<span class="hidden md:inline">Edit</span>
		</Button>
	</ResourceActionPermission>

	<ResourceActionPermission {canWrite} action="reconcile">
		<Button
			variant="outline"
			size="sm"
			disabled={isLoading || isSuspended || !canWrite}
			onclick={() => onAction('reconcile')}
			class={!canWrite ? 'pointer-events-none' : ''}
			aria-label="Reconcile"
		>
			{#if isLoading}
				<Loader2 class="h-4 w-4 animate-spin md:mr-2" />
			{:else}
				<RefreshCw class="h-4 w-4 md:mr-2" />
			{/if}
			<span class="hidden md:inline">Reconcile</span>
		</Button>
	</ResourceActionPermission>
	{/snippet}

	{@render primaryActions()}

	{#snippet lifecycleAction()}
	{#if isSuspended}
		<ResourceActionPermission {canWrite} action="resume">
			<Button
				variant="default"
				size="sm"
				disabled={isLoading || !canWrite}
				onclick={() => onAction('resume')}
				class="bg-green-600 hover:bg-green-700 dark:bg-green-700 dark:hover:bg-green-800 {!canWrite
					? 'pointer-events-none'
					: ''}"
				aria-label="Resume"
			>
				<Play class="h-4 w-4 md:mr-2" />
				<span class="hidden md:inline">Resume</span>
			</Button>
		</ResourceActionPermission>
	{:else}
		<ResourceActionPermission {canWrite} action="suspend">
			<Button
				variant="ghost"
				size="sm"
				disabled={isLoading || !canWrite}
				onclick={onSuspend}
				class="text-amber-600 hover:bg-amber-50 hover:text-amber-700 dark:text-amber-500 dark:hover:bg-amber-950/30 {!canWrite
					? 'pointer-events-none'
					: ''}"
				aria-label="Suspend"
			>
				<Pause class="h-4 w-4 md:mr-2" />
				<span class="hidden md:inline">Suspend</span>
			</Button>
		</ResourceActionPermission>
	{/if}
	{/snippet}

	{@render lifecycleAction()}

	{#snippet destructiveAction()}
	<ResourceActionPermission {canWrite} action="delete">
		<Button
			variant="ghost"
			size="sm"
			disabled={!canWrite}
			onclick={onDelete}
			class="text-red-600 hover:bg-red-50 hover:text-red-700 dark:text-red-500 dark:hover:bg-red-950/30 {!canWrite
				? 'pointer-events-none'
				: ''}"
			aria-label="Delete"
		>
			<Trash2 class="h-4 w-4 md:mr-2" />
			<span class="hidden md:inline">Delete</span>
		</Button>
	</ResourceActionPermission>
	{/snippet}

	{@render destructiveAction()}
</div>
