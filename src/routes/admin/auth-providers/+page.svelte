<script lang="ts">
	import { invalidateAll } from '$app/navigation';
	import type { PageData } from './$types';
	import AuthProviderForm from '$lib/components/admin/AuthProviderForm.svelte';
	import AuthProviderCard from '$lib/components/admin/AuthProviderCard.svelte';
	import AuthProviderDeleteDialog from '$lib/components/admin/AuthProviderDeleteDialog.svelte';
	import {
		DEFAULT_ROLE_MAPPING_TEMPLATE,
		parseRoleMappingInput,
		stringifyRoleMappingForForm
	} from '$lib/auth/role-mapping';
	import {
		createEmptyAuthProviderFormData,
		type AuthProviderFormData,
		type AuthProviderRole,
		type AuthProviderType,
		type AuthProviderSummary
	} from '$lib/components/admin/auth-provider';
	import { getCsrfToken } from '$lib/utils/csrf';
	import { logger } from '$lib/utils/logger.js';

	let { data } = $props<{ data: PageData }>();
	let providers = $derived(data.providers || []);

	let showCreateModal = $state(false);
	let showEditModal = $state(false);
	let showDeleteModal = $state(false);
	let selectedProvider = $state<(typeof providers)[number] | null>(null);
	let error = $state('');
	let success = $state('');
	let loading = $state(false);
	let roleMappingError = $state('');
	let formData = $state<AuthProviderFormData>({
		...createEmptyAuthProviderFormData(),
		roleMapping: DEFAULT_ROLE_MAPPING_TEMPLATE
	});

	function openCreateModal() {
		formData = {
			...createEmptyAuthProviderFormData(),
			roleMapping: DEFAULT_ROLE_MAPPING_TEMPLATE
		};
		roleMappingError = '';
		error = '';
		success = '';
		showCreateModal = true;
	}

	function openEditModal(provider: (typeof providers)[number]) {
		selectedProvider = provider;
		formData = {
			name: provider.name,
			type: provider.type as AuthProviderType,
			enabled: provider.enabled,
			clientId: provider.clientId,
			clientSecret: '',
			issuerUrl: provider.issuerUrl || '',
			autoProvision: provider.autoProvision,
			defaultRole: provider.defaultRole as AuthProviderRole,
			roleMapping: stringifyRoleMappingForForm(provider.roleMapping, DEFAULT_ROLE_MAPPING_TEMPLATE),
			roleClaim: provider.roleClaim,
			usernameClaim: provider.usernameClaim,
			emailClaim: provider.emailClaim,
			usePkce: provider.usePkce,
			scopes: provider.scopes
		};
		roleMappingError = '';
		error = '';
		success = '';
		showEditModal = true;
	}

	function openDeleteModal(provider: (typeof providers)[number]) {
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

	function normalizeRoleMappingForSave(value: string) {
		const trimmed = value.trim();
		if (!trimmed || trimmed === DEFAULT_ROLE_MAPPING_TEMPLATE.trim()) return null;

		try {
			const parsed = parseRoleMappingInput(trimmed);
			if (!parsed || Object.values(parsed).every((groups) => groups.length === 0)) return null;
			return parsed;
		} catch {
			return null;
		}
	}

	async function handleCreate() {
		if (roleMappingError) return;
		error = '';
		success = '';
		loading = true;

		try {
			const roleMapping = normalizeRoleMappingForSave(formData.roleMapping);
			const { roleMapping: _roleMapping, ...providerData } = formData;
			const body = roleMapping === null ? providerData : { ...providerData, roleMapping };
			const response = await fetch('/api/v1/admin/auth-providers', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': getCsrfToken() },
				body: JSON.stringify(body)
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
		if (!selectedProvider || roleMappingError) return;
		error = '';
		success = '';
		loading = true;

		try {
			const roleMapping = normalizeRoleMappingForSave(formData.roleMapping);
			const updates: Record<string, unknown> = {
				name: formData.name,
				type: formData.type,
				enabled: formData.enabled,
				clientId: formData.clientId,
				issuerUrl: formData.issuerUrl,
				autoProvision: formData.autoProvision,
				defaultRole: formData.defaultRole,
				roleMapping,
				roleClaim: formData.roleClaim,
				usernameClaim: formData.usernameClaim,
				emailClaim: formData.emailClaim,
				usePkce: formData.usePkce,
				scopes: formData.scopes
			};
			if (formData.clientSecret) updates.clientSecret = formData.clientSecret;

			const response = await fetch(`/api/v1/admin/auth-providers/${selectedProvider.id}`, {
				method: 'PATCH',
				headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': getCsrfToken() },
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
			const response = await fetch(`/api/v1/admin/auth-providers/${selectedProvider.id}`, {
				method: 'DELETE',
				headers: { 'X-CSRF-Token': getCsrfToken() }
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

	async function toggleEnabled(provider: (typeof providers)[number]) {
		try {
			const response = await fetch(`/api/v1/admin/auth-providers/${provider.id}`, {
				method: 'PATCH',
				headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': getCsrfToken() },
				body: JSON.stringify({ enabled: !provider.enabled })
			});
			if (!response.ok) throw new Error('Failed to toggle provider');
			await invalidateAll();
		} catch (err) {
			logger.error(err, 'Failed to toggle provider:');
		}
	}

	function getProviderTypeName(type: string): string {
		return (
			{
				oidc: 'OIDC',
				'oauth2-google': 'Google OAuth',
				'oauth2-github': 'GitHub OAuth',
				'oauth2-gitlab': 'GitLab OAuth',
				'oauth2-generic': 'Generic OAuth2'
			} satisfies Record<string, string>
		)[type] ?? type;
	}
</script>

<div class="space-y-6">
	<div class="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
		<div>
			<h1 class="text-2xl font-bold text-slate-100">SSO Providers</h1>
			<p class="mt-1 text-sm text-slate-400">Manage OAuth2 and OIDC authentication providers</p>
		</div>
		<button
			type="button"
			onclick={openCreateModal}
			class="flex w-full items-center justify-center gap-2 rounded-lg bg-amber-500 px-4 py-2 text-sm font-medium text-slate-900 transition-colors hover:bg-amber-400 sm:w-auto"
		>
			<svg class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
				<path stroke-linecap="round" stroke-linejoin="round" d="M12 4v16m8-8H4" />
			</svg>
			Add Provider
		</button>
	</div>

	{#if providers.length === 0}
		<div class="rounded-lg border border-slate-700 bg-slate-800/50 p-12 text-center">
			<div class="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-slate-700">
				<svg class="h-6 w-6 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
					<path
						stroke="currentColor"
						stroke-width="2"
						d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z"
					/>
				</svg>
			</div>
			<h3 class="mt-4 text-lg font-medium text-slate-200">No SSO providers configured</h3>
			<p class="mt-2 text-sm text-slate-400">Get started by adding your first authentication provider</p>
			<button
				type="button"
				onclick={openCreateModal}
				class="mt-4 rounded-lg bg-amber-500 px-4 py-2 text-sm font-medium text-slate-900 transition-colors hover:bg-amber-400"
			>
				Add Provider
			</button>
		</div>
	{:else}
		<div class="grid gap-4">
			{#each providers as provider (provider.id)}
				<AuthProviderCard
					provider={provider as AuthProviderSummary}
					{getProviderTypeName}
					onToggle={toggleEnabled}
					onEdit={openEditModal}
					onDelete={openDeleteModal}
				/>
			{/each}
		</div>
	{/if}
</div>

{#if showCreateModal}
	<AuthProviderForm
		bind:formData
		bind:roleMappingError
		mode="create"
		error={error}
		success={success}
		loading={loading}
		onSubmit={handleCreate}
		onClose={closeModals}
	/>
{/if}

{#if showEditModal && selectedProvider}
	<AuthProviderForm
		bind:formData
		bind:roleMappingError
		mode="edit"
		providerName={selectedProvider.name}
		error={error}
		success={success}
		loading={loading}
		onSubmit={handleUpdate}
		onClose={closeModals}
	/>
{/if}

{#if showDeleteModal && selectedProvider}
	<AuthProviderDeleteDialog
		provider={selectedProvider as AuthProviderSummary}
		{error}
		{loading}
		onClose={closeModals}
		onDelete={handleDelete}
	/>
{/if}
