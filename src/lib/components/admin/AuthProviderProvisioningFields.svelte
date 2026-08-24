<script lang="ts">
	import * as Select from '$lib/components/ui/select';
	import type { AuthProviderFormData, AuthProviderRole } from './auth-provider';

	let {
		formData,
		idPrefix
	}: {
		formData: AuthProviderFormData;
		idPrefix: string;
	} = $props();
</script>

<div class="grid grid-cols-2 gap-4">
	<div>
		<label class="flex items-center gap-2 text-sm font-medium text-slate-300">
			<input
				id={`${idPrefix}auto-provision`}
				type="checkbox"
				bind:checked={formData.autoProvision}
				class="rounded"
			/>
			Auto-provision users
		</label>
	</div>
	<div>
		<label for={`${idPrefix}default-role`} class="mb-1 block text-sm font-medium text-slate-300"
			>Default Role</label
		>
		<Select.Root
			type="single"
			value={formData.defaultRole}
			onValueChange={(value) => (formData.defaultRole = value as AuthProviderRole)}
		>
			<Select.Trigger id={`${idPrefix}default-role`} class="w-full">
				<Select.Value placeholder="Select Default Role">
					<span class="capitalize">{formData.defaultRole}</span>
				</Select.Value>
			</Select.Trigger>
			<Select.Content>
				<Select.Item value="viewer">Viewer</Select.Item>
				<Select.Item value="editor">Editor</Select.Item>
				<Select.Item value="admin">Admin</Select.Item>
			</Select.Content>
		</Select.Root>
	</div>
</div>
