<script lang="ts">
	import { invalidate } from '$app/navigation';
	import { page } from '$app/stores';
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
	import { resourceCache } from '$lib/stores/resourceCache.svelte';
	import { sanitizeResource } from '$lib/utils/kubernetes';
	import { logger } from '$lib/utils/logger.js';
import * as yaml from 'js-yaml';
	import { getCsrfToken } from '$lib/utils/csrf';
	import { executeResourceAction } from './resource-action';
	import ResourceActionControls from './ResourceActionControls.svelte';

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

		const { mutationError, invalidateError } = await executeResourceAction(
			{ type, namespace, name, action, csrfToken: getCsrfToken() },
			`flux:resource:${type}:${namespace}:${name}`,
			(key) => invalidate(key),
			(retry) => {
				if (retryTimeout) clearTimeout(retryTimeout);
				retryTimeout = setTimeout(() => {
					retry().finally(() => {
						retryTimeout = null;
				});
			}, 1500);
			}
		);

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

<ResourceActionControls
	{canWrite}
	{isLoading}
	{isSuspended}
	{feedback}
	onAction={handleAction}
	onEdit={() => (showEditModal = true)}
	onSuspend={() => (showSuspendDialog = true)}
	onDelete={() => (showDeleteModal = true)}
/>

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
