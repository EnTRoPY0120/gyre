<script lang="ts">
	import { invalidate } from '$app/navigation';
	import { Button } from '$lib/components/ui/button';
	import ConfirmDialog from '$lib/components/flux/ConfirmDialog.svelte';
	import type { FluxResource } from '$lib/types/flux';

	let {
		resource,
		type,
		namespace,
		name
	}: {
		resource: FluxResource;
		type: string;
		namespace: string;
		name: string;
	} = $props();

	let isLoading = $state(false);
	let error = $state<string | null>(null);
	let showSuspendDialog = $state(false);

	const isSuspended = $derived(resource.spec?.suspend === true);

	async function handleAction(action: 'suspend' | 'resume' | 'reconcile') {
		isLoading = true;
		error = null;

		try {
			const response = await fetch(`/api/flux/${type}/${namespace}/${name}/${action}`, {
				method: 'POST'
			});

			if (!response.ok) {
				const data = await response.json().catch(() => ({}));
				throw new Error(data.message || `Failed to ${action} resource`);
			}

			// Success! Invalidate to refresh data
			// Note: SSE will also trigger invalidation, but this provides immediate feedback
			await invalidate(`flux:resource:${type}:${namespace}:${name}`);
		} catch (err) {
			error = (err as Error).message;
			setTimeout(() => (error = null), 5000); // Clear error after 5s
		} finally {
			isLoading = false;
		}
	}
</script>

<div class="flex items-center gap-2">
	{#if error}
		<span class="text-sm text-red-600 animate-in fade-in slide-in-from-right-2">{error}</span>
	{/if}

	<!-- Reconcile Button -->
	<Button
		variant="outline"
		size="sm"
		disabled={isLoading || isSuspended}
		onclick={() => handleAction('reconcile')}
	>
		{#if isLoading}
			<svg class="mr-2 h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24">
				<circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" />
				<path
					class="opacity-75"
					fill="currentColor"
					d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
				/>
			</svg>
		{:else}
			<svg class="mr-2 h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
				<path
					stroke-linecap="round"
					stroke-linejoin="round"
					stroke-width="2"
					d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
				/>
			</svg>
		{/if}
		Reconcile
	</Button>

	<!-- Suspend/Resume Button -->
	{#if isSuspended}
		<Button
			variant="default"
			size="sm"
			disabled={isLoading}
			onclick={() => handleAction('resume')}
			class="bg-green-600 hover:bg-green-700 dark:bg-green-700 dark:hover:bg-green-800"
		>
			<svg class="mr-2 h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
				<path
					stroke-linecap="round"
					stroke-linejoin="round"
					stroke-width="2"
					d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z"
				/>
				<path
					stroke-linecap="round"
					stroke-linejoin="round"
					stroke-width="2"
					d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
				/>
			</svg>
			Resume
		</Button>
	{:else}
		<Button
			variant="ghost"
			size="sm"
			disabled={isLoading}
			onclick={() => (showSuspendDialog = true)}
			class="text-amber-600 hover:bg-amber-50 hover:text-amber-700 dark:text-amber-500 dark:hover:bg-amber-950/30"
		>
			<svg class="mr-2 h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
				<path
					stroke-linecap="round"
					stroke-linejoin="round"
					stroke-width="2"
					d="M10 9v6m4-6v6m7-3a9 9 0 11-18 0 9 9 0 0118 0z"
				/>
			</svg>
			Suspend
		</Button>
	{/if}
</div>

<ConfirmDialog
	bind:open={showSuspendDialog}
	title="Suspend Resource?"
	description="Suspended resources will stop reconciling changes from the source. You can resume them later."
	confirmLabel="Suspend"
	variant="destructive"
	onConfirm={() => handleAction('suspend')}
/>
