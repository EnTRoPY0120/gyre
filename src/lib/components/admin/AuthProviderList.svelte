<script lang="ts">
	import AuthProviderCard from './AuthProviderCard.svelte';
	import type { AuthProviderSummary } from './auth-provider';

	let {
		providers,
		getProviderTypeName,
		onAdd,
		onToggle,
		onEdit,
		onDelete
	}: {
		providers: AuthProviderSummary[];
		getProviderTypeName: (type: string) => string;
		onAdd: () => void;
		onToggle: (provider: AuthProviderSummary) => void;
		onEdit: (provider: AuthProviderSummary) => void;
		onDelete: (provider: AuthProviderSummary) => void;
	} = $props();
</script>

{#if providers.length === 0}
	<div class="rounded-lg border border-slate-700 bg-slate-800/50 p-12 text-center">
		<div class="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-slate-700">
			<svg class="h-6 w-6 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
				<path
					stroke="currentColor"
					stroke-width="2"
					d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z"
				/>
			</svg>
		</div>
		<h3 class="mt-4 text-lg font-medium text-slate-200">No SSO providers configured</h3>
		<p class="mt-2 text-sm text-slate-400">Get started by adding your first authentication provider</p>
		<button
			type="button"
			onclick={onAdd}
			class="mt-4 rounded-lg bg-amber-500 px-4 py-2 text-sm font-medium text-slate-900 transition-colors hover:bg-amber-400"
		>
			Add Provider
		</button>
	</div>
{:else}
	<div class="grid gap-4">
		{#each providers as provider (provider.id)}
			<AuthProviderCard
				{provider}
				{getProviderTypeName}
				onToggle={onToggle}
				onEdit={onEdit}
				onDelete={onDelete}
			/>
		{/each}
	</div>
{/if}
