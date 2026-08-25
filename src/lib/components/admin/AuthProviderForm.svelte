<script lang="ts">
	import { modalFocusTrap } from '$lib/utils/focus-trap';
	import { parseRoleMappingInput } from '$lib/auth/role-mapping';
	import type { AuthProviderFormData } from './auth-provider';
	import AuthProviderAdvancedSettings from './AuthProviderAdvancedSettings.svelte';
	import AuthProviderFormActions from './AuthProviderFormActions.svelte';
	import AuthProviderIdentityFields from './AuthProviderIdentityFields.svelte';
	import AuthProviderIssuerField from './AuthProviderIssuerField.svelte';
	import AuthProviderProvisioningFields from './AuthProviderProvisioningFields.svelte';

	type Props = {
		mode: 'create' | 'edit';
		providerName?: string;
		formData: AuthProviderFormData;
		roleMappingError: string;
		error: string;
		success: string;
		loading: boolean;
		onSubmit: (formData: AuthProviderFormData) => void | Promise<void>;
		onClose: () => void;
	};

	let {
		mode,
		providerName = '',
		formData = $bindable(),
		roleMappingError = $bindable(''),
		error,
		success,
		loading,
		onSubmit,
		onClose
	}: Props = $props();

	const isCreate = $derived(mode === 'create');
	const title = $derived(isCreate ? 'Add SSO Provider' : `Edit Provider: ${providerName}`);
	const titleId = $derived(isCreate ? 'create-provider-title' : 'edit-provider-title');
	const idPrefix = $derived(isCreate ? '' : 'edit-');

	$effect(() => {
		const mapping = formData.roleMapping.trim();
		if (!mapping) {
			roleMappingError = '';
			return;
		}

		try {
			parseRoleMappingInput(mapping);
			roleMappingError = '';
		} catch (e) {
			roleMappingError = e instanceof Error ? e.message : 'Role mapping is invalid';
		}
	});

</script>

<div
	use:modalFocusTrap
	class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-0 sm:p-4"
	role="dialog"
	aria-modal="true"
	tabindex="-1"
	aria-labelledby={titleId}
	onclick={(e) => e.target === e.currentTarget && onClose()}
	onkeydown={(e) => e.key === 'Escape' && onClose()}
>
	<div
		class="h-full w-full overflow-y-auto border border-slate-700 bg-slate-800 p-6 sm:h-auto sm:max-h-[90vh] sm:max-w-2xl sm:rounded-lg"
	>
		<div class="mb-6 flex items-center justify-between">
			<h2 id={titleId} class="text-xl font-bold text-slate-100">{title}</h2>
			<button
				type="button"
				aria-label="Close"
				onclick={onClose}
				class="text-slate-400 hover:text-slate-300"
			>
				<svg class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
					<path
						stroke-linecap="round"
						stroke-linejoin="round"
						stroke-width="2"
						d="M6 18L18 6M6 6l12 12"
					/>
				</svg>
			</button>
		</div>

		{#if error}
			<div class="mb-4 rounded-lg border border-red-500/20 bg-red-500/10 p-3 text-sm text-red-400">
				{error}
			</div>
		{/if}

		{#if success}
			<div
				class="mb-4 rounded-lg border border-green-500/20 bg-green-500/10 p-3 text-sm text-green-400"
			>
				{success}
			</div>
		{/if}

		<form
			onsubmit={(e) => {
				e.preventDefault();
				void onSubmit(formData);
			}}
			class="space-y-4"
		>
			<AuthProviderIdentityFields {formData} {isCreate} {idPrefix} />
			<AuthProviderIssuerField {formData} {idPrefix} />
			<AuthProviderProvisioningFields {formData} {idPrefix} />

			<AuthProviderAdvancedSettings bind:formData {idPrefix} {roleMappingError} />

			<AuthProviderFormActions {loading} {isCreate} {roleMappingError} {onClose} />
		</form>
	</div>
</div>
