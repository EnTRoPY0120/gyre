<script lang="ts">
	import { toast } from 'svelte-sonner';
	import { LogIn, Loader2, Eye, EyeOff } from 'lucide-svelte';
	import { loginSchema } from '$lib/utils/validation';
	import { page } from '$app/state';
	import type { PageData } from './$types';

	let { data } = $props<{ data: PageData }>();
	let providers = $derived(data.providers || []);
	let localLoginEnabled = $derived(data.localLoginEnabled ?? true);

	let username = $state('');
	let password = $state('');
	let showPassword = $state(false);
	let loading = $state(false);
	let errors = $state<Record<string, string>>({});

	// Determine what to show
	let hasProviders = $derived(providers.length > 0);
	let showLocalLogin = $derived(hasProviders ? localLoginEnabled : true);
	let showProviders = $derived(hasProviders);
	let hasAnyAuth = $derived(showLocalLogin || showProviders);

	// Handle query parameters for messages
	$effect(() => {
		const loggedOut = page.url.searchParams.get('loggedOut');
		const errorParam = page.url.searchParams.get('error');

		if (loggedOut === 'true') {
			toast.success('Successfully logged out');
		}

		if (errorParam) {
			toast.error(decodeURIComponent(errorParam));
		}

		// Clear the params from URL without reload
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

		// Client-side validation with Zod
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
			const response = await fetch('/api/auth/login', {
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

			// Check if this is the first login (using default password)
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
			class="rounded-2xl border border-slate-700/50 bg-slate-800/50 p-8 shadow-2xl backdrop-blur-xl transition-all duration-500 hover:border-slate-600/50"
		>
			{#if !hasAnyAuth}
				<!-- No authentication methods configured -->
				<div class="space-y-4 text-center">
					<div
						class="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-red-500/10"
					>
						<svg
							class="h-8 w-8 text-red-500"
							fill="none"
							viewBox="0 0 24 24"
							stroke="currentColor"
							stroke-width="2"
						>
							<path
								stroke-linecap="round"
								stroke-linejoin="round"
								d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
							/>
						</svg>
					</div>
					<h3 class="text-lg font-semibold text-white">No Authentication Methods</h3>
					<p class="text-sm text-slate-400">
						No authentication methods are currently configured. Please contact your administrator.
					</p>
				</div>
			{:else}
				<!-- SSO Providers (shown first if available) -->
				{#if showProviders}
					<div class="space-y-3">
						{#each providers as provider (provider.id)}
							<button
								type="button"
								onclick={() => handleSSOLogin(provider.id)}
								class="flex w-full items-center justify-center gap-3 rounded-lg bg-gradient-to-r {getProviderColor(
									provider.type
								)} px-4 py-4 font-medium text-white shadow-lg transition-all active:scale-[0.98]"
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
								{:else if getProviderIcon(provider.type) === 'gitlab'}
									<svg class="h-5 w-5" viewBox="0 0 24 24" fill="currentColor">
										<path
											d="M23.955 13.587l-1.342-4.135-2.664-8.189c-.135-.417-.724-.417-.859 0L16.426 9.452H7.574L4.91 1.263c-.135-.417-.724-.417-.859 0L1.387 9.452.045 13.587c-.114.352.016.741.321.962L12 23l11.634-8.451c.305-.221.435-.61.321-.962z"
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
								<span>Continue with {provider.name}</span>
							</button>
						{/each}
					</div>
				{/if}

				<!-- Divider (only if both methods available) -->
				{#if showProviders && showLocalLogin}
					<div class="my-6">
						<div class="relative">
							<div class="absolute inset-0 flex items-center">
								<div class="w-full border-t border-slate-600"></div>
							</div>
							<div class="relative flex justify-center text-sm">
								<span class="bg-slate-800/50 px-3 text-slate-400"
									>Or sign in with local account</span
								>
							</div>
						</div>
					</div>
				{/if}

				<!-- Local Login Form -->
				{#if showLocalLogin}
					<form onsubmit={handleLogin} class="space-y-6">
						<div class="space-y-2">
							<label for="username" class="text-sm font-medium text-slate-300">Username</label>
							<input
								id="username"
								type="text"
								bind:value={username}
								placeholder="Enter your username"
								required
								class="w-full rounded-lg border bg-slate-700/50 px-4 py-3 text-white placeholder-slate-500 transition-all outline-none focus:ring-2 {errors.username
									? 'border-red-500/50 focus:ring-red-500/20'
									: 'border-slate-600/50 focus:border-amber-500/50 focus:ring-amber-500/20'}"
							/>
						</div>

						<div class="space-y-2">
							<label for="password" class="text-sm font-medium text-slate-300">Password</label>
							<div class="relative">
								<input
									id="password"
									type={showPassword ? 'text' : 'password'}
									bind:value={password}
									placeholder="Enter your password"
									required
									class="w-full rounded-lg border bg-slate-700/50 px-4 py-3 pr-12 text-white placeholder-slate-500 transition-all outline-none focus:ring-2 {errors.password
										? 'border-red-500/50 focus:ring-red-500/20'
										: 'border-slate-600/50 focus:border-amber-500/50 focus:ring-amber-500/20'}"
								/>
								<button
									type="button"
									onclick={() => (showPassword = !showPassword)}
									class="absolute top-1/2 right-3 -translate-y-1/2 text-slate-500 transition-colors hover:text-slate-300"
									aria-label={showPassword ? 'Hide password' : 'Show password'}
								>
									{#if showPassword}
										<EyeOff size={20} />
									{:else}
										<Eye size={20} />
									{/if}
								</button>
							</div>
						</div>

						<button
							type="submit"
							disabled={loading}
							class="group relative w-full overflow-hidden rounded-lg bg-gradient-to-r from-amber-500 to-amber-600 px-4 py-3 font-semibold text-slate-900 shadow-lg shadow-amber-500/25 transition-all hover:from-amber-400 hover:to-amber-500 hover:shadow-amber-500/40 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50"
						>
							<div
								class="absolute inset-0 translate-y-full bg-white/10 transition-transform duration-300 group-hover:translate-y-0"
							></div>
							{#if loading}
								<span class="relative flex items-center justify-center gap-2">
									<Loader2 size={20} class="animate-spin" />
									Signing in...
								</span>
							{:else}
								<span class="relative flex items-center justify-center gap-2">
									<LogIn size={20} class="transition-transform group-hover:translate-x-1" />
									Sign In
								</span>
							{/if}
						</button>
					</form>
				{/if}
			{/if}
		</div>
	</div>
</div>

<style>
	input:-webkit-autofill,
	input:-webkit-autofill:hover,
	input:-webkit-autofill:focus,
	input:-webkit-autofill:active {
		-webkit-box-shadow: 0 0 0 30px #1e293b inset !important; /* matches slate-800 */
		-webkit-text-fill-color: white !important;
		transition: background-color 5000s ease-in-out 0s;
	}
</style>
