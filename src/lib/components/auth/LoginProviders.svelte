<script lang="ts">
	import LoginProviderButton from './LoginProviderButton.svelte';
	import type { LoginProvider } from '$lib/auth/login-flow';

	let {
		providers,
		onLogin
	}: {
		providers: LoginProvider[];
		onLogin: (providerId: string) => void;
	} = $props();
</script>

<div class="sso-providers">
	{#each providers as provider (provider.id)}
		<LoginProviderButton {provider} {onLogin} />
	{/each}
</div>

<style>
	.sso-providers {
		display: flex;
		flex-direction: column;
		gap: 0.625rem;
	}
</style>
