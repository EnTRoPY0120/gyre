<script lang="ts">
	import { goto } from '$app/navigation';
	import StatusBadge from '$lib/components/flux/StatusBadge.svelte';
	import ResourceMetadata from '$lib/components/flux/ResourceMetadata.svelte';
	import ConditionList from '$lib/components/flux/ConditionList.svelte';
	import GitRepositoryDetail from '$lib/components/flux/resources/GitRepositoryDetail.svelte';
	import HelmReleaseDetail from '$lib/components/flux/resources/HelmReleaseDetail.svelte';
	import KustomizationDetail from '$lib/components/flux/resources/KustomizationDetail.svelte';
	import type { FluxResource, K8sCondition } from '$lib/types/flux';

	interface Props {
		data: {
			resourceType: string;
			resourceInfo: {
				displayName: string;
				singularName: string;
				description: string;
			};
			namespace: string;
			name: string;
			resource: FluxResource;
		};
	}

	let { data }: Props = $props();

	type TabId = 'overview' | 'spec' | 'status' | 'events' | 'yaml';

	let activeTab = $state<TabId>('overview');

	const tabs: { id: TabId; label: string }[] = [
		{ id: 'overview', label: 'Overview' },
		{ id: 'spec', label: 'Spec' },
		{ id: 'status', label: 'Status' },
		{ id: 'events', label: 'Events' },
		{ id: 'yaml', label: 'YAML' }
	];

	function goBack() {
		goto(`/resources/${data.resourceType}`);
	}

	// Get conditions safely
	const conditions = $derived<K8sCondition[]>(data.resource.status?.conditions || []);

	// Detect resource type for specialized views
	const isGitRepository = $derived(data.resourceType === 'gitrepositories');
	const isHelmRelease = $derived(data.resourceType === 'helmreleases');
	const isKustomization = $derived(data.resourceType === 'kustomizations');
	const hasSpecializedView = $derived(isGitRepository || isHelmRelease || isKustomization);
</script>

