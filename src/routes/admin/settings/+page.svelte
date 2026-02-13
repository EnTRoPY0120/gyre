<script lang="ts">
	import { toast } from 'svelte-sonner';
	import type { PageData } from './$types';

	let { data } = $props<{ data: PageData }>();

	let localLoginEnabled = $state(data.settings.localLoginEnabled.value);
	let allowSignup = $state(data.settings.allowSignup.value);
	let domainAllowlistText = $state(data.settings.domainAllowlist.value.join(', '));
	let saving = $state(false);

	async function saveSettings() {
		saving = true;
		try {
			// Parse domain allowlist
			const domains = domainAllowlistText
				.split(',')
				.map((d: string) => d.trim().toLowerCase())
				.filter((d: string) => d.length > 0);

			const response = await fetch('/api/admin/settings', {
				method: 'PATCH',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					localLoginEnabled,
					allowSignup,
					domainAllowlist: domains
				})
			});

			if (!response.ok) {
				const error = await response.json();
				throw new Error(error.message || 'Failed to save settings');
			}

			toast.success('Settings saved successfully');
		} catch (err) {
			toast.error(err instanceof Error ? err.message : 'Failed to save settings');
		} finally {
			saving = false;
		}
	}
</script>

<div class="space-y-6">
	<!-- Header -->
	<div class="border-b border-gray-200 pb-6 dark:border-gray-800">
		<h1 class="text-3xl font-bold text-gray-900 dark:text-white">Application Settings</h1>
		<p class="mt-2 text-sm text-gray-600 dark:text-gray-400">
			Configure authentication and access control settings
		</p>
	</div>

	<!-- Settings Form -->
	<div class="rounded-lg border border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900">
		<div class="space-y-6 p-6">
			<!-- Local Login Toggle -->
			<div class="flex items-start justify-between">
				<div class="flex-1">
					<label for="localLogin" class="text-base font-medium text-gray-900 dark:text-white">
						Local Login
					</label>
					<p class="mt-1 text-sm text-gray-600 dark:text-gray-400">
						Allow users to sign in with username and password
					</p>
					{#if data.settings.localLoginEnabled.overriddenByEnv}
						<p class="mt-1 text-xs text-amber-600 dark:text-amber-400">
							⚠️ Controlled by environment variable GYRE_AUTH_LOCAL_LOGIN_ENABLED
						</p>
					{/if}
				</div>
				<button
					type="button"
					role="switch"
					aria-checked={localLoginEnabled}
					aria-label="Toggle local login"
					disabled={data.settings.localLoginEnabled.overriddenByEnv}
					onclick={() => (localLoginEnabled = !localLoginEnabled)}
					class="relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:ring-2 focus:ring-amber-500 focus:ring-offset-2 focus:outline-none disabled:cursor-not-allowed disabled:opacity-50 {localLoginEnabled
						? 'bg-amber-500'
						: 'bg-gray-200 dark:bg-gray-700'}"
				>
					<span
						class="pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out {localLoginEnabled
							? 'translate-x-5'
							: 'translate-x-0'}"
					></span>
				</button>
			</div>

			<div class="border-t border-gray-200 dark:border-gray-800"></div>

			<!-- Allow Signup Toggle -->
			<div class="flex items-start justify-between">
				<div class="flex-1">
					<label for="allowSignup" class="text-base font-medium text-gray-900 dark:text-white">
						Allow OAuth Signup
					</label>
					<p class="mt-1 text-sm text-gray-600 dark:text-gray-400">
						Allow new users to register via OAuth providers
					</p>
					{#if data.settings.allowSignup.overriddenByEnv}
						<p class="mt-1 text-xs text-amber-600 dark:text-amber-400">
							⚠️ Controlled by environment variable GYRE_AUTH_ALLOW_SIGNUP
						</p>
					{/if}
				</div>
				<button
					type="button"
					role="switch"
					aria-checked={allowSignup}
					aria-label="Toggle OAuth signup"
					disabled={data.settings.allowSignup.overriddenByEnv}
					onclick={() => (allowSignup = !allowSignup)}
					class="relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:ring-2 focus:ring-amber-500 focus:ring-offset-2 focus:outline-none disabled:cursor-not-allowed disabled:opacity-50 {allowSignup
						? 'bg-amber-500'
						: 'bg-gray-200 dark:bg-gray-700'}"
				>
					<span
						class="pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out {allowSignup
							? 'translate-x-5'
							: 'translate-x-0'}"
					></span>
				</button>
			</div>

			<div class="border-t border-gray-200 dark:border-gray-800"></div>

			<!-- Domain Allowlist -->
			<div>
				<label for="domainAllowlist" class="text-base font-medium text-gray-900 dark:text-white">
					Domain Allowlist
				</label>
				<p class="mt-1 text-sm text-gray-600 dark:text-gray-400">
					Restrict OAuth signup to specific email domains (comma-separated). Leave empty to allow
					all domains.
				</p>
				{#if data.settings.domainAllowlist.overriddenByEnv}
					<p class="mt-1 text-xs text-amber-600 dark:text-amber-400">
						⚠️ Controlled by environment variable GYRE_AUTH_DOMAIN_ALLOWLIST
					</p>
				{/if}
				<textarea
					id="domainAllowlist"
					bind:value={domainAllowlistText}
					disabled={data.settings.domainAllowlist.overriddenByEnv}
					placeholder="example.com, company.org"
					rows="3"
					class="mt-2 w-full rounded-lg border border-gray-300 bg-white px-4 py-2 text-gray-900 placeholder-gray-400 transition-colors focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20 focus:outline-none disabled:cursor-not-allowed disabled:opacity-50 dark:border-gray-700 dark:bg-gray-800 dark:text-white dark:placeholder-gray-500"
				></textarea>
				<p class="mt-2 text-xs text-gray-500 dark:text-gray-400">
					Example: example.com, company.org, subdomain.example.com
				</p>
			</div>
		</div>

		<!-- Footer -->
		<div
			class="flex items-center justify-end gap-3 border-t border-gray-200 bg-gray-50 px-6 py-4 dark:border-gray-800 dark:bg-gray-800/50"
		>
			<button
				type="button"
				onclick={saveSettings}
				disabled={saving}
				class="rounded-lg bg-amber-500 px-4 py-2 font-medium text-white transition-colors hover:bg-amber-600 disabled:cursor-not-allowed disabled:opacity-50"
			>
				{saving ? 'Saving...' : 'Save Settings'}
			</button>
		</div>
	</div>

	<!-- Information Cards -->
	<div class="grid gap-6 md:grid-cols-2">
		<!-- Local Login Info -->
		<div
			class="rounded-lg border border-blue-200 bg-blue-50 p-4 dark:border-blue-900 dark:bg-blue-900/20"
		>
			<h3 class="font-semibold text-blue-900 dark:text-blue-100">Local Login</h3>
			<p class="mt-2 text-sm text-blue-800 dark:text-blue-200">
				When disabled, users can only authenticate via configured OAuth providers. The local login
				form will be hidden from the login page.
			</p>
		</div>

		<!-- Signup Control Info -->
		<div
			class="rounded-lg border border-purple-200 bg-purple-50 p-4 dark:border-purple-900 dark:bg-purple-900/20"
		>
			<h3 class="font-semibold text-purple-900 dark:text-purple-100">OAuth Signup</h3>
			<p class="mt-2 text-sm text-purple-800 dark:text-purple-200">
				When disabled, only existing users can log in via OAuth. New users will see an error
				message. Useful for invitation-only systems.
			</p>
		</div>
	</div>
</div>
