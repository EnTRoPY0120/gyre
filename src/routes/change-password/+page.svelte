<script lang="ts">
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import { toast } from 'svelte-sonner';
	import PasswordChangeForm, {
		type PasswordChangeValues
	} from '$lib/components/auth/PasswordChangeForm.svelte';
	import { changePasswordSchema } from '$lib/utils/validation';
	import { getCsrfToken } from '$lib/utils/csrf';
	import { submitPasswordChange } from '$lib/auth/password-change-flow';
	import type { PageData } from './$types';

	let { data } = $props<{ data: PageData }>();

	let loading = $state(false);

	const isFirstLogin = $derived(data.isFirstLogin);

	async function handleSubmit({ currentPassword, newPassword, confirmPassword }: PasswordChangeValues) {
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
			await submitPasswordChange(
				{ currentPassword, newPassword },
				getCsrfToken()
			);

			toast.success('Password changed successfully!');

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
			<PasswordChangeForm {isFirstLogin} {loading} onSubmit={handleSubmit} />
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

</style>
