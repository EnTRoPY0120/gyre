<script lang="ts">
	import { LogIn, Loader2, Eye, EyeOff } from '@lucide/svelte';

	let {
		username = $bindable(''),
		password = $bindable(''),
		errors = {},
		loading = false,
		onSubmit
	}: {
		username: string;
		password: string;
		errors?: Record<string, string>;
		loading?: boolean;
		onSubmit: (event: SubmitEvent) => void | Promise<void>;
	} = $props();

	let showPassword = $state(false);
</script>

<form onsubmit={onSubmit} class="local-form">
	<div class="field">
		<label for="username">Username</label>
		<input
			id="username"
			type="text"
			bind:value={username}
			placeholder="your-username"
			required
			autocomplete="username"
			class:field-error={errors.username}
		/>
		{#if errors.username}
			<span class="field-error-msg">{errors.username}</span>
		{/if}
	</div>

	<div class="field">
		<label for="password">Password</label>
		<div class="password-wrap">
			<input
				id="password"
				type={showPassword ? 'text' : 'password'}
				bind:value={password}
				placeholder="••••••••"
				required
				autocomplete="current-password"
				class:field-error={errors.password}
			/>
			<button
				type="button"
				onclick={() => (showPassword = !showPassword)}
				class="eye-toggle"
				aria-label={showPassword ? 'Hide password' : 'Show password'}
			>
				{#if showPassword}
					<EyeOff size={16} />
				{:else}
					<Eye size={16} />
				{/if}
			</button>
		</div>
		{#if errors.password}
			<span class="field-error-msg">{errors.password}</span>
		{/if}
	</div>

	<button type="submit" disabled={loading} class="submit-btn">
		{#if loading}
			<Loader2 size={16} class="animate-spin" />
			<span>Signing in…</span>
		{:else}
			<LogIn size={16} />
			<span>Sign In</span>
		{/if}
	</button>
</form>

<style>
	.local-form {
		display: flex;
		flex-direction: column;
		gap: 1rem;
	}

	.field {
		display: flex;
		flex-direction: column;
		gap: 0.375rem;
	}

	.field label {
		font-size: 0.8125rem;
		font-weight: 500;
		color: rgba(255, 255, 255, 0.6);
		letter-spacing: 0.01em;
	}

	.field input {
		width: 100%;
		padding: 0.625rem 0.875rem;
		background: rgba(255, 255, 255, 0.04);
		border: 1px solid rgba(255, 255, 255, 0.1);
		border-radius: 0.5rem;
		color: #fff;
		font-size: 0.875rem;
		font-family: inherit;
		outline: none;
		transition: border-color 0.15s ease, box-shadow 0.15s ease;
		box-sizing: border-box;
	}

	.field input::placeholder {
		color: rgba(255, 255, 255, 0.2);
	}

	.field input:focus {
		border-color: rgba(251, 191, 36, 0.5);
		box-shadow: 0 0 0 3px rgba(251, 191, 36, 0.08);
	}

	.field input.field-error {
		border-color: rgba(239, 68, 68, 0.5);
		box-shadow: 0 0 0 3px rgba(239, 68, 68, 0.06);
	}

	.field-error-msg {
		font-size: 0.75rem;
		color: #f87171;
	}

	.password-wrap {
		position: relative;
	}

	.password-wrap input {
		padding-right: 2.5rem;
	}

	.eye-toggle {
		position: absolute;
		top: 50%;
		right: 0.75rem;
		transform: translateY(-50%);
		background: none;
		border: none;
		cursor: pointer;
		color: rgba(255, 255, 255, 0.3);
		display: flex;
		align-items: center;
		padding: 0;
		transition: color 0.15s ease;
	}

	.eye-toggle:hover {
		color: rgba(255, 255, 255, 0.6);
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

	input:-webkit-autofill,
	input:-webkit-autofill:hover,
	input:-webkit-autofill:focus,
	input:-webkit-autofill:active {
		-webkit-box-shadow: 0 0 0 30px #111114 inset !important;
		-webkit-text-fill-color: #fff !important;
		transition: background-color 5000s ease-in-out 0s;
	}
</style>
