<script lang="ts">
	import { goto } from '$app/navigation';
	import type { PageData } from './$types';
	import { LogIn, Loader2, X, ExternalLink } from 'lucide-svelte';

	let { data } = $props<{ data: PageData }>();
	let providers = $derived(data.providers || []);

	let username = $state('');
	let password = $state('');
	let error = $state('');
	let loading = $state(false);
	let showWelcome = $state(true);

	async function handleLogin(event: Event) {
		event.preventDefault();
		error = '';
		loading = true;

		try {
			const response = await fetch('/api/auth/login', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ username, password })
			});

			if (!response.ok) {
				const data = await response.json();
				throw new Error(data.message || 'Login failed');
			}

			const data = await response.json();

			// Check if this is the first login (using default password)
			if (password === 'admin' && data.user?.role === 'admin') {
				// Redirect to password change page - HARD RELOAD
				window.location.href = '/change-password?first=true';
			} else {
				// Normal redirect to home - HARD RELOAD to ensure all state is synced
				window.location.href = '/';
			}
		} catch (err) {
			error = err instanceof Error ? err.message : 'Login failed';
			loading = false;
		}
		// Note: loading is NOT set to false on success - it stays spinning until page navigation completes
	}

	function dismissWelcome() {
		showWelcome = false;
	}

	function handleSSOLogin(providerId: string) {
		// Redirect to SSO login endpoint
		window.location.href = `/api/auth/${providerId}/login`;
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
				return 'from-blue-500 to-blue-600 hover:from-blue-400 hover:to-blue-500';
			case 'oauth2-github':
				return 'from-gray-700 to-gray-800 hover:from-gray-600 hover:to-gray-700';
			case 'oauth2-gitlab':
				return 'from-orange-500 to-orange-600 hover:from-orange-400 hover:to-orange-500';
			default:
				return 'from-slate-600 to-slate-700 hover:from-slate-500 hover:to-slate-600';
		}
	}
</script>

<div
	class="flex min-h-screen items-center justify-center bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950"
