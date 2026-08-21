<script lang="ts">
	import LoginCredentialsForm from './LoginCredentialsForm.svelte';
	import LoginProviders from './LoginProviders.svelte';
	import type { LoginProvider } from '$lib/auth/login-flow';

	let {
		providers = [],
		showLocalLogin,
		showProviders,
		hasAnyAuth,
		errors = {},
		loading = false,
		username = $bindable(''),
		password = $bindable(''),
		onSubmit,
		onSSOLogin
	}: {
		providers: LoginProvider[];
		showLocalLogin: boolean;
		showProviders: boolean;
		hasAnyAuth: boolean;
		errors?: Record<string, string>;
		loading?: boolean;
		username: string;
		password: string;
		onSubmit: (event: SubmitEvent) => void | Promise<void>;
		onSSOLogin: (providerId: string) => void;
	} = $props();
</script>

{#if !hasAnyAuth}
	<div class="no-auth-notice">
		<div class="no-auth-icon">
			<svg fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5">
				<path
					stroke-linecap="round"
					stroke-linejoin="round"
					d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z"
				/>
			</svg>
		</div>
		<h3>No authentication configured</h3>
		<p>Contact your administrator to set up authentication methods.</p>
	</div>
{:else}
	{#if showProviders}
		<LoginProviders {providers} onLogin={onSSOLogin} />
	{/if}

	{#if showProviders && showLocalLogin}
		<div class="divider">
			<span>or sign in with username</span>
		</div>
	{/if}

	{#if showLocalLogin}
		<LoginCredentialsForm
			bind:username
			bind:password
			{errors}
			{loading}
			onSubmit={onSubmit}
		/>
	{/if}
{/if}

<style>
	.no-auth-notice {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 0.75rem;
		text-align: center;
		padding: 2rem 1rem;
		background: rgba(239, 68, 68, 0.06);
		border: 1px solid rgba(239, 68, 68, 0.15);
		border-radius: 0.75rem;
	}

	.no-auth-icon {
		width: 2.5rem;
		height: 2.5rem;
		color: #ef4444;
		opacity: 0.8;
	}

	.no-auth-icon svg {
		width: 100%;
		height: 100%;
	}

	.no-auth-notice h3 {
		font-size: 0.9375rem;
		font-weight: 600;
		color: rgba(255, 255, 255, 0.8);
		margin: 0;
	}

	.no-auth-notice p {
		font-size: 0.8125rem;
		color: rgba(255, 255, 255, 0.38);
		margin: 0;
		line-height: 1.5;
	}

	.divider {
		display: flex;
		align-items: center;
		gap: 0.75rem;
		color: rgba(255, 255, 255, 0.22);
		font-size: 0.75rem;
		letter-spacing: 0.02em;
	}

	.divider::before,
	.divider::after {
		content: '';
		flex: 1;
		height: 1px;
		background: rgba(255, 255, 255, 0.08);
	}
</style>
