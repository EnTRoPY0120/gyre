<script lang="ts">
	import { enhance } from '$app/forms';
	import { invalidateAll } from '$app/navigation';
	import Button from '$lib/components/ui/button/button.svelte';
	import * as Select from '$lib/components/ui/select';
	import { getCsrfToken } from '$lib/utils/csrf';
	import type { NewPolicy } from './policy-types';

	type ResourceTypeOption = { label: string; value: string };

	let {
		newPolicy = $bindable(),
		allResourceTypes,
		onClose
	}: {
		newPolicy: NewPolicy;
		allResourceTypes: ResourceTypeOption[];
		onClose: () => void;
	} = $props();
</script>

<div
	class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-0 sm:p-4"
	role="dialog"
	aria-modal="true"
	tabindex="-1"
	aria-labelledby="create-policy-title"
	onclick={(e) => e.target === e.currentTarget && onClose()}
	onkeydown={(e) => e.key === 'Escape' && onClose()}
>
	<div
		class="h-full w-full overflow-y-auto border border-slate-700 bg-slate-800 p-6 shadow-2xl sm:h-auto sm:max-w-md sm:rounded-xl"
	>
		<h2 id="create-policy-title" class="mb-4 text-xl font-bold text-white">Create New Policy</h2>

		<form
			method="POST"
			action="?/create"
			use:enhance={() => {
				return async ({ result }) => {
					if (result.type === 'success') {
						onClose();
						invalidateAll();
					}
				};
			}}
			class="space-y-4"
		>
			<input type="hidden" name="_csrf" value={getCsrfToken()} />
			<div>
				<label for="policyName" class="mb-1 block text-sm font-medium text-slate-300">Policy Name</label>
				<input
					type="text"
					id="policyName"
					name="name"
					bind:value={newPolicy.name}
					required
					minlength="3"
					class="w-full rounded-lg border border-slate-600 bg-slate-700 px-3 py-2 text-white placeholder-slate-400 focus:border-amber-500 focus:outline-none"
					placeholder="e.g., Dev Namespace Access"
				/>
			</div>

			<div>
				<label for="policyDescription" class="mb-1 block text-sm font-medium text-slate-300"
					>Description (optional)</label
				>
				<textarea
					id="policyDescription"
					name="description"
					bind:value={newPolicy.description}
					rows="2"
					class="w-full rounded-lg border border-slate-600 bg-slate-700 px-3 py-2 text-white placeholder-slate-400 focus:border-amber-500 focus:outline-none"
					placeholder="What this policy grants access to..."
				></textarea>
			</div>

			<div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
				<div>
					<label for="policyRole" class="mb-1 block text-sm font-medium text-slate-300">Role</label>
					<Select.Root
						type="single"
						value={newPolicy.role}
						onValueChange={(value) => (newPolicy.role = value as NewPolicy['role'])}
					>
						<Select.Trigger id="policyRole" class="w-full">
							<Select.Value placeholder="Select Role">
								<span class="capitalize">{newPolicy.role}</span>
							</Select.Value>
						</Select.Trigger>
						<Select.Content>
							<Select.Item value="viewer">Viewer</Select.Item>
							<Select.Item value="editor">Editor</Select.Item>
							<Select.Item value="admin">Admin</Select.Item>
						</Select.Content>
					</Select.Root>
					<input type="hidden" name="role" value={newPolicy.role} />
				</div>

				<div>
					<label for="policyAction" class="mb-1 block text-sm font-medium text-slate-300">Action</label>
					<Select.Root
						type="single"
						value={newPolicy.action}
						onValueChange={(value) => (newPolicy.action = value as NewPolicy['action'])}
					>
						<Select.Trigger id="policyAction" class="w-full">
							<Select.Value placeholder="Select Action">
								<span class="capitalize">{newPolicy.action}</span>
							</Select.Value>
						</Select.Trigger>
						<Select.Content>
							<Select.Item value="read">Read</Select.Item>
							<Select.Item value="write">Write</Select.Item>
							<Select.Item value="admin">Admin</Select.Item>
						</Select.Content>
					</Select.Root>
					<input type="hidden" name="action" value={newPolicy.action} />
				</div>
			</div>

			<div>
				<label for="resourceType" class="mb-1 block text-sm font-medium text-slate-300"
					>Resource Type (optional)</label
				>
				<Select.Root
					type="single"
					value={newPolicy.resourceType}
					onValueChange={(value) => (newPolicy.resourceType = value)}
				>
					<Select.Trigger id="resourceType" class="w-full">
						<Select.Value placeholder="All Resources">
							{allResourceTypes.find((type) => type.value === newPolicy.resourceType)?.label ||
								'All Resources'}
						</Select.Value>
					</Select.Trigger>
					<Select.Content>
						<Select.Item value="">All Resources</Select.Item>
						{#each allResourceTypes as type (type.value)}
							<Select.Item value={type.value}>{type.label}</Select.Item>
						{/each}
					</Select.Content>
				</Select.Root>
				<input type="hidden" name="resourceType" value={newPolicy.resourceType} />
				<p class="mt-1 text-xs text-slate-500">Leave empty to apply to all resource types</p>
			</div>

			<div>
				<label for="namespacePattern" class="mb-1 block text-sm font-medium text-slate-300"
					>Namespace Pattern (optional)</label
				>
				<input
					type="text"
					id="namespacePattern"
					name="namespacePattern"
					bind:value={newPolicy.namespacePattern}
					class="w-full rounded-lg border border-slate-600 bg-slate-700 px-3 py-2 text-white placeholder-slate-400 focus:border-amber-500 focus:outline-none"
					placeholder="e.g., dev-* or production"
				/>
				<p class="mt-1 text-xs text-slate-500">Use * as wildcard. Leave empty for all namespaces.</p>
			</div>

			<div class="flex justify-end gap-3 pt-4">
				<Button type="button" variant="ghost" onclick={onClose}>Cancel</Button>
				<Button
					type="submit"
					class="bg-gradient-to-r from-amber-500 to-amber-600 text-slate-900 hover:from-amber-400 hover:to-amber-500"
				>
					Create Policy
				</Button>
			</div>
		</form>
	</div>
</div>
