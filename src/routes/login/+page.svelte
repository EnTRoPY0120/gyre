<script lang="ts">
	import { goto } from '$app/navigation';

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
				// Redirect to password change page - keep loading until navigation completes
				await goto('/change-password?first=true');
			} else {
				// Normal redirect to home - keep loading until navigation completes
				await goto('/');
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
								<svg class="ml-1 h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
									<path
										stroke-linecap="round"
										stroke-linejoin="round"
										stroke-width="2"
										d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
									/>
								</svg>
							</a>
						</div>
						<button
							onclick={dismissWelcome}
							class="ml-2 text-amber-400/60 hover:text-amber-400"
							aria-label="Dismiss"
						>
							<svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
								<path
									stroke-linecap="round"
									stroke-linejoin="round"
									stroke-width="2"
									d="M6 18L18 6M6 6l12 12"
								/>
							</svg>
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
							<svg class="h-5 w-5 animate-spin" viewBox="0 0 24 24" fill="none">
								<circle
									class="opacity-25"
									cx="12"
									cy="12"
									r="10"
									stroke="currentColor"
									stroke-width="4"
								/>
								<path
									class="opacity-75"
									fill="currentColor"
									d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
								/>
							</svg>
							Signing in...
						</span>
					{:else}
						Sign In
					{/if}
				</button>
			</form>
		</div>
	</div>
</div>
