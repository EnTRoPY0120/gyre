<script lang="ts">
	import { invalidateAll } from '$app/navigation';
	import type * as Monaco from 'monaco-editor';
	import { getCsrfToken } from '$lib/utils/csrf';
	import { updateResource, validateResourceYaml } from './edit-resource';
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

	function getSaveValidationError(): string | null {
		const resourceError = validateResourceYaml(yamlContent, name, namespace);
		if (resourceError) return resourceError;
		if (validationErrors.length > 0) {
			return 'Please fix YAML syntax errors before saving';
		}
		return null;
	}

	async function persistResourceUpdate(): Promise<void> {
		await updateResource({
			resourceType,
			namespace,
			name,
			yamlContent,
			csrfToken: getCsrfToken()
		});
		await invalidateAll();
		onSuccess?.();
		open = false;
		onClose();
	}

	async function handleSave() {
		if (saving) return;

		error = null;

		const validationError = getSaveValidationError();
		if (validationError) {
			error = validationError;
			return;
		}

		saving = true;
		try {
			await persistResourceUpdate();
		} catch (err) {
			error = err instanceof Error ? err.message : 'Failed to update resource';
		} finally {
			saving = false;
		}
	}

	function isSaveShortcut(e: KeyboardEvent): boolean {
		return (e.ctrlKey || e.metaKey) && e.key === 's';
	}

	function handleKeydown(e: KeyboardEvent) {
		if (e.key === 'Escape') {
			if (saving) return;
			e.preventDefault();
			open = false;
			onClose();
			return;
		}
		if (isSaveShortcut(e)) {
			e.preventDefault();
			void handleSave();
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
