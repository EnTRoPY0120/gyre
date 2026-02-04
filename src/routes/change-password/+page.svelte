<script lang="ts">
	import { goto } from '$app/navigation';
	import { page } from '$app/state';

	let currentPassword = $state('');
	let newPassword = $state('');
	let confirmPassword = $state('');
	let error = $state('');
	let success = $state('');
	let loading = $state(false);

	const isFirstLogin = $derived(page.data.isFirstLogin);

	function validatePassword(password: string): string | null {
		if (password.length < 8) {
			return 'Password must be at least 8 characters long';
		}
		if (!/[A-Z]/.test(password)) {
			return 'Password must contain at least one uppercase letter';
		}
		if (!/[a-z]/.test(password)) {
			return 'Password must contain at least one lowercase letter';
		}
		if (!/[0-9]/.test(password)) {
			return 'Password must contain at least one number';
		}
		return null;
	}

	async function handleSubmit(event: Event) {
		event.preventDefault();
		error = '';
		success = '';
		loading = true;

		try {
			// Validate new password
			const validationError = validatePassword(newPassword);
			if (validationError) {
				throw new Error(validationError);
			}

			// Check passwords match
			if (newPassword !== confirmPassword) {
				throw new Error('New passwords do not match');
			}

			// Check current password is different
			if (currentPassword === newPassword) {
				throw new Error('New password must be different from current password');
			}

			// Submit to API (endpoint to be implemented)
			const response = await fetch('/api/auth/change-password', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					currentPassword,
					newPassword
				})
			});

			if (!response.ok) {
				const data = await response.json();
				throw new Error(data.message || 'Failed to change password');
			}

			// Show success message briefly then redirect
			success = 'Password changed successfully!';

			// Clear form
			currentPassword = '';
			newPassword = '';
			confirmPassword = '';

			// Redirect after a short delay
			setTimeout(() => {
				void goto('/?success=password-changed');
			}, 1500);
		} catch (err) {
			error = err instanceof Error ? err.message : 'An unexpected error occurred';
		} finally {
			loading = false;
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
			<p class="mt-2 text-slate-400">Change Password</p>
		</div>

		<!-- Change Password Form -->
		<div
			class="rounded-2xl border border-slate-700/50 bg-slate-800/50 p-8 shadow-2xl backdrop-blur-xl"
		>
			<!-- First Login Notice -->
			{#if isFirstLogin}
				<div class="mb-6 rounded-lg border border-amber-500/30 bg-amber-500/10 p-4">
					<div class="flex items-start">
						<svg
							class="mr-3 h-5 w-5 flex-shrink-0 text-amber-400"
							fill="none"
							viewBox="0 0 24 24"
							stroke="currentColor"
						>
							<path
								stroke-linecap="round"
								stroke-linejoin="round"
								stroke-width="2"
								d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
							/>
						</svg>
						<div>
							<p class="text-sm font-medium text-amber-400">Welcome!</p>
							<p class="mt-1 text-sm text-amber-300/80">
								Please set a secure password for your admin account.
							</p>
						</div>
					</div>
				</div>
			{/if}

			<form onsubmit={handleSubmit} class="space-y-6">
				{#if error}
					<div class="rounded-lg border border-red-500/20 bg-red-500/10 p-3 text-sm text-red-400">
						<div class="flex items-center">
							<svg
								class="mr-2 h-4 w-4 flex-shrink-0"
								fill="none"
								viewBox="0 0 24 24"
								stroke="currentColor"
							>
								<path
									stroke-linecap="round"
									stroke-linejoin="round"
									stroke-width="2"
									d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
								/>
							</svg>
							{error}
						</div>
					</div>
				{/if}

				{#if success}
					<div
						class="rounded-lg border border-emerald-500/20 bg-emerald-500/10 p-3 text-sm text-emerald-400"
					>
						<div class="flex items-center">
							<svg
								class="mr-2 h-4 w-4 flex-shrink-0"
								fill="none"
								viewBox="0 0 24 24"
								stroke="currentColor"
							>
								<path
									stroke-linecap="round"
									stroke-linejoin="round"
									stroke-width="2"
									d="M5 13l4 4L19 7"
								/>
							</svg>
							{success}
						</div>
					</div>
				{/if}

				<div class="space-y-2">
					<label for="currentPassword" class="text-sm font-medium text-slate-300">
						Current Password
					</label>
					<input
						id="currentPassword"
						type="password"
						bind:value={currentPassword}
						placeholder="Enter your current password"
						required
						class="w-full rounded-lg border border-slate-600/50 bg-slate-700/50 px-4 py-3 text-white placeholder-slate-500 transition-all outline-none focus:border-amber-500/50 focus:ring-2 focus:ring-amber-500/20"
					/>
				</div>

				<div class="space-y-2">
					<label for="newPassword" class="text-sm font-medium text-slate-300"> New Password </label>
					<input
						id="newPassword"
						type="password"
						bind:value={newPassword}
						placeholder="Enter new password"
						required
						minlength="8"
						class="w-full rounded-lg border border-slate-600/50 bg-slate-700/50 px-4 py-3 text-white placeholder-slate-500 transition-all outline-none focus:border-amber-500/50 focus:ring-2 focus:ring-amber-500/20"
					/>
					<p class="text-xs text-slate-500">
						Must be at least 8 characters with uppercase, lowercase, and number
					</p>
				</div>

				<div class="space-y-2">
					<label for="confirmPassword" class="text-sm font-medium text-slate-300">
						Confirm New Password
					</label>
					<input
						id="confirmPassword"
						type="password"
						bind:value={confirmPassword}
						placeholder="Confirm new password"
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
							Updating...
						</span>
					{:else}
						Change Password
					{/if}
				</button>

				{#if !isFirstLogin}
					<div class="text-center">
						<a href="/" class="text-sm text-slate-400 transition-colors hover:text-amber-400">
							Cancel and return to dashboard
						</a>
					</div>
				{/if}
			</form>
		</div>
	</div>
</div>