>
	<div class="w-full max-w-md px-4">
		<!-- Logo -->
		<div class="mb-8 text-center">
			<div class="mb-4 flex justify-center">
				<div
					class="flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-amber-400 to-amber-600 shadow-lg shadow-amber-500/20"
				>
					<svg class="h-10 w-10 text-slate-900" viewBox="0 0 24 24" fill="currentColor">
						<path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
					</svg>
				</div>
			</div>
			<h1 class="text-3xl font-bold text-white">Gyre</h1>
			<p class="mt-2 text-slate-400">FluxCD Dashboard</p>
		</div>

		<!-- Login Form -->
		<div
			class="rounded-2xl border border-slate-700/50 bg-slate-800/50 p-8 shadow-2xl backdrop-blur-xl"
		>
			<!-- First Time Setup Notice -->
			{#if showWelcome}
				<div class="mb-6 rounded-lg border border-amber-500/30 bg-amber-500/10 p-4">
					<div class="flex items-start justify-between">
						<div>
							<p class="text-sm font-medium text-amber-400">Welcome! First time setup</p>
							<p class="mt-1 text-xs text-amber-300/80">
								Please sign in with the default credentials. You'll be prompted to change your
								password after first login.
							</p>
							<a
								href="https://docs.gyre.io/getting-started#authentication"
								target="_blank"
								rel="noopener noreferrer"
								class="mt-2 inline-flex items-center text-xs font-medium text-amber-400 underline hover:text-amber-300"
							>
								View default credentials in docs
								<ExternalLink size={12} class="ml-1" />
							</a>
						</div>
						<button
							onclick={dismissWelcome}
							class="ml-2 text-amber-400/60 hover:text-amber-400"
							aria-label="Dismiss"
						>
							<X size={16} />
						</button>
					</div>
				</div>
			{/if}

			<form onsubmit={handleLogin} class="space-y-6">
				{#if error}
					<div class="rounded-lg border border-red-500/20 bg-red-500/10 p-3 text-sm text-red-400">
						{error}
					</div>
				{/if}

				<div class="space-y-2">
					<label for="username" class="text-sm font-medium text-slate-300">Username</label>
					<input
						id="username"
						type="text"
						bind:value={username}
						placeholder="Enter your username"
						required
						class="w-full rounded-lg border border-slate-600/50 bg-slate-700/50 px-4 py-3 text-white placeholder-slate-500 transition-all outline-none focus:border-amber-500/50 focus:ring-2 focus:ring-amber-500/20"
					/>
				</div>

				<div class="space-y-2">
					<label for="password" class="text-sm font-medium text-slate-300">Password</label>
					<input
						id="password"
						type="password"
						bind:value={password}
						placeholder="Enter your password"
						required
						class="w-full rounded-lg border border-slate-600/50 bg-slate-700/50 px-4 py-3 text-white placeholder-slate-500 transition-all outline-none focus:border-amber-500/50 focus:ring-2 focus:ring-amber-500/20"
					/>
				</div>

				<button
					type="submit"
					disabled={loading}
					class="w-full rounded-lg bg-gradient-to-r from-amber-500 to-amber-600 px-4 py-3 font-semibold text-slate-900 shadow-lg shadow-amber-500/25 transition-all hover:from-amber-400 hover:to-amber-500 hover:shadow-amber-500/40 disabled:cursor-not-allowed disabled:opacity-50"
				>
					{#if loading}
						<span class="flex items-center justify-center gap-2">
							<Loader2 size={20} class="animate-spin" />
							Signing in...
						</span>
					{:else}
						<span class="flex items-center justify-center gap-2">
							<LogIn size={20} />
							Sign In
						</span>
					{/if}
				</button>
			</form>

			<!-- SSO Providers -->
			{#if providers.length > 0}
				<div class="mt-6">
					<div class="relative">
						<div class="absolute inset-0 flex items-center">
							<div class="w-full border-t border-slate-600"></div>
						</div>
						<div class="relative flex justify-center text-sm">
							<span class="bg-slate-800/50 px-3 text-slate-400">Or continue with</span>
						</div>
					</div>

					<div class="mt-6 space-y-3">
						{#each providers as provider}
							<button
								type="button"
								onclick={() => handleSSOLogin(provider.id)}
								class="flex w-full items-center justify-center gap-3 rounded-lg bg-gradient-to-r {getProviderColor(
									provider.type
								)} px-4 py-3 font-medium text-white shadow-lg transition-all"
							>
								{#if getProviderIcon(provider.type) === 'google'}
									<svg class="h-5 w-5" viewBox="0 0 24 24" fill="currentColor">
										<path
											d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
										/>
										<path
											d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
										/>
										<path
											d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
										/>
										<path
											d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
										/>
									</svg>
								{:else if getProviderIcon(provider.type) === 'github'}
									<svg class="h-5 w-5" viewBox="0 0 24 24" fill="currentColor">
										<path
											d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"
										/>
									</svg>
								{:else if getProviderIcon(provider.type) === 'shield'}
									<svg
										class="h-5 w-5"
										fill="none"
										viewBox="0 0 24 24"
										stroke="currentColor"
										stroke-width="2"
									>
										<path
											stroke-linecap="round"
											stroke-linejoin="round"
											d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"
										/>
									</svg>
								{:else}
									<svg
										class="h-5 w-5"
										fill="none"
										viewBox="0 0 24 24"
										stroke="currentColor"
										stroke-width="2"
									>
										<path
											stroke-linecap="round"
											stroke-linejoin="round"
											d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z"
										/>
									</svg>
								{/if}
								<span>Sign in with {provider.name}</span>
							</button>
						{/each}
					</div>
				</div>
			{/if}
		</div>
	</div>
</div>
