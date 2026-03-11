<script lang="ts">
	import { toast } from 'svelte-sonner';
	import { LogIn, Loader2, Eye, EyeOff } from 'lucide-svelte';
	import { loginSchema } from '$lib/utils/validation';
	import { page } from '$app/state';
	import type { PageData } from './$types';

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
	let showLocalLogin = $derived(hasProviders ? localLoginEnabled : true);
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

		const validation = loginSchema.safeParse({ username, password });
		if (!validation.success) {
			validation.error.issues.forEach((issue) => {
				const path = issue.path[0] as string;
				errors[path] = issue.message;
			});
			toast.error(validation.error.issues[0].message);
			loading = false;
			return;
		}

		try {
			const response = await fetch('/api/v1/auth/login', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ username, password })
			});

			const result = await response.json();

			if (!response.ok) {
				const message =
					typeof result.message === 'object'
						? result.message.message
						: result.message || 'Login failed';
				if (response.status === 401) {
					errors.password = message;
				}
				throw new Error(message);
			}

			toast.success('Login successful! Redirecting...');

			if (password === 'admin' && result.user?.role === 'admin') {
				window.location.href = '/change-password?first=true';
			} else {
				window.location.href = '/';
			}
		} catch (err) {
			toast.error(err instanceof Error ? err.message : 'Login failed');
			loading = false;
		}
	}

	function handleSSOLogin(providerId: string) {
		window.location.href = `/api/v1/auth/${providerId}/login`;
	}

	function getProviderIcon(type: string): string {
		switch (type) {
			case 'oauth2-google':
				return 'google';
			case 'oauth2-github':
				return 'github';
			case 'oauth2-gitlab':
				return 'gitlab';
			case 'oidc':
				return 'shield';
			default:
				return 'key';
		}
	}

	function getProviderColor(type: string): string {
		switch (type) {
			case 'oauth2-google':
				return 'provider-google';
			case 'oauth2-github':
				return 'provider-github';
			case 'oauth2-gitlab':
				return 'provider-gitlab';
			default:
				return 'provider-oidc';
		}
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

			{#if !hasAnyAuth}
				<!-- No auth configured -->
				<div class="no-auth-notice">
					<div class="no-auth-icon">
						<svg fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5">
							<path stroke-linecap="round" stroke-linejoin="round"
								d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z"
							/>
						</svg>
					</div>
					<h3>No authentication configured</h3>
					<p>Contact your administrator to set up authentication methods.</p>
				</div>
			{:else}
				<!-- SSO providers -->
				{#if showProviders}
					<div class="sso-providers">
						{#each providers as provider (provider.id)}
							<button
								type="button"
								onclick={() => handleSSOLogin(provider.id)}
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
						{/each}
					</div>
				{/if}

				<!-- Divider -->
				{#if showProviders && showLocalLogin}
					<div class="divider">
						<span>or sign in with username</span>
					</div>
				{/if}

				<!-- Local login form -->
				{#if showLocalLogin}
					<form onsubmit={handleLogin} class="local-form">
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
				{/if}
			{/if}
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

	/* ── No auth notice ── */
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

	/* ── SSO providers ── */
	.sso-providers {
		display: flex;
		flex-direction: column;
		gap: 0.625rem;
	}

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

	.sso-btn:hover  { opacity: 0.88; }
	.sso-btn:active { transform: scale(0.985); }

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

	/* ── Divider ── */
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
