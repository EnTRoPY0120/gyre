<script lang="ts">
	import { ShieldCheck } from '@lucide/svelte';
	import Button from '$lib/components/ui/button/button.svelte';
	import Pagination from '$lib/components/ui/pagination/Pagination.svelte';
	import PolicyCard from '$lib/components/admin/PolicyCard.svelte';
	import type { Policy, PolicyUser } from '$lib/components/admin/policy-types';

	let {
		policies,
		usersWithPolicy,
		total,
		limit,
		offset,
		getRoleBadgeColor,
		getActionBadgeColor,
		onAssign,
		onDelete,
		onPageChange,
		onCreate
	}: {
		policies: Policy[];
		usersWithPolicy: (policyId: string) => PolicyUser[];
		total: number;
		limit: number;
		offset: number;
		getRoleBadgeColor: (role: string) => string;
		getActionBadgeColor: (action: string) => string;
		onAssign: (policy: Policy) => void;
		onDelete: (policy: Policy) => void;
		onPageChange: (offset: number) => void;
		onCreate: () => void;
	} = $props();
</script>

{#if policies.length > 0}
	<div class="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
		{#each policies as policy (policy.id)}
			<PolicyCard
				{policy}
				assignedUsers={usersWithPolicy(policy.id)}
				roleBadgeColor={getRoleBadgeColor(policy.role)}
				actionBadgeColor={getActionBadgeColor(policy.action)}
				onAssign={onAssign}
				onDelete={onDelete}
			/>
		{/each}
	</div>

	<Pagination {total} {limit} {offset} onPageChange={onPageChange} />
{:else}
	<div class="rounded-xl border border-slate-700/50 bg-slate-800/50 p-12 text-center">
		<div class="mb-4 flex justify-center">
			<div class="flex h-16 w-16 items-center justify-center rounded-full bg-slate-700">
				<ShieldCheck class="h-8 w-8 text-slate-400" />
			</div>
		</div>
		<h3 class="mb-2 text-lg font-medium text-white">No policies yet</h3>
		<p class="mb-6 text-slate-400">Create your first RBAC policy to control user access</p>
		<Button onclick={onCreate}>Create Policy</Button>
	</div>
{/if}
