<script lang="ts">
	import { enhance } from '$app/forms';
	import { invalidateAll } from '$app/navigation';
	import Button from '$lib/components/ui/button/button.svelte';
	import * as Select from '$lib/components/ui/select';
	import { getCsrfToken } from '$lib/utils/csrf';
	import type { Policy, PolicyUser } from './policy-types';

	let {
		policy,
		users,
		assignedUsers,
		selectedUserId = $bindable(''),
		onClose
	}: {
		policy: Policy;
		users: PolicyUser[];
		assignedUsers: PolicyUser[];
		selectedUserId: string;
		onClose: () => void;
	} = $props();

	const availableUsers = $derived(
		users.filter(
			(user) => user.active && !assignedUsers.some((assigned) => assigned.id === user.id)
		)
	);
</script>

<div
	class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-0 sm:p-4"
	role="dialog"
	aria-modal="true"
	tabindex="-1"
	aria-labelledby="assign-policy-title"
	onclick={(e) => e.target === e.currentTarget && onClose()}
	onkeydown={(e) => e.key === 'Escape' && onClose()}
>
	<div
		class="h-full w-full overflow-y-auto border border-slate-700 bg-slate-800 p-6 shadow-2xl sm:h-auto sm:max-w-md sm:rounded-xl"
	>
		<h2 id="assign-policy-title" class="mb-4 text-xl font-bold text-white">Assign Policy</h2>
		<p class="mb-4 text-slate-400">
			Assign <strong class="text-white">{policy.name}</strong> to a user:
		</p>

		<form
			method="POST"
			action="?/bind"
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
			<input type="hidden" name="policyId" value={policy.id} />
			<input type="hidden" name="policyName" value={policy.name} />

			<div>
				<label for="userId" class="mb-1 block text-sm font-medium text-slate-300">Select User</label>
				<Select.Root
					type="single"
					value={selectedUserId}
					onValueChange={(value) => (selectedUserId = value)}
				>
					<Select.Trigger id="userId" class="w-full">
						<Select.Value placeholder="Choose a user...">
							{users.find((user) => user.id === selectedUserId)?.username || 'Choose a user...'}
						</Select.Value>
					</Select.Trigger>
					<Select.Content>
						<Select.Item value="">Choose a user...</Select.Item>
						{#each availableUsers as user (user.id)}
							<Select.Item value={user.id}>{user.username} ({user.role})</Select.Item>
						{/each}
					</Select.Content>
				</Select.Root>
				<input type="hidden" name="userId" value={selectedUserId} />
			</div>

			<div class="flex justify-end gap-3 pt-4">
				<Button type="button" variant="ghost" onclick={onClose}>Cancel</Button>
				<Button
					type="submit"
					class="bg-gradient-to-r from-amber-500 to-amber-600 text-slate-900 hover:from-amber-400 hover:to-amber-500"
				>
					Assign to User
				</Button>
			</div>
		</form>
	</div>
</div>
