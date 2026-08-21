<script lang="ts">
	import { enhance } from '$app/forms';
	import { invalidateAll } from '$app/navigation';
	import Button from '$lib/components/ui/button/button.svelte';
	import { getCsrfToken } from '$lib/utils/csrf';

	let {
		newCluster,
		kubeconfigInput,
		isDragging,
		onClusterChange,
		onKubeconfigChange,
		onDraggingChange,
		onClose
	}: {
		newCluster: { name: string; description: string };
		kubeconfigInput: string;
		isDragging: boolean;
		onClusterChange: (field: 'name' | 'description', value: string) => void;
		onKubeconfigChange: (value: string) => void;
		onDraggingChange: (dragging: boolean) => void;
		onClose: () => void;
	} = $props();

	function handleDrop(event: DragEvent) {
		event.preventDefault();
		onDraggingChange(false);

		const files = event.dataTransfer?.files;
		if (!files || files.length === 0) return;

		const file = files[0];
		if (!file.name.endsWith('.json') && !file.name.endsWith('.yaml') && !file.name.endsWith('.yml')) {
			return;
		}

		const reader = new FileReader();
		reader.onload = (e) => onKubeconfigChange(e.target?.result as string);
		reader.readAsText(file);
	}
</script>

<div
	class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-0 sm:p-4"
	role="dialog"
	aria-modal="true"
	aria-labelledby="create-cluster-title"
	tabindex="-1"
	onclick={(e) => e.target === e.currentTarget && onClose()}
	onkeydown={(e) => e.key === 'Escape' && onClose()}
>
	<div
		class="h-full w-full overflow-y-auto border border-slate-700 bg-slate-800 p-6 shadow-2xl sm:h-auto sm:max-w-2xl sm:rounded-xl"
	>
		<h2 id="create-cluster-title" class="mb-4 text-xl font-bold text-white">Add New Cluster</h2>

		<form
			method="POST"
			action="?/create"
			use:enhance={() => {
				return async ({ result }) => {
					if (result.type === 'success') {
						onClose();
						await invalidateAll();
					}
				};
			}}
			class="space-y-4"
		>
			<input type="hidden" name="_csrf" value={getCsrfToken()} />
			<div class="grid grid-cols-1 gap-4 md:grid-cols-2">
				<div>
					<label for="clusterName" class="mb-1 block text-sm font-medium text-slate-300">Cluster Name</label>
					<input
						type="text"
						id="clusterName"
						name="name"
						value={newCluster.name}
						oninput={(event) => onClusterChange('name', event.currentTarget.value)}
						required
						minlength="3"
						class="w-full rounded-lg border border-slate-600 bg-slate-700 px-3 py-2 text-white placeholder-slate-400 focus:border-amber-500 focus:outline-none"
						placeholder="e.g., Production"
					/>
				</div>
				<div>
					<label for="clusterDescription" class="mb-1 block text-sm font-medium text-slate-300"
						>Description (optional)</label
					>
					<input
						type="text"
						id="clusterDescription"
						name="description"
						value={newCluster.description}
						oninput={(event) => onClusterChange('description', event.currentTarget.value)}
						class="w-full rounded-lg border border-slate-600 bg-slate-700 px-3 py-2 text-white placeholder-slate-400 focus:border-amber-500 focus:outline-none"
						placeholder="e.g., Main production cluster"
					/>
				</div>
			</div>

			<div>
				<label for="kubeconfig" class="mb-1 block text-sm font-medium text-slate-300">Kubeconfig</label>
				<div
					class="relative rounded-lg border-2 border-dashed {isDragging
						? 'border-amber-500 bg-amber-500/10'
						: 'border-slate-600'} transition-colors"
					role="region"
					aria-label="Kubeconfig drop zone"
					ondrop={handleDrop}
					ondragover={(event) => {
						event.preventDefault();
						onDraggingChange(true);
					}}
					ondragleave={() => onDraggingChange(false)}
				>
					<textarea
						id="kubeconfig"
						name="kubeconfig"
						value={kubeconfigInput}
						oninput={(event) => onKubeconfigChange(event.currentTarget.value)}
						required
						rows="10"
						class="w-full resize-none rounded-lg border-0 bg-slate-700/50 px-3 py-2 font-mono text-xs text-white placeholder-slate-400 focus:ring-0"
						placeholder="Paste your kubeconfig YAML or JSON here...&#10;&#10;You can also drag and drop a .json, .yaml, or .yml file here."
					></textarea>
					{#if isDragging}
						<div class="pointer-events-none absolute inset-0 flex items-center justify-center bg-slate-800/80">
							<p class="text-lg font-medium text-amber-400">Drop file here</p>
						</div>
					{/if}
				</div>
				<p class="mt-1 text-xs text-slate-500">
					Accepts kubeconfig in YAML or JSON format. The config will be encrypted before storage.
				</p>
			</div>

			<div class="rounded-lg border border-blue-500/30 bg-blue-500/10 p-3">
				<div class="flex items-start gap-2">
					<svg class="mt-0.5 h-4 w-4 flex-shrink-0 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
						<path
							stroke-linecap="round"
							stroke-linejoin="round"
							stroke-width="2"
							d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
						/>
					</svg>
					<p class="text-xs text-blue-300">
						<strong>Security Note:</strong> Your kubeconfig will be encrypted using AES-256-GCM before being
						stored in the database. Only Gyre can decrypt it using the instance-specific encryption key.
					</p>
				</div>
			</div>

			<div class="flex justify-end gap-3 pt-4">
				<Button type="button" variant="ghost" onclick={onClose}>Cancel</Button>
				<Button
					type="submit"
					class="bg-gradient-to-r from-amber-500 to-amber-600 text-slate-900 hover:from-amber-400 hover:to-amber-500"
				>
					Add Cluster
				</Button>
			</div>
		</form>
	</div>
</div>
