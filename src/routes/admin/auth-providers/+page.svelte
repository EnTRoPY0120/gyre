<script lang="ts">
	import { goto, invalidateAll } from '$app/navigation';
	import type { PageData } from './$types';

	let { data } = $props<{ data: PageData }>();
	let providers = $derived(data.providers || []);

	let showCreateModal = $state(false);
	let showEditModal = $state(false);
	let showDeleteModal = $state(false);
	let selectedProvider = $state<(typeof providers)[0] | null>(null);
	let error = $state('');
	let success = $state('');
	let loading = $state(false);

	// Form fields
	let formData = $state({
		name: '',
		type: 'oidc' as 'oidc' | 'oauth2-github' | 'oauth2-google' | 'oauth2-gitlab' | 'oauth2-generic',
		enabled: true,
		clientId: '',
		clientSecret: '',
		issuerUrl: '',
		autoProvision: true,
		defaultRole: 'viewer' as 'admin' | 'editor' | 'viewer',
		roleMapping: '{\n  "admin": [],\n  "editor": [],\n  "viewer": []\n}',
		roleClaim: 'groups',
		usernameClaim: 'preferred_username',
		emailClaim: 'email',
		usePkce: true,
		scopes: 'openid profile email'
	});

	function openCreateModal() {
		// Reset form
		formData = {
			name: '',
			type: 'oidc',
			enabled: true,
			clientId: '',
			clientSecret: '',
			issuerUrl: '',
			autoProvision: true,
			defaultRole: 'viewer',
			roleMapping: '{\n  "admin": [],\n  "editor": [],\n  "viewer": []\n}',
			roleClaim: 'groups',
			usernameClaim: 'preferred_username',
			emailClaim: 'email',
			usePkce: true,
			scopes: 'openid profile email'
		};
		error = '';
		success = '';
		showCreateModal = true;
	}

	function openEditModal(provider: (typeof providers)[0]) {
		selectedProvider = provider;
		formData = {
			name: provider.name,
			type: provider.type as any,
			enabled: provider.enabled,
			clientId: provider.clientId,
			clientSecret: '', // Don't populate secret
			issuerUrl: provider.issuerUrl || '',
			autoProvision: provider.autoProvision,
			defaultRole: provider.defaultRole as any,
			roleMapping: provider.roleMapping || '{\n  "admin": [],\n  "editor": [],\n  "viewer": []\n}',
			roleClaim: provider.roleClaim,
			usernameClaim: provider.usernameClaim,
			emailClaim: provider.emailClaim,
			usePkce: provider.usePkce,
			scopes: provider.scopes
		};
		error = '';
		success = '';
		showEditModal = true;
	}

	function openDeleteModal(provider: (typeof providers)[0]) {
		selectedProvider = provider;
		error = '';
		success = '';
		showDeleteModal = true;
	}

	function closeModals() {
		showCreateModal = false;
		showEditModal = false;
		showDeleteModal = false;
		selectedProvider = null;
	}

	async function handleCreate() {
		error = '';
		success = '';
		loading = true;

		try {
			const response = await fetch('/api/admin/auth-providers', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(formData)
			});

			if (!response.ok) {
				const data = await response.json();
				throw new Error(data.message || 'Failed to create provider');
			}

			success = 'Provider created successfully';
			await invalidateAll();
			setTimeout(closeModals, 1000);
		} catch (err) {
			error = err instanceof Error ? err.message : 'Failed to create provider';
		} finally {
			loading = false;
		}
	}

	async function handleUpdate() {
		if (!selectedProvider) return;

		error = '';
		success = '';
		loading = true;

		try {
			// Only send changed fields
			const updates: Record<string, unknown> = {
				name: formData.name,
				type: formData.type,
				enabled: formData.enabled,
				clientId: formData.clientId,
				issuerUrl: formData.issuerUrl,
				autoProvision: formData.autoProvision,
				defaultRole: formData.defaultRole,
				roleMapping: formData.roleMapping,
				roleClaim: formData.roleClaim,
				usernameClaim: formData.usernameClaim,
				emailClaim: formData.emailClaim,
				usePkce: formData.usePkce,
				scopes: formData.scopes
			};

			// Only include secret if changed
			if (formData.clientSecret) {
				updates.clientSecret = formData.clientSecret;
			}

			const response = await fetch(`/api/admin/auth-providers/${selectedProvider.id}`, {
				method: 'PATCH',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(updates)
			});

			if (!response.ok) {
				const data = await response.json();
				throw new Error(data.message || 'Failed to update provider');
			}

			success = 'Provider updated successfully';
			await invalidateAll();
			setTimeout(closeModals, 1000);
		} catch (err) {
			error = err instanceof Error ? err.message : 'Failed to update provider';
		} finally {
			loading = false;
		}
	}

	async function handleDelete() {
		if (!selectedProvider) return;

		error = '';
		success = '';
		loading = true;

		try {
			const response = await fetch(`/api/admin/auth-providers/${selectedProvider.id}`, {
				method: 'DELETE'
			});

			if (!response.ok) {
				const data = await response.json();
				throw new Error(data.message || 'Failed to delete provider');
			}

			success = 'Provider deleted successfully';
			await invalidateAll();
			setTimeout(closeModals, 1000);
		} catch (err) {
			error = err instanceof Error ? err.message : 'Failed to delete provider';
		} finally {
			loading = false;
		}
	}

	async function toggleEnabled(provider: (typeof providers)[0]) {
		try {
			const response = await fetch(`/api/admin/auth-providers/${provider.id}`, {
				method: 'PATCH',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ enabled: !provider.enabled })
			});

			if (!response.ok) {
				throw new Error('Failed to toggle provider');
			}

			await invalidateAll();
		} catch (err) {
			console.error('Failed to toggle provider:', err);
		}
	}

	function getProviderTypeName(type: string): string {
		switch (type) {
			case 'oidc':
				return 'OIDC';
			case 'oauth2-google':
				return 'Google OAuth';
			case 'oauth2-github':
				return 'GitHub OAuth';
			case 'oauth2-gitlab':
				return 'GitLab OAuth';
			case 'oauth2-generic':
				return 'Generic OAuth2';
			default:
				return type;
		}
	}
