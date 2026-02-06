<script lang="ts">
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import { toast } from 'svelte-sonner';
	import { Loader2, Eye, EyeOff, Check, X } from 'lucide-svelte';
	import { changePasswordSchema } from '$lib/utils/validation';

	let currentPassword = $state('');
	let newPassword = $state('');
	let confirmPassword = $state('');
	let showCurrent = $state(false);
	let showNew = $state(false);
	let showConfirm = $state(false);
	let loading = $state(false);

	const isFirstLogin = $derived(page.data.isFirstLogin);

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
			const response = await fetch('/api/auth/change-password', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
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
			<p class="mt-2 text-slate-400">Security Center</p>
		</div>

		<!-- Change Password Form -->
		<div
			class="rounded-2xl border border-slate-700/50 bg-slate-800/50 p-8 shadow-2xl backdrop-blur-xl"
		>
			<!-- First Login Notice -->
			{#if isFirstLogin}
				<div class="mb-6 rounded-lg border border-amber-500/30 bg-amber-500/10 p-4">
					<div class="flex items-start">
						<div class="mt-0.5 mr-3 rounded-full bg-amber-500/20 p-1">
							<Check size={14} class="text-amber-400" />
						</div>
						<div>
							<p class="text-sm font-medium text-amber-400">Account Activated</p>
							<p class="mt-1 text-xs text-amber-300/80">
								For security, please set a new password before continuing to the dashboard.
							</p>
						</div>
					</div>
				</div>
			{/if}

			<form onsubmit={handleSubmit} class="space-y-5">
				<!-- Current Password -->
				<div class="space-y-2">
					<label for="currentPassword" class="text-sm font-medium text-slate-300">
						Current Password
					</label>
					<div class="relative">
						<input
							id="currentPassword"
							type={showCurrent ? 'text' : 'password'}
							bind:value={currentPassword}
							placeholder="Current password"
							required
							class="w-full rounded-lg border border-slate-600/50 bg-slate-700/50 px-4 py-2.5 pr-10 text-white placeholder-slate-500 transition-all outline-none focus:border-amber-500/50 focus:ring-2 focus:ring-amber-500/20"
						/>
						<button
							type="button"
							onclick={() => (showCurrent = !showCurrent)}
							class="absolute top-1/2 right-3 -translate-y-1/2 text-slate-500 hover:text-slate-300"
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
				<div class="space-y-2">
					<label for="newPassword" class="text-sm font-medium text-slate-300"> New Password </label>
					<div class="relative">
						<input
							id="newPassword"
							type={showNew ? 'text' : 'password'}
							bind:value={newPassword}
							placeholder="New secure password"
							required
							class="w-full rounded-lg border border-slate-600/50 bg-slate-700/50 px-4 py-2.5 pr-10 text-white placeholder-slate-500 transition-all outline-none focus:border-amber-500/50 focus:ring-2 focus:ring-amber-500/20"
						/>
						<button
							type="button"
							onclick={() => (showNew = !showNew)}
							class="absolute top-1/2 right-3 -translate-y-1/2 text-slate-500 hover:text-slate-300"
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
						<div class="space-y-2 pt-1">
							<div
								class="flex items-center justify-between text-[10px] font-bold tracking-wider uppercase"
							>
								<span class="text-slate-400">Strength: {strengthText()}</span>
								<span class={strengthScore >= 4 ? 'text-emerald-400' : 'text-slate-500'}>
									{strengthScore}/5
								</span>
							</div>
							<div class="flex h-1 gap-1">
								<!-- eslint-disable-next-line @typescript-eslint/no-unused-vars -->
								{#each Array(5) as _, i (i)}
									<div
										class="h-full flex-1 rounded-full transition-all duration-500 {i < strengthScore
											? strengthColor()
											: 'bg-slate-700'}"
									></div>
								{/each}
							</div>

							<!-- Requirements List -->
							<div class="grid grid-cols-2 gap-x-4 gap-y-1 pt-1">
								{#each requirements as req (req.label)}
									<div class="flex items-center gap-1.5">
										{#if req.met}
											<div class="rounded-full bg-emerald-500/20 p-0.5">
												<Check size={10} class="text-emerald-500" />
											</div>
										{:else}
											<div class="rounded-full bg-slate-700 p-0.5">
												<X size={10} class="text-slate-500" />
											</div>
										{/if}
										<span class="text-[10px] {req.met ? 'text-slate-300' : 'text-slate-500'}">
											{req.label}
										</span>
									</div>
								{/each}
							</div>
						</div>
					{/if}
				</div>

				<!-- Confirm Password -->
				<div class="space-y-2">
					<label for="confirmPassword" class="text-sm font-medium text-slate-300">
						Confirm New Password
					</label>
					<div class="relative">
						<input
							id="confirmPassword"
							type={showConfirm ? 'text' : 'password'}
							bind:value={confirmPassword}
							placeholder="Repeat new password"
							required
							class="w-full rounded-lg border border-slate-600/50 bg-slate-700/50 px-4 py-2.5 pr-10 text-white placeholder-slate-500 transition-all outline-none focus:border-amber-500/50 focus:ring-2 focus:ring-amber-500/20"
						/>
						<button
							type="button"
							onclick={() => (showConfirm = !showConfirm)}
							class="absolute top-1/2 right-3 -translate-y-1/2 text-slate-500 hover:text-slate-300"
						>
							{#if showConfirm}
								<EyeOff size={16} />
							{:else}
								<Eye size={16} />
							{/if}
						</button>
					</div>
				</div>

				<button
					type="submit"
					disabled={loading}
					class="mt-4 w-full rounded-lg bg-gradient-to-r from-amber-500 to-amber-600 px-4 py-3 font-semibold text-slate-900 shadow-lg shadow-amber-500/25 transition-all hover:from-amber-400 hover:to-amber-500 hover:shadow-amber-500/40 disabled:cursor-not-allowed disabled:opacity-50"
				>
					{#if loading}
						<span class="flex items-center justify-center gap-2">
							<Loader2 size={20} class="animate-spin" />
							Updating...
						</span>
					{:else}
						Change Password
					{/if}
				</button>

				{#if !isFirstLogin}
					<div class="text-center">
						<a href="/" class="text-xs text-slate-400 transition-colors hover:text-amber-400">
							Cancel and return to dashboard
						</a>
					</div>
				{/if}
			</form>
		</div>
	</div>
</div>