<div class="space-y-6">
	<!-- Header with Back Button -->
	<div class="flex items-start gap-4">
		<button
			type="button"
			class="mt-1 rounded-lg p-2 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600"
			onclick={goBack}
			aria-label="Go back"
		>
			<svg class="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
				<path
					stroke-linecap="round"
					stroke-linejoin="round"
					stroke-width="2"
					d="M15 19l-7-7 7-7"
				/>
			</svg>
		</button>
		<div class="flex-1">
			<div class="flex items-center gap-3">
				<h1 class="text-2xl font-bold text-gray-900">{data.name}</h1>
				<StatusBadge
					conditions={data.resource.status?.conditions}
					suspended={data.resource.spec?.suspend as boolean | undefined}
				/>
			</div>
			<p class="mt-1 text-sm text-gray-500">
				{data.resourceInfo.singularName} in {data.namespace}
			</p>
		</div>
	</div>

	<!-- Tabs -->
	<div class="border-b border-gray-200">
		<nav class="-mb-px flex space-x-8">
			{#each tabs as tab}
				<button
					type="button"
					class="whitespace-nowrap border-b-2 px-1 py-4 text-sm font-medium transition-colors {activeTab ===
					tab.id
						? 'border-blue-500 text-blue-600'
						: 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700'}"
					onclick={() => (activeTab = tab.id)}
				>
					{tab.label}
				</button>
			{/each}
		</nav>
	</div>

	<!-- Tab Content -->
	<div class="pt-2">
		{#if activeTab === 'overview'}
			<!-- Metadata and Conditions (always shown) -->
			<div class="grid gap-6 lg:grid-cols-2">
				<!-- Metadata Card -->
				<div class="rounded-lg border border-gray-200 bg-white p-6">
					<h3 class="mb-4 text-lg font-semibold text-gray-900">Metadata</h3>
					<ResourceMetadata metadata={data.resource.metadata} />
				</div>

				<!-- Conditions Card -->
				<div class="rounded-lg border border-gray-200 bg-white p-6">
					<h3 class="mb-4 text-lg font-semibold text-gray-900">Conditions</h3>
					<ConditionList {conditions} />
				</div>
			</div>

			<!-- Resource-Specific Details -->
			<div class="mt-6">
				{#if isGitRepository}
					<GitRepositoryDetail resource={data.resource} />
				{:else if isHelmRelease}
					<HelmReleaseDetail resource={data.resource} />
				{:else if isKustomization}
					<KustomizationDetail resource={data.resource} />
				{:else if data.resource.spec}
					<!-- Generic Configuration Card for other resource types -->
					<div class="rounded-lg border border-gray-200 bg-white p-6">
						<h3 class="mb-4 text-lg font-semibold text-gray-900">Configuration</h3>
						<dl class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
							{#each Object.entries(data.resource.spec).slice(0, 9) as [key, value]}
								<div>
									<dt class="text-sm font-medium text-gray-500">{key}</dt>
									<dd class="mt-1 text-sm text-gray-900">
										{#if typeof value === 'object'}
											<code class="rounded bg-gray-100 px-1.5 py-0.5 text-xs"
												>{JSON.stringify(value)}</code
											>
										{:else if typeof value === 'boolean'}
											<span
												class="inline-flex rounded-md px-2 py-0.5 text-xs font-medium {value
													? 'bg-green-100 text-green-800'
													: 'bg-gray-100 text-gray-800'}"
											>
												{value ? 'Yes' : 'No'}
											</span>
										{:else}
											{value}
										{/if}
									</dd>
								</div>
							{/each}
						</dl>
					</div>
				{/if}
			</div>
		{:else if activeTab === 'spec'}
			<div class="rounded-lg border border-gray-200 bg-white p-6">
				<h3 class="mb-4 text-lg font-semibold text-gray-900">Resource Spec</h3>
				{#if data.resource.spec}
					<pre
						class="overflow-auto rounded-lg bg-gray-900 p-4 text-sm text-gray-100"><code>{JSON.stringify(data.resource.spec, null, 2)}</code></pre>
				{:else}
					<p class="text-sm text-gray-500">No spec available</p>
				{/if}
			</div>
		{:else if activeTab === 'status'}
			<div class="rounded-lg border border-gray-200 bg-white p-6">
				<h3 class="mb-4 text-lg font-semibold text-gray-900">Resource Status</h3>
				{#if data.resource.status}
					<pre
						class="overflow-auto rounded-lg bg-gray-900 p-4 text-sm text-gray-100"><code>{JSON.stringify(data.resource.status, null, 2)}</code></pre>
				{:else}
					<p class="text-sm text-gray-500">No status available</p>
				{/if}
			</div>
		{:else if activeTab === 'events'}
			<div class="rounded-lg border border-gray-200 bg-white p-6">
				<h3 class="mb-4 text-lg font-semibold text-gray-900">Events</h3>
				<div class="flex flex-col items-center justify-center py-12 text-center">
					<svg
						class="h-12 w-12 text-gray-300"
						fill="none"
						stroke="currentColor"
						viewBox="0 0 24 24"
					>
						<path
							stroke-linecap="round"
							stroke-linejoin="round"
							stroke-width="2"
							d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
						/>
					</svg>
					<p class="mt-4 text-sm text-gray-500">Events coming soon</p>
					<p class="mt-1 text-xs text-gray-400">
						This feature will display Kubernetes events related to this resource
					</p>
				</div>
			</div>
		{:else if activeTab === 'yaml'}
			<div class="rounded-lg border border-gray-200 bg-white p-6">
				<div class="mb-4 flex items-center justify-between">
					<h3 class="text-lg font-semibold text-gray-900">Full Resource YAML</h3>
					<button
						type="button"
						class="inline-flex items-center gap-1.5 rounded-md bg-gray-100 px-3 py-1.5 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-200"
						onclick={() => {
							navigator.clipboard.writeText(JSON.stringify(data.resource, null, 2));
						}}
					>
						<svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
							<path
								stroke-linecap="round"
								stroke-linejoin="round"
								stroke-width="2"
								d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
							/>
						</svg>
						Copy
					</button>
				</div>
				<pre
					class="overflow-auto rounded-lg bg-gray-900 p-4 text-sm text-gray-100"><code>{JSON.stringify(data.resource, null, 2)}</code></pre>
			</div>
		{/if}
	</div>
</div>