</script>

<div class="space-y-6">
	<!-- Header -->
	<div class="flex items-center justify-between">
		<div>
			<h1 class="text-2xl font-bold text-slate-100">SSO Providers</h1>
			<p class="mt-1 text-sm text-slate-400">Manage OAuth2 and OIDC authentication providers</p>
		</div>
		<button
			onclick={openCreateModal}
			class="flex items-center gap-2 rounded-lg bg-amber-500 px-4 py-2 text-sm font-medium text-slate-900 transition-colors hover:bg-amber-400"
		>
			<svg class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
				<path stroke-linecap="round" stroke-linejoin="round" d="M12 4v16m8-8H4" />
			</svg>
			Add Provider
		</button>
	</div>

	<!-- Providers List -->
	{#if providers.length === 0}
		<div class="rounded-lg border border-slate-700 bg-slate-800/50 p-12 text-center">
			<div class="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-slate-700">
				<svg class="h-6 w-6 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
					<path
						stroke-linecap="round"
						stroke-linejoin="round"
						stroke-width="2"
						d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z"
					/>
				</svg>
			</div>
			<h3 class="mt-4 text-lg font-medium text-slate-200">No SSO providers configured</h3>
			<p class="mt-2 text-sm text-slate-400">
				Get started by adding your first authentication provider
			</p>
			<button
				onclick={openCreateModal}
				class="mt-4 rounded-lg bg-amber-500 px-4 py-2 text-sm font-medium text-slate-900 transition-colors hover:bg-amber-400"
			>
				Add Provider
			</button>
		</div>
	{:else}
		<div class="grid gap-4">
			{#each providers as provider}
				<div
					class="rounded-lg border border-slate-700 bg-slate-800/50 p-6 transition-colors hover:border-slate-600"
				>
					<div class="flex items-start justify-between">
						<div class="flex-1">
							<div class="flex items-center gap-3">
								<h3 class="text-lg font-semibold text-slate-100">{provider.name}</h3>
								<span
									class="rounded-full px-2.5 py-0.5 text-xs font-medium {provider.enabled
										? 'bg-green-500/10 text-green-400'
										: 'bg-slate-600/20 text-slate-400'}"
								>
									{provider.enabled ? 'Enabled' : 'Disabled'}
								</span>
								<span
									class="rounded-full bg-slate-700 px-2.5 py-0.5 text-xs font-medium text-slate-300"
								>
									{getProviderTypeName(provider.type)}
								</span>
							</div>

							<div class="mt-4 grid grid-cols-2 gap-4 text-sm">
								<div>
									<span class="text-slate-400">Client ID:</span>
									<span class="ml-2 font-mono text-slate-300">{provider.clientId}</span>
								</div>
								{#if provider.issuerUrl}
									<div>
										<span class="text-slate-400">Issuer:</span>
										<span class="ml-2 text-slate-300">{provider.issuerUrl}</span>
									</div>
								{/if}
								<div>
									<span class="text-slate-400">Auto-provision:</span>
									<span class="ml-2 text-slate-300">{provider.autoProvision ? 'Yes' : 'No'}</span>
								</div>
								<div>
									<span class="text-slate-400">Default Role:</span>
									<span class="ml-2 text-slate-300 capitalize">{provider.defaultRole}</span>
								</div>
								<div>
									<span class="text-slate-400">PKCE:</span>
									<span class="ml-2 text-slate-300"
										>{provider.usePkce ? 'Enabled' : 'Disabled'}</span
									>
								</div>
								<div>
									<span class="text-slate-400">Scopes:</span>
									<span class="ml-2 font-mono text-xs text-slate-300">{provider.scopes}</span>
								</div>
							</div>
						</div>

						<div class="flex items-center gap-2">
							<!-- Toggle Enabled/Disabled -->
							<button
								onclick={() => toggleEnabled(provider)}
								class="rounded-lg p-2 transition-colors hover:bg-slate-700"
								title={provider.enabled ? 'Disable' : 'Enable'}
							>
								{#if provider.enabled}
									<svg
										class="h-5 w-5 text-green-400"
										fill="none"
										viewBox="0 0 24 24"
										stroke="currentColor"
									>
										<path
											stroke-linecap="round"
											stroke-linejoin="round"
											stroke-width="2"
											d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
										/>
									</svg>
								{:else}
									<svg
										class="h-5 w-5 text-slate-400"
										fill="none"
										viewBox="0 0 24 24"
										stroke="currentColor"
									>
										<path
											stroke-linecap="round"
											stroke-linejoin="round"
											stroke-width="2"
											d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z"
										/>
									</svg>
								{/if}
							</button>

							<!-- Edit Button -->
							<button
								onclick={() => openEditModal(provider)}
								class="rounded-lg p-2 transition-colors hover:bg-slate-700"
								title="Edit"
							>
								<svg
									class="h-5 w-5 text-slate-400"
									fill="none"
									viewBox="0 0 24 24"
									stroke="currentColor"
								>
									<path
										stroke-linecap="round"
										stroke-linejoin="round"
										stroke-width="2"
										d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
									/>
								</svg>
							</button>

							<!-- Delete Button -->
							<button
								onclick={() => openDeleteModal(provider)}
								class="rounded-lg p-2 transition-colors hover:bg-slate-700"
								title="Delete"
							>
								<svg
									class="h-5 w-5 text-red-400"
									fill="none"
									viewBox="0 0 24 24"
									stroke="currentColor"
								>
									<path
										stroke-linecap="round"
										stroke-linejoin="round"
										stroke-width="2"
										d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
									/>
								</svg>
							</button>
						</div>
					</div>
				</div>
			{/each}
		</div>
	{/if}
</div>

<!-- Create Modal -->
{#if showCreateModal}
	<div class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
		<div
			class="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-lg border border-slate-700 bg-slate-800 p-6"
		>
			<div class="mb-6 flex items-center justify-between">
				<h2 class="text-xl font-bold text-slate-100">Add SSO Provider</h2>
				<button
					aria-label="Close"
					onclick={closeModals}
					class="text-slate-400 hover:text-slate-300"
				>
					<svg class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
						<path
							stroke-linecap="round"
							stroke-linejoin="round"
							stroke-width="2"
							d="M6 18L18 6M6 6l12 12"
						/>
					</svg>
				</button>
			</div>

			{#if error}
				<div
					class="mb-4 rounded-lg border border-red-500/20 bg-red-500/10 p-3 text-sm text-red-400"
				>
					{error}
				</div>
			{/if}

			{#if success}
				<div
					class="mb-4 rounded-lg border border-green-500/20 bg-green-500/10 p-3 text-sm text-green-400"
				>
					{success}
				</div>
			{/if}

			<form
				onsubmit={(e) => {
					e.preventDefault();
					handleCreate();
				}}
				class="space-y-4"
			>
				<!-- Basic Settings -->
				<div class="grid grid-cols-2 gap-4">
					<div>
						<label for="provider-name" class="mb-1 block text-sm font-medium text-slate-300"
							>Provider Name</label
						>
						<input
							id="provider-name"
							type="text"
							bind:value={formData.name}
							placeholder="e.g., Company Okta"
							required
							class="w-full rounded-lg border border-slate-600 bg-slate-700 px-3 py-2 text-white placeholder-slate-400 focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20 focus:outline-none"
						/>
					</div>
					<div>
						<label for="provider-type" class="mb-1 block text-sm font-medium text-slate-300"
							>Provider Type</label
						>
						<select
							id="provider-type"
							bind:value={formData.type}
							class="w-full rounded-lg border border-slate-600 bg-slate-700 px-3 py-2 text-white focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20 focus:outline-none"
						>
							<option value="oidc">OIDC (Generic)</option>
							<option value="oauth2-google">Google OAuth</option>
							<option value="oauth2-github">GitHub OAuth</option>
							<option value="oauth2-gitlab">GitLab OAuth</option>
						</select>
					</div>
				</div>

				<!-- OAuth Credentials -->
				<div class="grid grid-cols-2 gap-4">
					<div>
						<label for="client-id" class="mb-1 block text-sm font-medium text-slate-300"
							>Client ID</label
						>
						<input
							id="client-id"
							type="text"
							bind:value={formData.clientId}
							required
							class="w-full rounded-lg border border-slate-600 bg-slate-700 px-3 py-2 text-white focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20 focus:outline-none"
						/>
					</div>
					<div>
						<label for="client-secret" class="mb-1 block text-sm font-medium text-slate-300"
							>Client Secret</label
						>
						<input
							id="client-secret"
							type="password"
							bind:value={formData.clientSecret}
							required
							class="w-full rounded-lg border border-slate-600 bg-slate-700 px-3 py-2 text-white focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20 focus:outline-none"
						/>
					</div>
				</div>

				<!-- OIDC Settings -->
				{#if formData.type === 'oidc'}
					<div>
						<label for="issuer-url" class="mb-1 block text-sm font-medium text-slate-300"
							>Issuer URL</label
						>
						<input
							id="issuer-url"
							type="url"
							bind:value={formData.issuerUrl}
							placeholder="https://accounts.google.com"
							required
							class="w-full rounded-lg border border-slate-600 bg-slate-700 px-3 py-2 text-white placeholder-slate-400 focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20 focus:outline-none"
						/>
					</div>
				{/if}

				<!-- Provisioning Settings -->
				<div class="grid grid-cols-2 gap-4">
					<div>
						<label class="flex items-center gap-2 text-sm font-medium text-slate-300">
							<input
								id="auto-provision"
								type="checkbox"
								bind:checked={formData.autoProvision}
								class="rounded"
							/>
							Auto-provision users
						</label>
					</div>
					<div>
						<label for="default-role" class="mb-1 block text-sm font-medium text-slate-300"
							>Default Role</label
						>
						<select
							id="default-role"
							bind:value={formData.defaultRole}
							class="w-full rounded-lg border border-slate-600 bg-slate-700 px-3 py-2 text-white focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20 focus:outline-none"
						>
							<option value="viewer">Viewer</option>
							<option value="editor">Editor</option>
							<option value="admin">Admin</option>
						</select>
					</div>
				</div>

				<!-- Advanced Settings -->
				<details class="rounded-lg border border-slate-700 bg-slate-900/50 p-4">
					<summary class="cursor-pointer text-sm font-medium text-slate-300"
						>Advanced Settings</summary
					>
					<div class="mt-4 space-y-4">
						<div>
							<label for="scopes" class="mb-1 block text-sm font-medium text-slate-300"
								>Scopes</label
							>
							<input
								id="scopes"
								type="text"
								bind:value={formData.scopes}
								class="w-full rounded-lg border border-slate-600 bg-slate-700 px-3 py-2 text-white focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20 focus:outline-none"
							/>
						</div>
						<div>
							<label for="role-mapping" class="mb-1 block text-sm font-medium text-slate-300"
								>Role Mapping (JSON)</label
							>
							<textarea
								id="role-mapping"
								bind:value={formData.roleMapping}
								rows="6"
								class="w-full rounded-lg border border-slate-600 bg-slate-700 px-3 py-2 font-mono text-sm text-white focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20 focus:outline-none"
							></textarea>
						</div>
						<div class="flex items-center gap-2">
							<input
								id="use-pkce"
								type="checkbox"
								bind:checked={formData.usePkce}
								class="rounded"
							/>
							<label for="use-pkce" class="text-sm text-slate-300">Enable PKCE (Recommended)</label>
						</div>
					</div>
				</details>

				<!-- Actions -->
				<div class="flex gap-3 pt-4">
					<button
						type="submit"
						disabled={loading}
						class="flex-1 rounded-lg bg-amber-500 px-4 py-2 font-medium text-slate-900 transition-colors hover:bg-amber-400 disabled:opacity-50"
					>
						{loading ? 'Creating...' : 'Create Provider'}
					</button>
					<button
						type="button"
						onclick={closeModals}
						class="rounded-lg border border-slate-600 px-4 py-2 text-slate-300 transition-colors hover:bg-slate-700"
					>
						Cancel
					</button>
				</div>
			</form>
		</div>
	</div>
{/if}

<!-- Edit Modal (similar structure to Create) -->
{#if showEditModal && selectedProvider}
	<div class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
		<div
			class="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-lg border border-slate-700 bg-slate-800 p-6"
		>
			<div class="mb-6 flex items-center justify-between">
				<h2 class="text-xl font-bold text-slate-100">Edit Provider: {selectedProvider.name}</h2>
				<button
					aria-label="Close"
					onclick={closeModals}
					class="text-slate-400 hover:text-slate-300"
				>
					<svg class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
						<path
							stroke-linecap="round"
							stroke-linejoin="round"
							stroke-width="2"
							d="M6 18L18 6M6 6l12 12"
						/>
					</svg>
				</button>
			</div>

			{#if error}
				<div
					class="mb-4 rounded-lg border border-red-500/20 bg-red-500/10 p-3 text-sm text-red-400"
				>
					{error}
				</div>
			{/if}

			{#if success}
				<div
					class="mb-4 rounded-lg border border-green-500/20 bg-green-500/10 p-3 text-sm text-green-400"
				>
					{success}
				</div>
			{/if}

			<form
				onsubmit={(e) => {
					e.preventDefault();
					handleUpdate();
				}}
				class="space-y-4"
			>
				<!-- Same form fields as Create modal, but with Update button -->
				<div class="grid grid-cols-2 gap-4">
					<div>
						<label for="edit-provider-name" class="mb-1 block text-sm font-medium text-slate-300"
							>Provider Name</label
						>
						<input
							id="edit-provider-name"
							type="text"
							bind:value={formData.name}
							required
							class="w-full rounded-lg border border-slate-600 bg-slate-700 px-3 py-2 text-white focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20 focus:outline-none"
						/>
					</div>
					<div>
						<label for="edit-default-role" class="mb-1 block text-sm font-medium text-slate-300"
							>Default Role</label
						>
						<select
							id="edit-default-role"
							bind:value={formData.defaultRole}
							class="w-full rounded-lg border border-slate-600 bg-slate-700 px-3 py-2 text-white focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20 focus:outline-none"
						>
							<option value="viewer">Viewer</option>
							<option value="editor">Editor</option>
							<option value="admin">Admin</option>
						</select>
					</div>
				</div>

				<div>
					<label for="edit-client-secret" class="mb-1 block text-sm font-medium text-slate-300">
						Client Secret (leave blank to keep current)
					</label>
					<input
						id="edit-client-secret"
						type="password"
						bind:value={formData.clientSecret}
						placeholder="Enter new secret to change"
						class="w-full rounded-lg border border-slate-600 bg-slate-700 px-3 py-2 text-white placeholder-slate-400 focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20 focus:outline-none"
					/>
				</div>

				<div class="flex gap-3 pt-4">
					<button
						type="submit"
						disabled={loading}
						class="flex-1 rounded-lg bg-amber-500 px-4 py-2 font-medium text-slate-900 transition-colors hover:bg-amber-400 disabled:opacity-50"
					>
						{loading ? 'Updating...' : 'Update Provider'}
					</button>
					<button
						type="button"
						onclick={closeModals}
						class="rounded-lg border border-slate-600 px-4 py-2 text-slate-300 transition-colors hover:bg-slate-700"
					>
						Cancel
					</button>
				</div>
			</form>
		</div>
	</div>
{/if}

<!-- Delete Confirmation Modal -->
{#if showDeleteModal && selectedProvider}
	<div class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
		<div class="w-full max-w-md rounded-lg border border-slate-700 bg-slate-800 p-6">
			<h2 class="text-xl font-bold text-slate-100">Delete Provider</h2>
			<p class="mt-4 text-sm text-slate-300">
				Are you sure you want to delete <strong>{selectedProvider.name}</strong>? This action cannot
				be undone and will affect all users linked to this provider.
			</p>

			{#if error}
				<div
					class="mt-4 rounded-lg border border-red-500/20 bg-red-500/10 p-3 text-sm text-red-400"
				>
					{error}
				</div>
			{/if}

			<div class="mt-6 flex gap-3">
				<button
					onclick={handleDelete}
					disabled={loading}
					class="flex-1 rounded-lg bg-red-500 px-4 py-2 font-medium text-white transition-colors hover:bg-red-600 disabled:opacity-50"
				>
					{loading ? 'Deleting...' : 'Delete'}
				</button>
				<button
					onclick={closeModals}
					class="rounded-lg border border-slate-600 px-4 py-2 text-slate-300 transition-colors hover:bg-slate-700"
				>
					Cancel
				</button>
			</div>
		</div>
	</div>
{/if}
