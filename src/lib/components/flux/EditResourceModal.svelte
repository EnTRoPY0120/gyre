<script lang="ts">
	import { invalidateAll } from '$app/navigation';
	import { X, Save, AlertTriangle } from 'lucide-svelte';
	import { Button } from '$lib/components/ui/button';
	import MonacoEditor from '$lib/components/editors/MonacoEditor.svelte';
	import yaml from 'js-yaml';

	interface Props {
		open: boolean;
		resourceType: string;
		namespace: string;
		name: string;
		initialYaml: string;
		onClose: () => void;
		onSuccess?: () => void;
	}

	let { open = $bindable(false), resourceType, namespace, name, initialYaml, onClose, onSuccess }: Props = $props();

	// State
	let yamlContent = $state('');
	let saving = $state(false);
	let error = $state<string | null>(null);
	let validationErrors = $state<any[]>([]);

	// Reset state when modal opens or initialYaml changes
	$effect(() => {
		if (open) {
			yamlContent = initialYaml;
			error = null;
			validationErrors = [];
		}
	});

	// Handle validation from Monaco
	function handleValidation(errors: any[]) {
		validationErrors = errors.filter(e => e.severity === 8); // Only errors, not warnings
	}

	// Save resource
	async function handleSave() {
		if (saving) return;

		error = null;

		// Validate YAML syntax
		try {
			const parsed = yaml.load(yamlContent);

			// Validate basic resource structure
			if (!parsed || typeof parsed !== 'object') {
				error = 'Invalid YAML: must be a valid Kubernetes resource object';
				return;
			}

			const resource = parsed as any;
			if (!resource.apiVersion || !resource.kind || !resource.metadata) {
				error = 'Invalid resource: missing required fields (apiVersion, kind, metadata)';
				return;
			}

			// Validate name and namespace match
			if (resource.metadata.name !== name) {
				error = `Resource name mismatch: expected "${name}", got "${resource.metadata.name}"`;
				return;
			}

			if (resource.metadata.namespace && resource.metadata.namespace !== namespace) {
				error = `Namespace mismatch: expected "${namespace}", got "${resource.metadata.namespace}"`;
				return;
			}

		} catch (err) {
			error = err instanceof Error ? err.message : 'Invalid YAML syntax';
			return;
		}

		// Check Monaco validation errors
		if (validationErrors.length > 0) {
			error = 'Please fix YAML syntax errors before saving';
			return;
		}

		// Save to API
		saving = true;
		try {
			const response = await fetch(`/api/flux/${resourceType}/${namespace}/${name}`, {
				method: 'PUT',
				headers: {
					'Content-Type': 'application/json'
				},
				body: JSON.stringify({ yaml: yamlContent })
			});

			if (!response.ok) {
				const data = await response.json();
				throw new Error(data.error || `Failed to update resource: ${response.statusText}`);
			}

			// Success - invalidate cache and close modal
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

	// Handle keyboard shortcuts
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

	// Close modal
	function handleClose() {
		if (saving) return;
		open = false;
		onClose();
	}
</script>

{#if open}
	<!-- svelte-ignore a11y_no_static_element_interactions -->
	<div
		class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm"
		onkeydown={handleKeydown}
		role="dialog"
		aria-modal="true"
		aria-labelledby="edit-resource-title"
		tabindex="-1"
	>
		<div class="relative w-full max-w-4xl max-h-[90vh] bg-zinc-800 rounded-lg shadow-xl border border-zinc-700 flex flex-col">
			<!-- Header -->
			<div class="flex items-center justify-between p-6 border-b border-zinc-700">
				<div>
					<h2 id="edit-resource-title" class="text-xl font-semibold text-zinc-100">
						Edit Resource
					</h2>
					<p class="text-sm text-zinc-400 mt-1">
						{resourceType}/{namespace}/{name}
					</p>
				</div>
				<button
					onclick={handleClose}
					disabled={saving}
					class="text-zinc-400 hover:text-zinc-100 transition-colors disabled:opacity-50"
					aria-label="Close modal"
				>
					<X size={24} />
				</button>
			</div>

			<!-- Editor Area -->
			<div class="flex-1 p-6 overflow-hidden">
				<div class="h-full border border-zinc-700 rounded-lg overflow-hidden">
					<MonacoEditor
						bind:value={yamlContent}
						language="yaml"
						readonly={saving}
						height="100%"
						lineNumbers="on"
						minimap={true}
						onValidation={handleValidation}
					/>
				</div>
			</div>

			<!-- Error Display -->
			{#if error}
				<div class="px-6 pb-4">
					<div class="flex items-start gap-2 p-3 bg-red-900/20 border border-red-500/30 rounded text-red-400 text-sm">
						<AlertTriangle size={16} class="mt-0.5 flex-shrink-0" />
						<p>{error}</p>
					</div>
				</div>
			{/if}

			<!-- Footer -->
			<div class="flex items-center justify-between p-6 border-t border-zinc-700 bg-zinc-900/50">
				<div class="text-xs text-zinc-500">
					{#if validationErrors.length > 0}
						<span class="text-red-400">{validationErrors.length} error{validationErrors.length !== 1 ? 's' : ''} found</span>
					{:else}
						Press <kbd class="px-1.5 py-0.5 bg-zinc-800 rounded border border-zinc-700">Ctrl+S</kbd> to save
					{/if}
				</div>
				<div class="flex gap-3">
					<Button
						variant="outline"
						onclick={handleClose}
						disabled={saving}
						class="border-zinc-600 hover:bg-zinc-700"
					>
						Cancel
					</Button>
					<Button
						onclick={handleSave}
						disabled={saving || validationErrors.length > 0}
						class="bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700 text-white"
					>
						{#if saving}
							<div class="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent"></div>
							Saving...
						{:else}
							<Save size={16} class="mr-2" />
							Save Changes
						{/if}
					</Button>
				</div>
			</div>
		</div>
	</div>
{/if}

<style>
	kbd {
		font-family: ui-monospace, monospace;
		font-size: 0.75rem;
	}
</style>
