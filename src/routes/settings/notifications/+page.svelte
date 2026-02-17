<script lang="ts">
	import { preferences } from '$lib/stores/preferences.svelte';
	import { Button } from '$lib/components/ui/button';
	import { Checkbox } from '$lib/components/ui/checkbox';
	import { Label } from '$lib/components/ui/label';
	import { Input } from '$lib/components/ui/input';
	import { toast } from 'svelte-sonner';

	// Resource types from flux types or just hardcode common ones
	const resourceTypes = [
		'GitRepository',
		'Kustomization',
		'HelmRelease',
		'HelmRepository',
		'OCIRepository',
		'Bucket',
		'ImageUpdateAutomation',
		'ImagePolicy',
		'ImageRepository'
	];

	const eventTypes = [
		{ value: 'success', label: 'Success' },
		{ value: 'failure', label: 'Failure' },
		{ value: 'warning', label: 'Warning' },
		{ value: 'error', label: 'Error' },
		{ value: 'info', label: 'Info' }
	];

	let loading = $state(false);

	// Local state for form initialized from store
	let enabled = $state(preferences.notifications.enabled ?? true);
	let selectedResourceTypes = $state(preferences.notifications.resourceTypes ?? []);
	let selectedEventTypes = $state<('success' | 'failure' | 'warning' | 'info' | 'error')[]>(
		preferences.notifications.events ?? ['success', 'failure', 'warning', 'info', 'error']
	);
	let namespaceInput = $state(preferences.notifications.namespaces?.join(', ') ?? '');

	async function savePreferences() {
		loading = true;
		const namespaces = namespaceInput
			.split(',')
			.map((n) => n.trim())
			.filter((n) => n.length > 0);

		const newPrefs = {
			enabled,
			resourceTypes: selectedResourceTypes,
			namespaces,
			events: selectedEventTypes
		};

		try {
			const res = await fetch('/api/user/preferences', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ notifications: newPrefs })
			});

			if (!res.ok) throw new Error('Failed to save');

			preferences.setNotifications(newPrefs);
			toast.success('Notification settings saved successfully');
		} catch (err) {
			console.error(err);
			toast.error('Failed to save notification settings');
		} finally {
			loading = false;
		}
	}

	function toggleResourceType(type: string) {
		if (selectedResourceTypes.includes(type)) {
			selectedResourceTypes = selectedResourceTypes.filter((t) => t !== type);
		} else {
			selectedResourceTypes = [...selectedResourceTypes, type];
		}
	}

	function toggleEventType(type: 'success' | 'failure' | 'warning' | 'info' | 'error') {
		if (selectedEventTypes.includes(type)) {
			selectedEventTypes = selectedEventTypes.filter((t) => t !== type);
		} else {
			selectedEventTypes = [...selectedEventTypes, type];
		}
	}
</script>

<div class="mx-auto max-w-2xl">
	<div class="mb-8">
		<h1 class="text-3xl font-bold tracking-tight text-gray-900 dark:text-gray-100">Notification Settings</h1>
		<p class="mt-2 text-gray-500 dark:text-gray-400">
			Customize which notifications you receive to reduce noise in large clusters.
		</p>
	</div>

	<div class="space-y-10 rounded-xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-gray-900">
		<!-- General Enable/Disable -->
		<div class="flex items-center justify-between">
			<div class="space-y-0.5">
				<Label for="notifications-enabled" class="text-lg font-semibold">Live Notifications</Label>
				<p class="text-sm text-gray-500">Enable or disable real-time notifications</p>
			</div>
			<div class="flex items-center">
				<Checkbox id="notifications-enabled" bind:checked={enabled} />
			</div>
		</div>

		{#if enabled}
			<div class="space-y-10 border-t border-gray-100 pt-8 dark:border-gray-800">
				<!-- Resource Types -->
				<div class="space-y-4">
					<div class="space-y-1">
						<h3 class="text-md font-semibold">Resource Types</h3>
						<p class="text-sm text-gray-500">Only receive notifications for specific Flux resources. Leave all unchecked for all resources.</p>
					</div>
					<div class="grid grid-cols-1 gap-x-6 gap-y-4 sm:grid-cols-2 lg:grid-cols-3">
						{#each resourceTypes as type}
							<div class="flex items-center space-x-3">
								<Checkbox
									id={`resource-${type}`}
									checked={selectedResourceTypes.includes(type)}
									onclick={() => toggleResourceType(type)}
								/>
								<Label for={`resource-${type}`} class="text-sm font-normal cursor-pointer">{type}</Label>
							</div>
						{/each}
					</div>
				</div>

				<!-- Event Types -->
				<div class="space-y-4">
					<div class="space-y-1">
						<h3 class="text-md font-semibold">Event Types</h3>
						<p class="text-sm text-gray-500">Filter notifications by their severity or status.</p>
					</div>
					<div class="flex flex-wrap gap-x-8 gap-y-4">
						{#each eventTypes as type}
							<div class="flex items-center space-x-3">
								<Checkbox
									id={`event-${type.value}`}
									checked={selectedEventTypes.includes(type.value as any)}
									onclick={() => toggleEventType(type.value as any)}
								/>
								<Label for={`event-${type.value}`} class="text-sm font-normal cursor-pointer">{type.label}</Label>
							</div>
						{/each}
					</div>
				</div>

				<!-- Namespaces -->
				<div class="space-y-4">
					<div class="space-y-1">
						<h3 class="text-md font-semibold">Namespace Filter</h3>
						<p class="text-sm text-gray-500">Separate multiple namespaces with commas. Leave blank to receive notifications from all namespaces.</p>
					</div>
					<Input
						placeholder="e.g. flux-system, production, monitoring"
						bind:value={namespaceInput}
						class="max-w-md"
					/>
				</div>
			</div>
		{/if}

		<div class="flex items-center justify-end border-t border-gray-100 pt-6 dark:border-gray-800">
			<Button onclick={savePreferences} disabled={loading} class="px-8">
				{#if loading}
					<svg class="mr-2 h-4 w-4 animate-spin" viewBox="0 0 24 24">
						<circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" fill="none"></circle>
						<path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
					</svg>
					Saving...
				{:else}
					Save Notification Settings
				{/if}
			</Button>
		</div>
	</div>
</div>
