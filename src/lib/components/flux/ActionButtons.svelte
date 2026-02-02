<script lang="ts">
	import { invalidate } from '$app/navigation';
	import { Button } from '$lib/components/ui/button';
	import ConfirmDialog from '$lib/components/flux/ConfirmDialog.svelte';
	import type { FluxResource } from '$lib/types/flux';
	import { RefreshCw, Play, Pause, Loader2 } from 'lucide-svelte';

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
		<span class="animate-in fade-in slide-in-from-right-2 text-sm text-red-600">{error}</span>
	{/if}

	<!-- Reconcile Button -->
	<Button
		variant="outline"
		size="sm"
		disabled={isLoading || isSuspended}
		onclick={() => handleAction('reconcile')}
	>
		{#if isLoading}
			<Loader2 class="mr-2 h-4 w-4 animate-spin" />
		{:else}
			<RefreshCw class="mr-2 h-4 w-4" />
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
			<Play class="mr-2 h-4 w-4" />
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
			<Pause class="mr-2 h-4 w-4" />
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
