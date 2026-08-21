<script lang="ts">
	import * as Select from '$lib/components/ui/select';
	import { modalFocusTrap } from '$lib/utils/focus-trap';
	import {
		DEFAULT_ROLE_MAPPING_TEMPLATE,
		parseRoleMappingInput
	} from '$lib/auth/role-mapping';
	import type { AuthProviderFormData, AuthProviderRole, AuthProviderType } from './auth-provider';

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

	function getProviderTypeName(type: string): string {
		switch (type) {
			case 'oidc':
				return 'OIDC';
			case 'oauth2-google':
				return 'Google OAuth';
			case 'oauth2-github':
				return 'GitHub OAuth';
			case 'oauth2-gitlab':
				return 'GitLab OAuth';
			case 'oauth2-generic':
				return 'Generic OAuth2';
			default:
				return type;
		}
	}
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
			<div class="grid grid-cols-2 gap-4">
				<div>
					<label for={`${idPrefix}provider-name`} class="mb-1 block text-sm font-medium text-slate-300"
						>Provider Name</label
					>
					<input
						id={`${idPrefix}provider-name`}
						type="text"
						bind:value={formData.name}
						placeholder="e.g., Company Okta"
						required
						class="w-full rounded-lg border border-slate-600 bg-slate-700 px-3 py-2 text-white placeholder-slate-400 focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20 focus:outline-none"
					/>
				</div>
				<div>
					<label for={`${idPrefix}provider-type`} class="mb-1 block text-sm font-medium text-slate-300"
						>Provider Type</label
					>
					<Select.Root
						type="single"
						value={formData.type}
						onValueChange={(v) => (formData.type = v as AuthProviderType)}
					>
						<Select.Trigger id={`${idPrefix}provider-type`} class="w-full">
							<Select.Value placeholder="Select Provider Type">
								{getProviderTypeName(formData.type)}
							</Select.Value>
						</Select.Trigger>
						<Select.Content>
							<Select.Item value="oidc">OIDC (Generic)</Select.Item>
							<Select.Item value="oauth2-google">Google OAuth</Select.Item>
							<Select.Item value="oauth2-github">GitHub OAuth</Select.Item>
							<Select.Item value="oauth2-gitlab">GitLab OAuth</Select.Item>
							<Select.Item value="oauth2-generic">Generic OAuth2</Select.Item>
						</Select.Content>
					</Select.Root>
				</div>
			</div>

			<div class="grid grid-cols-2 gap-4">
				<div>
					<label for={`${idPrefix}client-id`} class="mb-1 block text-sm font-medium text-slate-300"
						>Client ID</label
					>
					<input
						id={`${idPrefix}client-id`}
						type="text"
						bind:value={formData.clientId}
						required
						class="w-full rounded-lg border border-slate-600 bg-slate-700 px-3 py-2 text-white focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20 focus:outline-none"
					/>
				</div>
				<div>
					<label for={`${idPrefix}client-secret`} class="mb-1 block text-sm font-medium text-slate-300"
						>Client Secret</label
					>
					<input
						id={`${idPrefix}client-secret`}
						type="password"
						bind:value={formData.clientSecret}
						placeholder={isCreate ? undefined : 'Leave blank to keep current'}
						required={isCreate}
						class="w-full rounded-lg border border-slate-600 bg-slate-700 px-3 py-2 text-white placeholder-slate-400 focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20 focus:outline-none"
					/>
				</div>
			</div>

			{#if formData.type === 'oidc' || formData.type === 'oauth2-generic' || formData.type === 'oauth2-gitlab'}
				<div>
					<label for={`${idPrefix}issuer-url`} class="mb-1 block text-sm font-medium text-slate-300">
						{formData.type === 'oauth2-gitlab' ? 'GitLab Instance URL' : 'Issuer URL'}
					</label>
					<input
						id={`${idPrefix}issuer-url`}
						type="url"
						bind:value={formData.issuerUrl}
						placeholder={formData.type === 'oauth2-gitlab' ? 'https://gitlab.com' : 'https://example.com'}
						required={formData.type !== 'oauth2-gitlab'}
						class="w-full rounded-lg border border-slate-600 bg-slate-700 px-3 py-2 text-white placeholder-slate-400 focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20 focus:outline-none"
					/>
					{#if formData.type === 'oauth2-gitlab'}
						<p class="mt-1 text-xs text-slate-400">Leave empty to use gitlab.com</p>
					{/if}
				</div>
			{/if}

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
						onValueChange={(v) => (formData.defaultRole = v as AuthProviderRole)}
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

			<details class="rounded-lg border border-slate-700 bg-slate-900/50 p-4">
				<summary class="cursor-pointer text-sm font-medium text-slate-300">Advanced Settings</summary>
				<div class="mt-4 space-y-4">
					<div>
						<label for={`${idPrefix}scopes`} class="mb-1 block text-sm font-medium text-slate-300"
							>Scopes</label
						>
						<input
							id={`${idPrefix}scopes`}
							type="text"
							bind:value={formData.scopes}
							class="w-full rounded-lg border border-slate-600 bg-slate-700 px-3 py-2 text-white focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20 focus:outline-none"
						/>
					</div>
					<div>
						<label for={`${idPrefix}role-mapping`} class="mb-1 block text-sm font-medium text-slate-300"
							>Role Mapping (JSON)</label
						>
						<textarea
							id={`${idPrefix}role-mapping`}
							bind:value={formData.roleMapping}
							rows="6"
							class="w-full rounded-lg border {roleMappingError
								? 'border-red-500 focus:ring-red-500/20'
								: 'border-slate-600 focus:border-amber-500 focus:ring-amber-500/20'} bg-slate-700 px-3 py-2 font-mono text-sm text-white focus:ring-2 focus:outline-none"
						></textarea>
						{#if roleMappingError}
							<p class="mt-1 text-xs text-red-400">{roleMappingError}</p>
						{/if}
					</div>
					<div class="flex flex-col gap-1">
						<div class="flex items-center gap-2">
							<input
								id={`${idPrefix}use-pkce`}
								type="checkbox"
								bind:checked={formData.usePkce}
								disabled={formData.type === 'oauth2-gitlab'}
								class="rounded disabled:opacity-50"
							/>
							<label
								for={`${idPrefix}use-pkce`}
								class="text-sm text-slate-300 {formData.type === 'oauth2-gitlab' ? 'opacity-50' : ''}"
							>
								Enable PKCE (Recommended)
							</label>
						</div>
						{#if formData.type === 'oauth2-gitlab'}
							<p class="text-xs text-amber-400/80">
								PKCE is not supported by the GitLab provider and will be ignored.
							</p>
						{/if}
					</div>
				</div>
			</details>

			<div class="flex gap-3 pt-4">
				<button
					type="submit"
					disabled={loading || !!roleMappingError}
					class="flex-1 rounded-lg bg-amber-500 px-4 py-2 font-medium text-slate-900 transition-colors hover:bg-amber-400 disabled:opacity-50"
				>
					{loading ? (isCreate ? 'Creating...' : 'Updating...') : isCreate ? 'Create Provider' : 'Update Provider'}
				</button>
				<button
					type="button"
					onclick={onClose}
					class="rounded-lg border border-slate-600 px-4 py-2 text-slate-300 transition-colors hover:bg-slate-700"
				>
					Cancel
				</button>
			</div>
		</form>
	</div>
</div>
