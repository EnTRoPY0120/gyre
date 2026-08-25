<script lang="ts">
	import type { AuthProviderSummary } from './auth-provider';

	let {
		provider,
		getProviderTypeName,
		onToggle,
		onEdit,
		onDelete
	}: {
		provider: AuthProviderSummary;
		getProviderTypeName: (type: string) => string;
		onToggle: (provider: AuthProviderSummary) => void;
		onEdit: (provider: AuthProviderSummary) => void;
		onDelete: (provider: AuthProviderSummary) => void;
	} = $props();
</script>

<div class="rounded-lg border border-slate-700 bg-slate-800/50 p-6 transition-colors hover:border-slate-600">
	<div class="flex items-start justify-between gap-4">
		<div class="min-w-0 flex-1">
			<div class="flex flex-wrap items-center gap-3">
				<h3 class="text-lg font-semibold text-slate-100">{provider.name}</h3>
				<span
					class="rounded-full px-2.5 py-0.5 text-xs font-medium {provider.enabled
						? 'bg-green-500/10 text-green-400'
						: 'bg-slate-600/20 text-slate-400'}"
				>
					{provider.enabled ? 'Enabled' : 'Disabled'}
				</span>
				<span class="rounded-full bg-slate-700 px-2.5 py-0.5 text-xs font-medium text-slate-300">
					{getProviderTypeName(provider.type)}
				</span>
			</div>

			<div class="mt-4 grid grid-cols-1 gap-x-4 gap-y-2 text-sm sm:grid-cols-2">
				<div>
					<span class="text-slate-400">Client ID:</span>
					<span class="ml-2 font-mono text-slate-300">{provider.clientId}</span>
				</div>
				{#if provider.issuerUrl}
					<div>
						<span class="text-slate-400">Issuer:</span>
						<span class="ml-2 text-slate-300">{provider.issuerUrl}</span>
					</div>
				{/if}
				<div>
					<span class="text-slate-400">Auto-provision:</span>
					<span class="ml-2 text-slate-300">{provider.autoProvision ? 'Yes' : 'No'}</span>
				</div>
				<div>
					<span class="text-slate-400">Default Role:</span>
					<span class="ml-2 text-slate-300 capitalize">{provider.defaultRole}</span>
				</div>
				<div>
					<span class="text-slate-400">PKCE:</span>
					<span class="ml-2 text-slate-300">{provider.usePkce ? 'Enabled' : 'Disabled'}</span>
				</div>
				<div>
					<span class="text-slate-400">Scopes:</span>
					<span class="ml-2 font-mono text-xs text-slate-300">{provider.scopes}</span>
				</div>
			</div>
		</div>

		<div class="flex items-center gap-2">
			<button
				type="button"
				onclick={() => onToggle(provider)}
				class="rounded-lg p-2 transition-colors hover:bg-slate-700"
				title={provider.enabled ? 'Disable' : 'Enable'}
				aria-label={`${provider.enabled ? 'Disable' : 'Enable'} provider ${provider.name}`}
			>
				{provider.enabled ? '✓' : '×'}
			</button>
			<button
				type="button"
				onclick={() => onEdit(provider)}
				class="rounded-lg p-2 text-slate-400 transition-colors hover:bg-slate-700"
				aria-label={`Edit provider ${provider.name}`}
			>
				Edit
			</button>
			<button
				type="button"
				onclick={() => onDelete(provider)}
				class="rounded-lg p-2 text-red-400 transition-colors hover:bg-slate-700"
				aria-label={`Delete provider ${provider.name}`}
			>
				Delete
			</button>
		</div>
	</div>
</div>
