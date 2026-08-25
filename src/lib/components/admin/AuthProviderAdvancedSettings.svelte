<script lang="ts">
	import type { AuthProviderFormData } from './auth-provider';

	let {
		formData = $bindable(),
		idPrefix,
		roleMappingError
	}: {
		formData: AuthProviderFormData;
		idPrefix: string;
		roleMappingError: string;
	} = $props();
</script>

<details class="rounded-lg border border-slate-700 bg-slate-900/50 p-4">
	<summary class="cursor-pointer text-sm font-medium text-slate-300">Advanced Settings</summary>
	<div class="mt-4 space-y-4">
		<div>
			<label for={`${idPrefix}scopes`} class="mb-1 block text-sm font-medium text-slate-300">Scopes</label>
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
