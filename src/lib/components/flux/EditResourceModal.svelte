<script lang="ts">
	import { invalidateAll } from '$app/navigation';
	import type * as Monaco from 'monaco-editor';
	import { getCsrfToken } from '$lib/utils/csrf';
	import { getResourceUpdateError, validateResourceYaml } from './edit-resource';
	import EditResourceModalEditor from './EditResourceModalEditor.svelte';
	import EditResourceModalError from './EditResourceModalError.svelte';
	import EditResourceModalFooter from './EditResourceModalFooter.svelte';
	import EditResourceModalHeader from './EditResourceModalHeader.svelte';

	interface Props {
		open: boolean;
		resourceType: string;
		namespace: string;
		name: string;
		initialYaml: string;
		onClose: () => void;
		onSuccess?: () => void;
	}

	let {
		open = $bindable(false),
		resourceType,
		namespace,
		name,
		initialYaml,
		onClose,
		onSuccess
	}: Props = $props();

	let yamlContent = $state('');
	let saving = $state(false);
	let error = $state<string | null>(null);
	let validationErrors = $state<Monaco.editor.IMarker[]>([]);
	let modalEl = $state<HTMLDivElement | null>(null);
	let previousActiveElement: HTMLElement | null = null;

	$effect(() => {
		if (open) {
			yamlContent = initialYaml;
			error = null;
			validationErrors = [];

			if (typeof document !== 'undefined') {
				previousActiveElement = document.activeElement as HTMLElement;
				setTimeout(() => modalEl?.focus(), 50);
			}
		} else if (previousActiveElement) {
			previousActiveElement.focus();
			previousActiveElement = null;
		}
	});

	function handleValidation(errors: Monaco.editor.IMarker[]) {
		validationErrors = errors.filter((e) => e.severity === 8);
	}

	async function handleSave() {
		if (saving) return;

		error = null;

		const validationError = validateResourceYaml(yamlContent, name, namespace);
		if (validationError) {
			error = validationError;
			return;
		}

		if (validationErrors.length > 0) {
			error = 'Please fix YAML syntax errors before saving';
			return;
		}

		saving = true;
		try {
			const response = await fetch(
				`/api/v1/flux/${encodeURIComponent(resourceType)}/${encodeURIComponent(namespace)}/${encodeURIComponent(name)}`,
				{
					method: 'PUT',
					headers: {
						'Content-Type': 'application/json',
						'X-CSRF-Token': getCsrfToken()
					},
					body: JSON.stringify({ yaml: yamlContent })
				}
			);

			if (!response.ok) {
				throw new Error(await getResourceUpdateError(response));
			}

			await invalidateAll();
			onSuccess?.();
			open = false;
			onClose();
		} catch (err) {
			error = err instanceof Error ? err.message : 'Failed to update resource';
		} finally {
			saving = false;
		}
	}

	function handleKeydown(e: KeyboardEvent) {
		if (e.key === 'Escape' && !saving) {
			e.preventDefault();
			open = false;
			onClose();
		}
		if ((e.ctrlKey || e.metaKey) && e.key === 's') {
			e.preventDefault();
			handleSave();
		}
	}

	function handleClose() {
		if (saving) return;
		open = false;
		onClose();
	}
</script>

{#if open}
	<div
		bind:this={modalEl}
		class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm"
		onkeydown={handleKeydown}
		role="dialog"
		aria-modal="true"
		aria-labelledby="edit-resource-title"
		tabindex="-1"
	>
		<div
			class="relative flex h-full w-full flex-col border border-zinc-700 bg-zinc-800 shadow-xl md:max-h-[90vh] md:max-w-4xl md:rounded-lg"
		>
			<EditResourceModalHeader
				{resourceType}
				{namespace}
				{name}
				{saving}
				onClose={handleClose}
			/>
			<EditResourceModalEditor
				bind:value={yamlContent}
				readonly={saving}
				onValidation={handleValidation}
			/>
			{#if error}
				<EditResourceModalError {error} />
			{/if}
			<EditResourceModalFooter
				validationErrorCount={validationErrors.length}
				{saving}
				onClose={handleClose}
				onSave={handleSave}
			/>
		</div>
	</div>
{/if}
