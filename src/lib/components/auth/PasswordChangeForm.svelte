<script lang="ts">
	import { Loader2, ShieldAlert } from '@lucide/svelte';
	import PasswordInput from './PasswordInput.svelte';
	import PasswordStrength from './PasswordStrength.svelte';

	export interface PasswordChangeValues {
	currentPassword: string;
	newPassword: string;
	confirmPassword: string;
}

	let {
		isFirstLogin,
		loading = false,
		onSubmit
	}: {
		isFirstLogin: boolean;
		loading?: boolean;
		onSubmit: (values: PasswordChangeValues) => void | Promise<void>;
	} = $props();

	let currentPassword = $state('');
	let newPassword = $state('');
	let confirmPassword = $state('');

	function submit(event: SubmitEvent) {
		event.preventDefault();
		return onSubmit({ currentPassword, newPassword, confirmPassword });
	}
</script>

{#if isFirstLogin}
	<div class="notice-box">
		<div class="notice-icon">
			<ShieldAlert size={20} />
		</div>
		<div class="notice-content">
			<h3>Account Activated</h3>
			<p>For security, please set a new password before continuing to the dashboard.</p>
		</div>
	</div>
{/if}

<form onsubmit={submit} class="local-form">
	<PasswordInput id="currentPassword" label="Current Password" bind:value={currentPassword} />

	<div class="field">
		<PasswordInput id="newPassword" label="New Password" bind:value={newPassword} />
		<PasswordStrength password={newPassword} />
	</div>

	<PasswordInput id="confirmPassword" label="Confirm New Password" bind:value={confirmPassword} />

	<button type="submit" disabled={loading} class="submit-btn">
		{#if loading}
			<Loader2 size={16} class="animate-spin" />
			<span>Updating…</span>
		{:else}
			<span>Change Password</span>
		{/if}
	</button>

	{#if !isFirstLogin}
		<div class="mt-2 text-center">
			<a href="/" class="cancel-link">Cancel and return to dashboard</a>
		</div>
	{/if}
</form>

<style>
	.notice-box {
		display: flex;
		align-items: flex-start;
		gap: 0.75rem;
		padding: 1rem;
		background: rgba(251, 191, 36, 0.06);
		border: 1px solid rgba(251, 191, 36, 0.15);
		border-radius: 0.75rem;
	}

	.notice-icon {
		color: #fbbf24;
		margin-top: 0.125rem;
	}

	.notice-content h3 {
		font-size: 0.875rem;
		font-weight: 600;
		color: #fbbf24;
		margin: 0 0 0.25rem 0;
	}

	.notice-content p {
		font-size: 0.8125rem;
		color: rgba(255, 255, 255, 0.6);
		margin: 0;
		line-height: 1.4;
	}

	.local-form {
		display: flex;
		flex-direction: column;
		gap: 1rem;
	}

	.submit-btn {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 0.5rem;
		width: 100%;
		margin-top: 0.25rem;
		padding: 0.6875rem 1rem;
		background: hsl(45 93% 47%);
		color: #0d0d0f;
		font-size: 0.875rem;
		font-weight: 600;
		font-family: inherit;
		letter-spacing: 0.01em;
		border: none;
		border-radius: 0.5rem;
		cursor: pointer;
		transition: background 0.15s ease, box-shadow 0.15s ease, transform 0.1s ease;
	}

	.submit-btn:hover:not(:disabled) {
		background: hsl(45 93% 52%);
		box-shadow: 0 0 0 4px rgba(251, 191, 36, 0.12), 0 4px 12px rgba(251, 191, 36, 0.2);
	}

	.submit-btn:active:not(:disabled) {
		transform: scale(0.985);
	}

	.submit-btn:disabled {
		opacity: 0.55;
		cursor: not-allowed;
	}

	.cancel-link {
		font-size: 0.75rem;
		color: rgba(255, 255, 255, 0.4);
		text-decoration: none;
		transition: color 0.15s ease;
	}

	.cancel-link:hover {
		color: rgba(251, 191, 36, 0.8);
	}

</style>
