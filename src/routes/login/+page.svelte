<script lang="ts">
	import { toast } from 'svelte-sonner';
	import { page } from '$app/state';
	import type { PageData } from './$types';
	import LoginPanel from '$lib/components/auth/LoginPanel.svelte';
	import { getLoginDestination, LoginRequestError, submitLogin, validateLoginCredentials } from '$lib/auth/login-flow';

	let { data } = $props<{ data: PageData }>();
	let providers = $derived(data.providers || []);
	let localLoginEnabled = $derived(data.localLoginEnabled ?? true);
	let gyreVersion = $derived(data.gyreVersion || '0.0.1');

	let username = $state('');
	let password = $state('');
	let showPassword = $state(false);
	let loading = $state(false);
	let errors = $state<Record<string, string>>({});

	let hasProviders = $derived(providers.length > 0);
	let showLocalLogin = $derived(localLoginEnabled);
	let showProviders = $derived(hasProviders);
	let hasAnyAuth = $derived(showLocalLogin || showProviders);

	$effect(() => {
		const loggedOut = page.url.searchParams.get('loggedOut');
		const errorParam = page.url.searchParams.get('error');

		if (loggedOut === 'true') {
			toast.success('Successfully logged out');
		}

		if (errorParam) {
			toast.error(decodeURIComponent(errorParam));
		}

		if (loggedOut === 'true' || errorParam) {
			const url = new URL(window.location.href);
			url.searchParams.delete('loggedOut');
			url.searchParams.delete('error');
			window.history.replaceState({}, '', url);
		}
	});

	async function handleLogin(event: Event) {
		event.preventDefault();
		loading = true;
		errors = {};

		const validation = validateLoginCredentials(username, password);
		if (validation.firstMessage) {
			errors = validation.errors;
			toast.error(validation.firstMessage);
			loading = false;
			return;
		}

		try {
			const result = await submitLogin(username, password);

			toast.success('Login successful! Redirecting...');

			if (result.user?.requiresPasswordChange && result.user?.canChangePassword) {
				window.location.href = '/change-password?first=true';
			} else {
				window.location.href = getLoginDestination(
					page.url.searchParams.get('returnTo'),
					window.location.href
				);
			}
		} catch (err) {
			if (err instanceof LoginRequestError && err.status === 401) {
				errors.password = err.message;
			}
			toast.error(err instanceof Error ? err.message : 'Login failed');
			loading = false;
		}
	}

	function handleSSOLogin(providerId: string) {
		window.location.href = `/api/v1/auth/${providerId}/login`;
	}
</script>

