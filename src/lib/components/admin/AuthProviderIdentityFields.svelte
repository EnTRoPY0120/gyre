<script lang="ts">
	import * as Select from '$lib/components/ui/select';
	import type { AuthProviderFormData, AuthProviderType } from './auth-provider';

	let {
		formData,
		isCreate,
		idPrefix
	}: {
		formData: AuthProviderFormData;
		isCreate: boolean;
		idPrefix: string;
	} = $props();

	const providerTypeNames: Record<string, string> = {
		oidc: 'OIDC',
		'oauth2-google': 'Google OAuth',
		'oauth2-github': 'GitHub OAuth',
		'oauth2-gitlab': 'GitLab OAuth',
		'oauth2-generic': 'Generic OAuth2'
	};

	function getProviderTypeName(type: string): string {
		return providerTypeNames[type] ?? type;
	}
</script>

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
			onValueChange={(value) => (formData.type = value as AuthProviderType)}
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
