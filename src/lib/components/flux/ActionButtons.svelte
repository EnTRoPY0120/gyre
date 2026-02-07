<script lang="ts">
	import { invalidate } from '$app/navigation';
	import { page } from '$app/stores';
	import { Button } from '$lib/components/ui/button';
	import * as Tooltip from '$lib/components/ui/tooltip';
	import ConfirmDialog from '$lib/components/flux/ConfirmDialog.svelte';
	import EditResourceModal from '$lib/components/flux/EditResourceModal.svelte';
	import type { FluxResource } from '$lib/types/flux';
	import { RefreshCw, Play, Pause, Loader2, Pencil } from 'lucide-svelte';
	import { resourceCache } from '$lib/stores/resourceCache.svelte';
	import yaml from 'js-yaml';

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
	let showEditModal = $state(false);

	// Serialize resource to YAML for editing
	const resourceYaml = $derived.by(() => {
		try {
			return yaml.dump(resource, { noRefs: true, lineWidth: -1 });
		} catch (err) {
			console.error('Failed to serialize resource:', err);
			return '';
		}
	});

	const userRole = $derived($page.data.user?.role || 'viewer');
	const canWrite = $derived(userRole === 'admin' || userRole === 'editor');
	const isSuspended = $derived(resource.spec?.suspend === true);

	async function handleAction(action: 'suspend' | 'resume' | 'reconcile') {
		if (!canWrite) return;

		isLoading = true;
		error = null;

		// Store original for rollback
		const originalResource = JSON.parse(JSON.stringify(resource));

		// Optimistic update for suspend/resume
		if (action === 'suspend' || action === 'resume') {
			const optimisticResource = JSON.parse(JSON.stringify(resource));
			optimisticResource.spec = optimisticResource.spec || {};
			optimisticResource.spec.suspend = action === 'suspend';
			resourceCache.setResource(type, namespace, name, optimisticResource);
		}

		try {
			const response = await fetch(`/api/flux/${type}/${namespace}/${name}/${action}`, {
				method: 'POST'
			});

			if (!response.ok) {
				const data = await response.json().catch(() => ({}));
				throw new Error(data.message || `Failed to ${action} resource`);
			}

			// Success! Invalidate to refresh data from server
			await invalidate(`flux:resource:${type}:${namespace}:${name}`);
		} catch (err) {
			// Rollback on error
			if (action === 'suspend' || action === 'resume') {
				resourceCache.setResource(type, namespace, name, originalResource);
			}
			error = (err as Error).message;
			setTimeout(() => (error = null), 5000);
		} finally {
			isLoading = false;
		}
	}
</script>

{#snippet actionButton(action: 'edit' | 'reconcile' | 'suspend' | 'resume')}
	{#if action === 'edit'}
		<Button
			variant="outline"
			size="sm"
			disabled={!canWrite}
			onclick={() => (showEditModal = true)}
			class={!canWrite ? 'pointer-events-none' : ''}
		>
			<Pencil class="mr-2 h-4 w-4" />
			Edit
		</Button>
	{:else if action === 'reconcile'}
		<Button
			variant="outline"
			size="sm"
			disabled={isLoading || isSuspended || !canWrite}
			onclick={() => handleAction('reconcile')}
			class={!canWrite ? 'pointer-events-none' : ''}
		>
			{#if isLoading}
				<Loader2 class="mr-2 h-4 w-4 animate-spin" />
			{:else}
				<RefreshCw class="mr-2 h-4 w-4" />
			{/if}
			Reconcile
		</Button>
	{:else if action === 'resume'}
		<Button
			variant="default"
			size="sm"
			disabled={isLoading || !canWrite}
			onclick={() => handleAction('resume')}
			class="bg-green-600 hover:bg-green-700 dark:bg-green-700 dark:hover:bg-green-800 {!canWrite
				? 'pointer-events-none'
				: ''}"
		>
			<Play class="mr-2 h-4 w-4" />
			Resume
		</Button>
	{:else if action === 'suspend'}
		<Button
			variant="ghost"
			size="sm"
			disabled={isLoading || !canWrite}
			onclick={() => (showSuspendDialog = true)}
			class="text-amber-600 hover:bg-amber-50 hover:text-amber-700 dark:text-amber-500 dark:hover:bg-amber-950/30 {!canWrite
				? 'pointer-events-none'
				: ''}"
		>
			<Pause class="mr-2 h-4 w-4" />
			Suspend
		</Button>
	{/if}
{/snippet}

{#snippet withPermissionTooltip(action: 'edit' | 'reconcile' | 'suspend' | 'resume')}
	{#if !canWrite}
		<Tooltip.Provider delayDuration={200}>
			<Tooltip.Root>
				<Tooltip.Trigger>
					{@render actionButton(action)}
				</Tooltip.Trigger>
				<Tooltip.Content side="top">
					<p class="text-xs">
						You need additional permissions to {action === 'reconcile' ? 'reconcile' : action} resources.
					</p>
				</Tooltip.Content>
			</Tooltip.Root>
		</Tooltip.Provider>
	{:else}
		{@render actionButton(action)}
	{/if}
{/snippet}

<div class="flex items-center gap-2">
	{#if error}
		<span class="animate-in fade-in slide-in-from-right-2 text-sm text-red-600">{error}</span>
	{/if}

	<!-- Edit Button -->
	{@render withPermissionTooltip('edit')}

	<!-- Reconcile Button -->
	{@render withPermissionTooltip('reconcile')}

	<!-- Suspend/Resume Button -->
	{#if isSuspended}
		{@render withPermissionTooltip('resume')}
	{:else}
		{@render withPermissionTooltip('suspend')}
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

<EditResourceModal
	bind:open={showEditModal}
	resourceType={type}
	{namespace}
	{name}
	initialYaml={resourceYaml}
	onClose={() => (showEditModal = false)}
	onSuccess={() => invalidate(`flux:resource:${type}:${namespace}:${name}`)}
/>
