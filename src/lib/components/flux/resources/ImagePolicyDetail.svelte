<script lang="ts">
	import type { FluxResource } from '$lib/types/flux';

	interface Props {
		resource: FluxResource;
	}

	let { resource }: Props = $props();

	const spec = $derived(resource.spec || {});
	const status = $derived(resource.status || {});

	const imageRepositoryRef = $derived(
		spec.imageRepositoryRef as { name: string; namespace?: string } | undefined
	);
	const policy = $derived(
		spec.policy as
			| {
					semver?: { range: string };
					alphabetical?: { order?: string };
					numerical?: { order?: string };
			  }
			| undefined
	);
	const filterTags = $derived(
		spec.filterTags as { pattern?: string; extract?: string } | undefined
	);
	const suspend = $derived(spec.suspend as boolean | undefined);

	// Status fields
	const latestImage = $derived(
		(status as Record<string, unknown>).latestImage as string | undefined
	);

	// Derive which policy type is active
	const policyType = $derived.by(() => {
		if (policy?.semver) return 'semver';
		if (policy?.alphabetical) return 'alphabetical';
		if (policy?.numerical) return 'numerical';
		return 'unknown';
	});
</script>

<div class="space-y-6">
	<!-- Policy Configuration -->
	<div class="rounded-lg border border-gray-200 bg-white p-6 dark:border-gray-700 dark:bg-gray-800">
		<h3 class="mb-4 text-lg font-semibold text-gray-900 dark:text-gray-100">
			Policy Configuration
		</h3>
		<dl class="grid gap-4 sm:grid-cols-2">
			{#if imageRepositoryRef}
				<div class="sm:col-span-2">
					<dt class="text-sm font-medium text-gray-500 dark:text-gray-400">
						Image Repository Reference
					</dt>
					<dd class="mt-1 flex items-center gap-2">
						<span
							class="inline-flex items-center gap-1.5 rounded-md bg-indigo-100 px-2 py-1 text-xs font-medium text-indigo-800 dark:bg-indigo-900/50 dark:text-indigo-300"
						>
							<svg class="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
								<path
									stroke-linecap="round"
									stroke-linejoin="round"
									stroke-width="2"
									d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"
								/>
							</svg>
							ImageRepository
						</span>
						<span class="text-sm text-gray-900 dark:text-gray-100">
							{imageRepositoryRef.name}
							{#if imageRepositoryRef.namespace}
								<span class="text-gray-500 dark:text-gray-400">
									({imageRepositoryRef.namespace})
								</span>
							{/if}
						</span>
					</dd>
				</div>
			{/if}

			{#if policy}
				<div>
					<dt class="text-sm font-medium text-gray-500 dark:text-gray-400">Policy Type</dt>
					<dd class="mt-1">
						<span
							class="inline-flex items-center rounded-md px-2 py-1 text-xs font-medium {policyType === 'semver'
								? 'bg-green-100 text-green-800 dark:bg-green-900/50 dark:text-green-300'
								: policyType === 'alphabetical'
									? 'bg-blue-100 text-blue-800 dark:bg-blue-900/50 dark:text-blue-300'
									: policyType === 'numerical'
										? 'bg-purple-100 text-purple-800 dark:bg-purple-900/50 dark:text-purple-300'
										: 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300'}"
						>
							{policyType}
						</span>
					</dd>
				</div>

				<div>
					<dt class="text-sm font-medium text-gray-500 dark:text-gray-400">Policy Value</dt>
					<dd class="mt-1">
						{#if policy.semver}
							<code
								class="rounded bg-gray-100 px-2 py-1 text-sm text-gray-800 dark:bg-gray-700 dark:text-gray-200"
								>{policy.semver.range}</code
							>
						{:else if policy.alphabetical}
							<span class="text-sm text-gray-900 dark:text-gray-100">
								Order: {policy.alphabetical.order || 'asc'}
							</span>
						{:else if policy.numerical}
							<span class="text-sm text-gray-900 dark:text-gray-100">
								Order: {policy.numerical.order || 'asc'}
							</span>
						{/if}
					</dd>
				</div>
			{/if}

			{#if suspend !== undefined}
				<div>
					<dt class="text-sm font-medium text-gray-500 dark:text-gray-400">Suspended</dt>
					<dd class="mt-1">
						<span
							class="inline-flex rounded-md px-2 py-0.5 text-xs font-medium {suspend
								? 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300'
								: 'bg-green-100 text-green-800 dark:bg-green-900/50 dark:text-green-300'}"
						>
							{suspend ? 'Yes' : 'No'}
						</span>
					</dd>
				</div>
			{/if}
		</dl>
	</div>

	<!-- Tag Filters -->
	{#if filterTags}
		<div
			class="rounded-lg border border-gray-200 bg-white p-6 dark:border-gray-700 dark:bg-gray-800"
		>
			<h3 class="mb-4 text-lg font-semibold text-gray-900 dark:text-gray-100">Tag Filters</h3>
			<dl class="grid gap-4 sm:grid-cols-2">
				{#if filterTags.pattern}
					<div>
						<dt class="text-sm font-medium text-gray-500 dark:text-gray-400">Pattern</dt>
						<dd class="mt-1">
							<code
								class="rounded bg-gray-100 px-2 py-1 text-sm text-gray-800 dark:bg-gray-700 dark:text-gray-200"
								>{filterTags.pattern}</code
							>
						</dd>
					</div>
				{/if}
				{#if filterTags.extract}
					<div>
						<dt class="text-sm font-medium text-gray-500 dark:text-gray-400">Extract</dt>
						<dd class="mt-1">
							<code
								class="rounded bg-gray-100 px-2 py-1 text-sm text-gray-800 dark:bg-gray-700 dark:text-gray-200"
								>{filterTags.extract}</code
							>
						</dd>
					</div>
				{/if}
			</dl>
		</div>
	{/if}

	<!-- Latest Image -->
	{#if latestImage}
		<div
			class="rounded-lg border border-emerald-200 bg-emerald-50 p-6 dark:border-emerald-800 dark:bg-emerald-900/20"
		>
			<h3 class="mb-3 text-lg font-semibold text-emerald-900 dark:text-emerald-100">
				Latest Selected Image
			</h3>
			<div class="rounded-lg bg-white p-3 dark:bg-gray-800">
				<code class="text-sm font-medium text-gray-900 dark:text-gray-100">{latestImage}</code>
			</div>
		</div>
	{/if}
</div>
