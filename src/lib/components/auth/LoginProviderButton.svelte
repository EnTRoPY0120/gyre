<script lang="ts">
	import { getProviderColor, getProviderIcon, type LoginProvider } from '$lib/auth/login-flow';

	let { provider, onLogin }: { provider: LoginProvider; onLogin: (providerId: string) => void } = $props();
</script>

<button
	type="button"
	onclick={() => onLogin(provider.id)}
	class="sso-btn {getProviderColor(provider.type)}"
>
	{#if getProviderIcon(provider.type) === 'google'}
		<svg class="provider-icon" viewBox="0 0 24 24" fill="currentColor">
			<path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
			<path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
			<path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
			<path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
		</svg>
	{:else if getProviderIcon(provider.type) === 'github'}
		<svg class="provider-icon" viewBox="0 0 24 24" fill="currentColor">
			<path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/>
		</svg>
	{:else if getProviderIcon(provider.type) === 'gitlab'}
		<svg class="provider-icon" viewBox="0 0 24 24" fill="currentColor">
			<path d="M23.955 13.587l-1.342-4.135-2.664-8.189c-.135-.417-.724-.417-.859 0L16.426 9.452H7.574L4.91 1.263c-.135-.417-.724-.417-.859 0L1.387 9.452.045 13.587c-.114.352.016.741.321.962L12 23l11.634-8.451c.305-.221.435-.61.321-.962z"/>
		</svg>
	{:else if getProviderIcon(provider.type) === 'shield'}
		<svg class="provider-icon" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
			<path stroke-linecap="round" stroke-linejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"/>
		</svg>
	{:else}
		<svg class="provider-icon" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
			<path stroke-linecap="round" stroke-linejoin="round" d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z"/>
		</svg>
	{/if}
	<span>Continue with {provider.name}</span>
</button>

<style>
	.sso-btn {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 0.625rem;
		width: 100%;
		padding: 0.6875rem 1rem;
		border-radius: 0.5rem;
		border: 1px solid transparent;
		font-size: 0.875rem;
		font-weight: 500;
		cursor: pointer;
		transition: opacity 0.15s ease, transform 0.1s ease;
		letter-spacing: 0.005em;
	}

	.sso-btn:hover {
		opacity: 0.88;
	}

	.sso-btn:active {
		transform: scale(0.985);
	}

	.provider-icon {
		width: 1rem;
		height: 1rem;
		flex-shrink: 0;
	}

	.provider-google {
		background: #fff;
		color: #3c4043;
		border-color: rgba(0, 0, 0, 0.12);
	}

	.provider-github {
		background: #24292f;
		color: #fff;
		border-color: rgba(255, 255, 255, 0.1);
	}

	.provider-gitlab {
		background: #fc6d26;
		color: #fff;
	}

	.provider-oidc {
		background: rgba(255, 255, 255, 0.07);
		color: rgba(255, 255, 255, 0.8);
		border-color: rgba(255, 255, 255, 0.1);
	}
</style>
