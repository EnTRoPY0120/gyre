<script lang="ts">
	import { invalidate } from '$app/navigation';
	import { page } from '$app/stores';
	import { Button } from '$lib/components/ui/button';
	import * as Tooltip from '$lib/components/ui/tooltip';
	import ConfirmDialog from '$lib/components/flux/ConfirmDialog.svelte';
	import EditResourceModal from '$lib/components/flux/EditResourceModal.svelte';
	import DeleteResourceModal from '$lib/components/flux/DeleteResourceModal.svelte';
	import {
		buildOptimisticResource,
		isOptimisticAction,
		resolveResourceActionFeedback,
		type ActionFeedbackTone,
		type ResourceAction
	} from './action-feedback';
	import type { FluxResource } from '$lib/types/flux';
	import { RefreshCw, Play, Pause, Loader2, Pencil, Trash2 } from 'lucide-svelte';
	import { resourceCache } from '$lib/stores/resourceCache.svelte';
	import { sanitizeResource } from '$lib/utils/kubernetes';
	import { logger } from '$lib/utils/logger.js';
	import yaml from 'js-yaml';
	import { getCsrfToken } from '$lib/utils/csrf';

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
	let feedback = $state<{ tone: ActionFeedbackTone; message: string } | null>(null);
	let feedbackTimeout = $state<ReturnType<typeof setTimeout> | null>(null);
	let retryTimeout = $state<ReturnType<typeof setTimeout> | null>(null);
	let showSuspendDialog = $state(false);
	let showEditModal = $state(false);
	let showDeleteModal = $state(false);

	// Serialize resource to YAML for editing
	const resourceYaml = $derived.by(() => {
		try {
			const sanitized = sanitizeResource(resource);
			return yaml.dump(sanitized, { noRefs: true, lineWidth: -1 });
		} catch (err) {
			logger.error(err, 'Failed to serialize resource:');
			return '';
		}
	});

	const userRole = $derived($page.data.user?.role || 'viewer');
	const canWrite = $derived(userRole === 'admin' || userRole === 'editor');
	const isSuspended = $derived(resource.spec?.suspend === true);

	$effect(() => {
		return () => {
			if (feedbackTimeout) {
				clearTimeout(feedbackTimeout);
				feedbackTimeout = null;
			}
			if (retryTimeout) {
				clearTimeout(retryTimeout);
				retryTimeout = null;
			}
		};
	});

	function showTimedFeedback(tone: ActionFeedbackTone, message: string) {
		const nextFeedback = { tone, message };
		feedback = nextFeedback;

		if (feedbackTimeout) {
			clearTimeout(feedbackTimeout);
		}

		feedbackTimeout = setTimeout(() => {
			if (feedback === nextFeedback) {
				feedback = null;
			}
			feedbackTimeout = null;
		}, 5000);
	}

	async function handleAction(action: ResourceAction) {
		if (!canWrite) return;

		isLoading = true;
		feedback = null;

		// Store original for rollback
		const originalResource = JSON.parse(JSON.stringify(resource));

		// Optimistic update for suspend/resume
		if (isOptimisticAction(action)) {
			resourceCache.setResource(type, namespace, name, buildOptimisticResource(resource, action));
		}

		let mutationError: Error | null = null;
		let invalidateError: Error | null = null;

		try {
			const response = await fetch(`/api/v1/flux/${encodeURIComponent(type)}/${encodeURIComponent(namespace)}/${encodeURIComponent(name)}/${encodeURIComponent(action)}`, {
				method: 'POST',
				headers: { 'X-CSRF-Token': getCsrfToken() }
			});

			if (!response.ok) {
				const data = await response.json().catch(() => ({}));
				throw new Error(data.message || `Failed to ${action} resource`);
			}
		} catch (err) {
			mutationError = err as Error;
		}

		if (!mutationError) {
			try {
				await invalidate(`flux:resource:${type}:${namespace}:${name}`);
			} catch (err) {
				invalidateError = err as Error;
				if (retryTimeout) {
					clearTimeout(retryTimeout);
				}
				retryTimeout = setTimeout(() => {
					invalidate(`flux:resource:${type}:${namespace}:${name}`)
						.catch(() => {})
						.finally(() => {
							retryTimeout = null;
						});
				}, 1500);
			}
		}

		const actionFeedback = resolveResourceActionFeedback({
			action,
			mutationError,
			invalidateError
		});

		if (actionFeedback.rollbackOptimistic && isOptimisticAction(action)) {
			resourceCache.setResource(type, namespace, name, originalResource);
		}

		if (actionFeedback.tone && actionFeedback.message) {
			showTimedFeedback(actionFeedback.tone, actionFeedback.message);
		}

		isLoading = false;
	}
</script>

{#snippet actionButton(action: 'edit' | 'reconcile' | 'suspend' | 'resume' | 'delete')}
	{#if action === 'edit'}
		<Button
			variant="outline"
			size="sm"
			disabled={!canWrite}
			onclick={() => (showEditModal = true)}
			class={!canWrite ? 'pointer-events-none' : ''}
			aria-label="Edit"
		>
			<Pencil class="h-4 w-4 md:mr-2" />
			<span class="hidden md:inline">Edit</span>
		</Button>
	{:else if action === 'reconcile'}
		<Button
			variant="outline"
			size="sm"
			disabled={isLoading || isSuspended || !canWrite}
			onclick={() => handleAction('reconcile')}
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
	{:else if action === 'resume'}
		<Button
			variant="default"
			size="sm"
			disabled={isLoading || !canWrite}
			onclick={() => handleAction('resume')}
			class="bg-green-600 hover:bg-green-700 dark:bg-green-700 dark:hover:bg-green-800 {!canWrite
				? 'pointer-events-none'
				: ''}"
			aria-label="Resume"
		>
			<Play class="h-4 w-4 md:mr-2" />
			<span class="hidden md:inline">Resume</span>
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
			aria-label="Suspend"
		>
			<Pause class="h-4 w-4 md:mr-2" />
			<span class="hidden md:inline">Suspend</span>
		</Button>
	{:else if action === 'delete'}
		<Button
			variant="ghost"
			size="sm"
			disabled={!canWrite}
			onclick={() => (showDeleteModal = true)}
			class="text-red-600 hover:bg-red-50 hover:text-red-700 dark:text-red-500 dark:hover:bg-red-950/30 {!canWrite
				? 'pointer-events-none'
				: ''}"
			aria-label="Delete"
		>
			<Trash2 class="h-4 w-4 md:mr-2" />
			<span class="hidden md:inline">Delete</span>
		</Button>
	{/if}
{/snippet}

{#snippet withPermissionTooltip(action: 'edit' | 'reconcile' | 'suspend' | 'resume' | 'delete')}
	{#if !canWrite}
		<Tooltip.Provider delayDuration={200}>
			<Tooltip.Root>
				<Tooltip.Trigger>
					{#snippet child({ props })}
						<span {...props}>
							{@render actionButton(action)}
						</span>
					{/snippet}
				</Tooltip.Trigger>
				<Tooltip.Content side="top">
					<p class="text-xs">
						You need additional permissions to {action} resources.
					</p>
				</Tooltip.Content>
			</Tooltip.Root>
		</Tooltip.Provider>
	{:else}
		{@render actionButton(action)}
	{/if}
{/snippet}

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

	<!-- Delete Button -->
	{@render withPermissionTooltip('delete')}
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

<DeleteResourceModal
	bind:open={showDeleteModal}
	resourceType={type}
	{namespace}
	{name}
	onClose={() => (showDeleteModal = false)}
/>