<div class="login-root">
	<!-- ── Left brand panel ── -->
	<aside class="brand-panel">
		<!-- Dot grid texture -->
		<div class="dot-grid" aria-hidden="true"></div>

		<!-- Corner arc decoration -->
		<div class="corner-arcs" aria-hidden="true">
			<svg viewBox="0 0 500 500" fill="none" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="xMaxYMin meet">
				<circle cx="500" cy="0" r="140" stroke="rgba(251,191,36,0.13)" stroke-width="1" fill="none"/>
				<circle cx="500" cy="0" r="230" stroke="rgba(251,191,36,0.08)" stroke-width="1" fill="none"/>
				<circle cx="500" cy="0" r="330" stroke="rgba(255,255,255,0.05)" stroke-width="1" fill="none"/>
				<circle cx="500" cy="0" r="440" stroke="rgba(251,191,36,0.04)" stroke-width="1" fill="none"/>
			</svg>
		</div>

		<!-- Ambient amber glow (top-right) -->
		<div class="ambient-glow" aria-hidden="true"></div>

		<!-- Brand content -->
		<div class="brand-content">
			<!-- Logo mark -->
			<div class="logomark">
				<div class="logo-icon">
					<svg viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg">
						<defs>
							<linearGradient id="lg-main" x1="0%" y1="0%" x2="100%" y2="100%">
								<stop offset="0%" stop-color="#fbbf24"/>
								<stop offset="100%" stop-color="#d97706"/>
							</linearGradient>
						</defs>
						<rect width="40" height="40" rx="10" fill="url(#lg-main)"/>
						<path transform="translate(8, 8)" d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" fill="#0f172a"/>
					</svg>
				</div>
				<span class="logo-name">Gyre</span>
				<span class="alpha-badge">alpha</span>
			</div>

			<!-- Tagline -->
			<div class="brand-copy">
				<h2 class="brand-headline">GitOps, unified.</h2>
				<p class="brand-sub">
					Full visibility and control over your FluxCD fleet — reconciliation status,
					RBAC, multi-cluster, and more.
				</p>
			</div>

		</div>

		<!-- Bottom attribution -->
		<footer class="brand-footer">
			v{gyreVersion}
		</footer>
	</aside>

	<!-- ── Right form panel ── -->
	<main class="form-panel">
		<!-- Mobile-only compact header -->
		<div class="mobile-header">
			<div class="mobile-logo-icon">
				<svg viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg">
					<defs>
						<linearGradient id="lg-mobile" x1="0%" y1="0%" x2="100%" y2="100%">
							<stop offset="0%" stop-color="#fbbf24"/>
							<stop offset="100%" stop-color="#d97706"/>
						</linearGradient>
					</defs>
					<rect width="40" height="40" rx="9" fill="url(#lg-mobile)"/>
					<path transform="translate(8, 8)" d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" fill="#0f172a"/>
				</svg>
			</div>
			<span class="mobile-logo-name">Gyre</span>
			<span class="alpha-badge">alpha</span>
		</div>

		<!-- Form container -->
		<div class="form-container">
			<div class="form-header">
				<h1 class="form-title">Welcome back</h1>
				<p class="form-subtitle">Sign in to your instance</p>
			</div>

				<LoginPanel
					bind:username
					bind:password
					{providers}
					{showLocalLogin}
					{showProviders}
					{hasAnyAuth}
					{errors}
					{loading}
					onSubmit={handleLogin}
					onSSOLogin={handleSSOLogin}
				/>
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
	}

	/* ══════════════════════════════
	   Brand panel (left)
	══════════════════════════════ */
	.brand-panel {
		display: none;
		position: relative;
		overflow: hidden;
		flex-direction: column;
		justify-content: space-between;
		width: 44%;
		border-right: 1px solid rgba(255, 255, 255, 0.055);
		background: #060607;
	}

	@media (min-width: 1024px) {
		.brand-panel {
			display: flex;
		}
	}

	/* Dot grid */
	.dot-grid {
		position: absolute;
		inset: 0;
		background-image: radial-gradient(circle, rgba(255, 255, 255, 0.09) 1px, transparent 1px);
		background-size: 28px 28px;
		mask-image: radial-gradient(ellipse 70% 70% at 50% 50%, black 40%, transparent 100%);
		pointer-events: none;
	}

	/* Corner arc decoration */
	.corner-arcs {
		position: absolute;
		top: 0;
		right: 0;
		width: 70%;
		height: 70%;
		pointer-events: none;
		overflow: hidden;
	}

	.corner-arcs svg {
		width: 100%;
		height: 100%;
	}

	/* Ambient amber glow */
	.ambient-glow {
		position: absolute;
		top: -80px;
		right: -80px;
		width: 360px;
		height: 360px;
		border-radius: 50%;
		background: radial-gradient(circle, rgba(251, 191, 36, 0.07) 0%, transparent 65%);
		pointer-events: none;
	}

	/* Brand content */
	.brand-content {
		position: relative;
		z-index: 10;
		display: flex;
		flex-direction: column;
		gap: 2rem;
		padding: 3rem;
		margin-top: auto;
		margin-bottom: auto;
	}

	.logomark {
		display: flex;
		align-items: center;
		gap: 0.625rem;
	}

	.logo-icon {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 2.5rem;
		height: 2.5rem;
		flex-shrink: 0;
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

	.brand-headline {
		font-family: 'Plus Jakarta Sans', sans-serif;
		font-size: 2rem;
		font-weight: 700;
		letter-spacing: -0.04em;
		line-height: 1.1;
		color: #fff;
		margin: 0 0 0.75rem;
	}

	.brand-sub {
		font-size: 0.875rem;
		line-height: 1.65;
		color: rgba(255, 255, 255, 0.45);
		margin: 0;
		max-width: 28ch;
	}

	.brand-copy {
		max-width: 30ch;
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

	.brand-footer {
		position: relative;
		z-index: 10;
		padding: 1.5rem 3rem;
		font-size: 0.6875rem;
		color: rgba(255, 255, 255, 0.22);
		letter-spacing: 0.02em;
	}

	/* ══════════════════════════════
	   Form panel (right)
	══════════════════════════════ */
	.form-panel {
		flex: 1;
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		padding: 2rem 1.25rem;
		gap: 2rem;
	}

	/* Mobile-only logo */
	.mobile-header {
		display: flex;
		align-items: center;
		gap: 0.5rem;
	}

	.mobile-logo-icon {
		width: 2rem;
		height: 2rem;
	}

	.mobile-logo-icon svg {
		width: 100%;
		height: 100%;
	}

	.mobile-logo-name {
		font-family: 'Plus Jakarta Sans', sans-serif;
		font-size: 1.25rem;
		font-weight: 700;
		letter-spacing: -0.03em;
		color: #fff;
	}

	@media (min-width: 1024px) {
		.mobile-header {
			display: none;
		}
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
