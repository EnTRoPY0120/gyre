<script lang="ts">
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import { toast } from 'svelte-sonner';
	import { Loader2, Eye, EyeOff, Check, X, ShieldAlert } from 'lucide-svelte';
	import { changePasswordSchema } from '$lib/utils/validation';
	import { getCsrfToken } from '$lib/utils/csrf';
	import type { PageData } from './$types';

	let { data } = $props<{ data: PageData }>();

	let currentPassword = $state('');
	let newPassword = $state('');
	let confirmPassword = $state('');
	let showCurrent = $state(false);
	let showNew = $state(false);
	let showConfirm = $state(false);
	let loading = $state(false);

	const isFirstLogin = $derived(data.isFirstLogin);

	// Password strength requirements
	const requirements = $derived([
		{ label: '8+ characters', met: newPassword.length >= 8 },
		{ label: 'Uppercase letter', met: /[A-Z]/.test(newPassword) },
		{ label: 'Lowercase letter', met: /[a-z]/.test(newPassword) },
		{ label: 'Number', met: /[0-9]/.test(newPassword) },
		{ label: 'Special character', met: /[!@#$%^&*(),.?":{}|<>]/.test(newPassword) }
	]);

	const strengthScore = $derived(requirements.filter((r) => r.met).length);
	const strengthColor = $derived(() => {
		if (strengthScore <= 2) return 'bg-red-500';
		if (strengthScore <= 4) return 'bg-amber-500';
		return 'bg-emerald-500';
	});

	const strengthText = $derived(() => {
		if (strengthScore === 0) return 'Very Weak';
		if (strengthScore <= 2) return 'Weak';
		if (strengthScore <= 4) return 'Medium';
		return 'Strong';
	});

	async function handleSubmit(event: Event) {
		event.preventDefault();
		loading = true;

		// Client-side validation with Zod
		const validation = changePasswordSchema.safeParse({
			currentPassword,
			newPassword,
			confirmPassword
		});

		if (!validation.success) {
			const firstError = validation.error.issues[0];
			toast.error(firstError.message);
			loading = false;
			return;
		}

		try {
			const response = await fetch('/api/v1/auth/change-password', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': getCsrfToken() },
				body: JSON.stringify({
					currentPassword,
					newPassword
				})
			});

			const result = await response.json();

			if (!response.ok) {
				throw new Error(result.message || 'Failed to change password');
			}

			toast.success('Password changed successfully!');

			// Clear form
			currentPassword = '';
			newPassword = '';
			confirmPassword = '';

			// Redirect after a short delay
			setTimeout(() => {
				void goto('/?success=password-changed');
			}, 1500);
		} catch (err) {
			toast.error(err instanceof Error ? err.message : 'An unexpected error occurred');
			loading = false;
		}
	}
</script>

<div class="login-root">
	<!-- Ambient amber glow (centered behind the form) -->
	<div class="ambient-glow" aria-hidden="true"></div>

	<!-- ── Centered form panel ── -->
	<main class="form-panel">
		<!-- Form container -->
		<div class="form-container">
			<!-- Auth Header with Logo -->
			<div class="auth-header">
				<div class="logo-icon">
					<svg viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg">
						<defs>
							<linearGradient id="lg-mobile" x1="0%" y1="0%" x2="100%" y2="100%">
								<stop offset="0%" stop-color="#fbbf24"></stop>
								<stop offset="100%" stop-color="#d97706"></stop>
							</linearGradient>
						</defs>
						<rect width="40" height="40" rx="9" fill="url(#lg-mobile)"></rect>
						<path
							transform="translate(8, 8)"
							d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"
							fill="#0f172a"
						></path>
					</svg>
				</div>
				<span class="logo-name">Gyre</span>
				<span class="alpha-badge">alpha</span>
			</div>

			<div class="form-header">
				<h1 class="form-title">Change Password</h1>
				<p class="form-subtitle">Update your credentials to continue</p>
			</div>
			<!-- First Login Notice -->
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

			<form onsubmit={handleSubmit} class="local-form">
				<!-- Current Password -->
				<div class="field">
					<label for="currentPassword">Current Password</label>
					<div class="password-wrap">
						<input
							id="currentPassword"
							type={showCurrent ? 'text' : 'password'}
							bind:value={currentPassword}
							placeholder="••••••••"
							required
						/>
						<button
							type="button"
							onclick={() => (showCurrent = !showCurrent)}
							class="eye-toggle"
							aria-label={showCurrent ? 'Hide password' : 'Show password'}
						>
							{#if showCurrent}
								<EyeOff size={16} />
							{:else}
								<Eye size={16} />
							{/if}
						</button>
					</div>
				</div>

				<!-- New Password -->
				<div class="field">
					<label for="newPassword">New Password</label>
					<div class="password-wrap">
						<input
							id="newPassword"
							type={showNew ? 'text' : 'password'}
							bind:value={newPassword}
							placeholder="••••••••"
							required
						/>
						<button
							type="button"
							onclick={() => (showNew = !showNew)}
							class="eye-toggle"
							aria-label={showNew ? 'Hide password' : 'Show password'}
						>
							{#if showNew}
								<EyeOff size={16} />
							{:else}
								<Eye size={16} />
							{/if}
						</button>
					</div>

					<!-- Strength Indicator -->
					{#if newPassword.length > 0}
						<div class="strength-indicator">
							<div class="strength-header">
								<span>Strength: {strengthText()}</span>
								<span class={strengthScore >= 4 ? 'text-emerald-400' : 'text-slate-500'}>
									{strengthScore}/5
								</span>
							</div>
							<div class="strength-bars">
								{#each Array(5) as _, i (i)}
									<div
										class="strength-bar {i < strengthScore
											? strengthColor()
											: 'bg-slate-700'}"
									></div>
								{/each}
							</div>

							<!-- Requirements List -->
							<div class="requirements-list">
								{#each requirements as req (req.label)}
									<div class="requirement-item">
										{#if req.met}
											<div class="req-icon met">
												<Check size={10} />
											</div>
										{:else}
											<div class="req-icon unmet">
												<X size={10} />
											</div>
										{/if}
										<span class={req.met ? 'text-slate-300' : 'text-slate-500'}>
											{req.label}
										</span>
									</div>
								{/each}
							</div>
						</div>
					{/if}
				</div>

				<!-- Confirm Password -->
				<div class="field">
					<label for="confirmPassword">Confirm New Password</label>
					<div class="password-wrap">
						<input
							id="confirmPassword"
							type={showConfirm ? 'text' : 'password'}
							bind:value={confirmPassword}
							placeholder="••••••••"
							required
						/>
						<button
							type="button"
							onclick={() => (showConfirm = !showConfirm)}
							class="eye-toggle"
							aria-label={showConfirm ? 'Hide password' : 'Show password'}
						>
							{#if showConfirm}
								<EyeOff size={16} />
							{:else}
								<Eye size={16} />
							{/if}
						</button>
					</div>
				</div>

				<button type="submit" disabled={loading} class="submit-btn">
					{#if loading}
						<Loader2 size={16} class="animate-spin" />
						<span>Updating…</span>
					{:else}
						<span>Change Password</span>
					{/if}
				</button>

				{#if !isFirstLogin}
					<div class="text-center mt-2">
						<a href="/" class="cancel-link">
							Cancel and return to dashboard
						</a>
					</div>
				{/if}
			</form>
		</div>
	</main>
</div>

<style>
	/* ── Root layout ── */
	.login-root {
		display: flex;
		min-height: 100svh;
		background: #080809;
		font-family: 'Inter', ui-sans-serif, system-ui, sans-serif;
		position: relative;
		overflow: hidden;
	}

	/* Ambient amber glow */
	.ambient-glow {
		position: absolute;
		top: 50%;
		left: 50%;
		transform: translate(-50%, -50%);
		width: 800px;
		height: 800px;
		border-radius: 50%;
		background: radial-gradient(circle, rgba(251, 191, 36, 0.05) 0%, transparent 65%);
		pointer-events: none;
		z-index: 0;
	}

	/* ══════════════════════════════
	   Form panel
	══════════════════════════════ */
	.form-panel {
		flex: 1;
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		padding: 2rem 1.25rem;
		gap: 2rem;
		position: relative;
		z-index: 10;
	}

	/* Auth logo */
	.auth-header {
		display: flex;
		align-items: center;
		gap: 0.625rem;
	}

	.logo-icon {
		width: 2.25rem;
		height: 2.25rem;
	}

	.logo-icon svg {
		width: 100%;
		height: 100%;
	}

	.logo-name {
		font-family: 'Plus Jakarta Sans', sans-serif;
		font-size: 1.5rem;
		font-weight: 700;
		letter-spacing: -0.03em;
		color: #fff;
	}

	.alpha-badge {
		font-size: 0.625rem;
		font-weight: 600;
		letter-spacing: 0.06em;
		text-transform: lowercase;
		font-variant-numeric: tabular-nums;
		color: rgba(251, 191, 36, 0.55);
		border: 1px solid rgba(251, 191, 36, 0.2);
		border-radius: 4px;
		padding: 0.15rem 0.4rem;
		line-height: 1;
		align-self: center;
	}

	/* Form container */
	.form-container {
		width: 100%;
		max-width: 360px;
		display: flex;
		flex-direction: column;
		gap: 1.5rem;
	}

	.form-header {
		display: flex;
		flex-direction: column;
		gap: 0.375rem;
	}

	.form-title {
		font-family: 'Plus Jakarta Sans', sans-serif;
		font-size: 1.5rem;
		font-weight: 700;
		letter-spacing: -0.035em;
		color: #fff;
		margin: 0;
	}

	.form-subtitle {
		font-size: 0.875rem;
		color: rgba(255, 255, 255, 0.4);
		margin: 0;
	}

	/* ── Notice Box ── */
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

	/* ── Local form ── */
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

	/* ── Strength Indicator ── */
	.strength-indicator {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
		margin-top: 0.5rem;
	}

	.strength-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		font-size: 0.625rem;
		font-weight: 700;
		letter-spacing: 0.05em;
		text-transform: uppercase;
		color: rgba(255, 255, 255, 0.4);
	}

	.strength-bars {
		display: flex;
		height: 4px;
		gap: 4px;
	}

	.strength-bar {
		flex: 1;
		border-radius: 99px;
		transition: background-color 0.5s ease;
	}

	.requirements-list {
		display: grid;
		grid-template-columns: repeat(2, 1fr);
		gap: 0.25rem 1rem;
		margin-top: 0.25rem;
	}

	.requirement-item {
		display: flex;
		align-items: center;
		gap: 0.375rem;
	}

	.requirement-item span {
		font-size: 0.625rem;
	}

	.req-icon {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 1rem;
		height: 1rem;
		border-radius: 99px;
	}

	.req-icon.met {
		background: rgba(16, 185, 129, 0.2);
		color: #10b981;
	}

	.req-icon.unmet {
		background: rgba(255, 255, 255, 0.1);
		color: rgba(255, 255, 255, 0.4);
	}

	/* ── Submit button ── */
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

	/* ── Autofill override ── */
	input:-webkit-autofill,
	input:-webkit-autofill:hover,
	input:-webkit-autofill:focus,
	input:-webkit-autofill:active {
		-webkit-box-shadow: 0 0 0 30px #111114 inset !important;
		-webkit-text-fill-color: #fff !important;
		transition: background-color 5000s ease-in-out 0s;
	}
</style>
