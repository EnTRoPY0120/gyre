<script lang="ts">
	import type { PageData } from './$types';

	let {
		data,
		localLoginEnabled,
		allowSignup,
		auditRetentionDays = $bindable(),
		domainAllowlistText = $bindable(),
		saving,
		onToggleLocalLogin,
		onToggleSignup,
		onDirty,
		onSave
	}: {
		data: PageData;
		localLoginEnabled: boolean;
		allowSignup: boolean;
		auditRetentionDays: number;
		domainAllowlistText: string;
		saving: boolean;
		onToggleLocalLogin: () => void;
		onToggleSignup: () => void;
		onDirty: () => void;
		onSave: () => void;
	} = $props();
</script>

<div class="rounded-lg border border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900">
	<div class="space-y-6 p-6">
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
				onclick={onToggleLocalLogin}
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
				onclick={onToggleSignup}
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

		<div>
			<label for="auditRetention" class="text-base font-medium text-gray-900 dark:text-white">
				Audit Log Retention (Days)
			</label>
			<p class="mt-1 text-sm text-gray-600 dark:text-gray-400">
				Number of days to keep audit logs before automatic deletion
			</p>
			{#if data.settings.auditRetentionDays.overriddenByEnv}
				<p class="mt-1 text-xs text-amber-600 dark:text-amber-400">
					⚠️ Controlled by environment variable GYRE_AUDIT_LOG_RETENTION_DAYS
				</p>
			{/if}
			<div class="mt-2 flex items-center gap-3">
				<input
					id="auditRetention"
					type="number"
					min="1"
					max="3650"
					bind:value={auditRetentionDays}
					oninput={onDirty}
					disabled={data.settings.auditRetentionDays.overriddenByEnv}
					class="w-32 rounded-lg border border-gray-300 bg-white px-4 py-2 text-gray-900 transition-colors focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20 focus:outline-none disabled:cursor-not-allowed disabled:opacity-50 dark:border-gray-700 dark:bg-gray-800 dark:text-white"
				/>
				<span class="text-sm text-gray-600 dark:text-gray-400">days</span>
			</div>
		</div>

		<div class="border-t border-gray-200 dark:border-gray-800"></div>

		<div>
			<label for="domainAllowlist" class="text-base font-medium text-gray-900 dark:text-white">
				Domain Allowlist
			</label>
			<p class="mt-1 text-sm text-gray-600 dark:text-gray-400">
				Restrict OAuth signup to specific email domains (comma-separated). Leave empty to allow all
				domains.
			</p>
			{#if data.settings.domainAllowlist.overriddenByEnv}
				<p class="mt-1 text-xs text-amber-600 dark:text-amber-400">
					⚠️ Controlled by environment variable GYRE_AUTH_DOMAIN_ALLOWLIST
				</p>
			{/if}
			<textarea
				id="domainAllowlist"
				bind:value={domainAllowlistText}
				oninput={onDirty}
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

	<div
		class="flex items-center justify-end gap-3 border-t border-gray-200 bg-gray-50 px-6 py-4 dark:border-gray-800 dark:bg-gray-800/50"
	>
		<button
			type="button"
			onclick={onSave}
			disabled={saving}
			class="rounded-lg bg-amber-500 px-4 py-2 font-medium text-white transition-colors hover:bg-amber-600 disabled:cursor-not-allowed disabled:opacity-50"
		>
			{saving ? 'Saving...' : 'Save Settings'}
		</button>
	</div>
</div>
