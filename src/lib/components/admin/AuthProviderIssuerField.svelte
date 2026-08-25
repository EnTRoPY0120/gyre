<script lang="ts">
	import type { AuthProviderFormData } from './auth-provider';

	let {
		formData,
		idPrefix
	}: {
		formData: AuthProviderFormData;
		idPrefix: string;
	} = $props();
</script>

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
