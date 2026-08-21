<script lang="ts">
	import { enhance } from '$app/forms';
	import { invalidateAll } from '$app/navigation';
	import Button from '$lib/components/ui/button/button.svelte';
	import { getCsrfToken } from '$lib/utils/csrf';
	import type { Policy, PolicyUser } from './policy-types';

	let {
		policy,
		assignedUsers,
		roleBadgeColor,
		actionBadgeColor,
		onAssign,
		onDelete
	}: {
		policy: Policy;
		assignedUsers: PolicyUser[];
		roleBadgeColor: string;
		actionBadgeColor: string;
		onAssign: (policy: Policy) => void;
		onDelete: (policy: Policy) => void;
	} = $props();
</script>

<div class="rounded-xl border border-slate-700/50 bg-slate-800/50 p-4">
	<div class="mb-3 flex items-start justify-between">
		<div>
			<h3 class="font-semibold text-white">{policy.name}</h3>
			{#if policy.description}
				<p class="text-sm text-slate-400">{policy.description}</p>
			{/if}
		</div>
		{#if !policy.isActive}
			<span class="rounded bg-slate-700 px-2 py-1 text-xs text-slate-400">Inactive</span>
		{/if}
	</div>

	<div class="mb-3 space-y-2">
		<div class="flex items-center gap-2">
			<span class="text-xs text-slate-500">Role:</span>
			<span
				class="inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium {roleBadgeColor}"
			>
				{policy.role}
			</span>
		</div>
		<div class="flex items-center gap-2">
			<span class="text-xs text-slate-500">Action:</span>
			<span
				class="inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium {actionBadgeColor}"
			>
				{policy.action}
			</span>
		</div>
		{#if policy.resourceType}
			<div class="flex items-center gap-2">
				<span class="text-xs text-slate-500">Resource:</span>
				<span class="text-xs text-slate-300">{policy.resourceType}</span>
			</div>
		{/if}
		{#if policy.namespacePattern}
			<div class="flex items-center gap-2">
				<span class="text-xs text-slate-500">Namespace:</span>
				<code class="rounded bg-slate-700 px-1.5 py-0.5 text-xs text-amber-400">{policy.namespacePattern}</code>
			</div>
		{/if}
	</div>

	<div class="mb-3">
		<p class="mb-1 text-xs text-slate-500">Assigned to:</p>
		{#if assignedUsers.length > 0}
			<div class="flex flex-wrap gap-1">
				{#each assignedUsers as user (user.id)}
					<form
						method="POST"
						action="?/unbind"
						use:enhance={() => {
							return async ({ result }) => {
								if (result.type === 'success') await invalidateAll();
							};
						}}
						class="inline"
					>
						<input type="hidden" name="_csrf" value={getCsrfToken()} />
						<input type="hidden" name="userId" value={user.id} />
						<input type="hidden" name="policyId" value={policy.id} />
						<input type="hidden" name="policyName" value={policy.name} />
						<button
							type="submit"
							class="inline-flex items-center gap-1 rounded-full bg-slate-700 px-2 py-1 text-xs text-slate-300 transition-colors hover:bg-red-500/20 hover:text-red-400"
						>
							{user.username}
							<svg class="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
								<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
							</svg>
						</button>
					</form>
				{/each}
			</div>
		{:else}
			<span class="text-xs text-slate-500 italic">Not assigned to any users</span>
		{/if}
	</div>

	<div class="flex justify-end gap-2 border-t border-slate-700/50 pt-3">
		<Button variant="ghost" size="sm" onclick={() => onAssign(policy)} title="Assign to User">
			<svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
				<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
			</svg>
		</Button>
		<Button
			variant="ghost"
			size="sm"
			onclick={() => onDelete(policy)}
			class="text-red-400 hover:text-red-300"
			title="Delete Policy"
		>
			<svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
				<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
			</svg>
		</Button>
	</div>
</div>
