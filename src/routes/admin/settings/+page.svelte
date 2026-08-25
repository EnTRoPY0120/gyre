<script lang="ts">
	import { toast } from 'svelte-sonner';
	import type { PageData } from './$types';
	import { getCsrfToken } from '$lib/utils/csrf';
	import { saveAdminSettings } from './settings-request';
	import SettingsForm from './SettingsForm.svelte';
	import SettingsInfoCards from './SettingsInfoCards.svelte';

	let { data } = $props<{ data: PageData }>();

	let localLoginEnabled = $state(false);
	let allowSignup = $state(false);
	let domainAllowlistText = $state('');
	let auditRetentionDays = $state(90);
	let saving = $state(false);

	let initialized = $state(false);
	let isDirty = $state(false);

	$effect.pre(() => {
		if (!initialized || !isDirty) {
			localLoginEnabled = data.settings.localLoginEnabled.value;
			allowSignup = data.settings.allowSignup.value;
			domainAllowlistText = data.settings.domainAllowlist.value.join(', ');
			auditRetentionDays = data.settings.auditRetentionDays.value;
			initialized = true;
		}
	});

	async function saveSettings() {
		saving = true;
		try {
			await saveAdminSettings(
				{ localLoginEnabled, allowSignup, domainAllowlistText, auditRetentionDays },
				getCsrfToken()
			);

			toast.success('Settings saved successfully');
			isDirty = false;
		} catch (err) {
			toast.error(err instanceof Error ? err.message : 'Failed to save settings');
		} finally {
			saving = false;
		}
	}

	function toggleLocalLogin() {
		localLoginEnabled = !localLoginEnabled;
		isDirty = true;
	}

	function toggleSignup() {
		allowSignup = !allowSignup;
		isDirty = true;
	}

	function markDirty() {
		isDirty = true;
	}
</script>

<div class="space-y-6">
	<div class="border-b border-gray-200 pb-6 dark:border-gray-800">
		<h1 class="text-3xl font-bold text-gray-900 dark:text-white">Application Settings</h1>
		<p class="mt-2 text-sm text-gray-600 dark:text-gray-400">
			Configure authentication and access control settings
		</p>
	</div>

	<SettingsForm
		{data}
		{localLoginEnabled}
		{allowSignup}
		bind:auditRetentionDays
		bind:domainAllowlistText
		{saving}
		onToggleLocalLogin={toggleLocalLogin}
		onToggleSignup={toggleSignup}
		onDirty={markDirty}
		onSave={saveSettings}
	/>

	<SettingsInfoCards />
</div>
