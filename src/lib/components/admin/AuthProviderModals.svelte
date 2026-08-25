<script lang="ts">
	import AuthProviderDeleteDialog from './AuthProviderDeleteDialog.svelte';
	import AuthProviderForm from './AuthProviderForm.svelte';
	import type { AuthProviderFormData, AuthProviderSummary } from './auth-provider';

	type Props = {
		showCreate: boolean;
		showEdit: boolean;
		showDelete: boolean;
		selectedProvider: AuthProviderSummary | null;
		formData: AuthProviderFormData;
		roleMappingError: string;
		error: string;
		success: string;
		loading: boolean;
		onCreate: () => void | Promise<void>;
		onUpdate: () => void | Promise<void>;
		onDelete: () => void | Promise<void>;
		onClose: () => void;
	};

	let {
		showCreate,
		showEdit,
		showDelete,
		selectedProvider,
		formData = $bindable(),
		roleMappingError = $bindable(''),
		error,
		success,
		loading,
		onCreate,
		onUpdate,
		onDelete,
		onClose
	}: Props = $props();
</script>

{#if showCreate}
	<AuthProviderForm
		bind:formData
		bind:roleMappingError
		mode="create"
		{error}
		{success}
		{loading}
		onSubmit={() => onCreate()}
		onClose={onClose}
	/>
{/if}

{#if showEdit && selectedProvider}
	<AuthProviderForm
		bind:formData
		bind:roleMappingError
		mode="edit"
		providerName={selectedProvider.name}
		{error}
		{success}
		{loading}
		onSubmit={() => onUpdate()}
		onClose={onClose}
	/>
{/if}

{#if showDelete && selectedProvider}
	<AuthProviderDeleteDialog
		provider={selectedProvider}
		{error}
		{loading}
		onClose={onClose}
		onDelete={onDelete}
	/>
{/if}
