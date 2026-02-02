<script lang="ts">
	import type { FluxResource } from '$lib/types/flux';
	import { formatTimestamp } from '$lib/utils/flux';

	interface Props {
		resource: FluxResource;
	}

	let { resource }: Props = $props();

	// Extract Kustomization-specific fields
	const spec = $derived(resource.spec || {});
	const status = $derived(resource.status || {});

	const sourceRef = $derived(spec.sourceRef as { kind: string; name: string; namespace?: string } | undefined);
	const path = $derived(spec.path as string | undefined);
	const interval = $derived(spec.interval as string | undefined);
	const timeout = $derived(spec.timeout as string | undefined);
	const targetNamespace = $derived(spec.targetNamespace as string | undefined);
	const prune = $derived(spec.prune as boolean | undefined);
	const force = $derived(spec.force as boolean | undefined);
	const suspend = $derived(spec.suspend as boolean | undefined);
	const healthChecks = $derived(spec.healthChecks as Array<{ kind: string; name: string; namespace: string }> | undefined);
	const dependsOn = $derived(spec.dependsOn as Array<{ name: string; namespace?: string }> | undefined);
	const patches = $derived(spec.patches as unknown[] | undefined);
	const postBuild = $derived(spec.postBuild as { substitute?: Record<string, string>; substituteFrom?: unknown[] } | undefined);

	// Status fields
	const lastAppliedRevision = $derived(status.lastAppliedRevision as string | undefined);
	const lastAttemptedRevision = $derived(status.lastAttemptedRevision as string | undefined);
	const lastHandledReconcileAt = $derived((status as Record<string, unknown>).lastHandledReconcileAt as string | undefined);
</script>

<div class="space-y-6">
	<!-- Source Configuration -->
	<div class="rounded-lg border border-gray-200 bg-white p-6">
		<h3 class="mb-4 text-lg font-semibold text-gray-900">Source Configuration</h3>
		<dl class="grid gap-4 sm:grid-cols-2">
			{#if sourceRef}
				<div>
					<dt class="text-sm font-medium text-gray-500">Source Reference</dt>
					<dd class="mt-1 flex items-center gap-2">
						<span class="inline-flex items-center gap-1.5 rounded-md bg-blue-100 px-2 py-1 text-xs font-medium text-blue-800">
							<svg class="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
								<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
							</svg>
							{sourceRef.kind}
						</span>
						<span class="text-sm text-gray-900">
							{sourceRef.name}
							{#if sourceRef.namespace}
								<span class="text-gray-500">({sourceRef.namespace})</span>
							{/if}
						</span>
					</dd>
				</div>
			{/if}

			{#if path}
				<div>
					<dt class="text-sm font-medium text-gray-500">Path</dt>
					<dd class="mt-1">
						<code class="rounded bg-gray-100 px-2 py-1 text-sm text-gray-800">{path}</code>
					</dd>
				</div>
			{/if}

			{#if interval}
				<div>
					<dt class="text-sm font-medium text-gray-500">Reconcile Interval</dt>
					<dd class="mt-1 text-sm text-gray-900">{interval}</dd>
				</div>
			{/if}

			{#if timeout}
				<div>
					<dt class="text-sm font-medium text-gray-500">Timeout</dt>
					<dd class="mt-1 text-sm text-gray-900">{timeout}</dd>
				</div>
			{/if}

			{#if targetNamespace}
				<div>
					<dt class="text-sm font-medium text-gray-500">Target Namespace</dt>
					<dd class="mt-1">
						<span class="inline-flex items-center rounded-md bg-green-100 px-2 py-1 text-xs font-medium text-green-800">
							{targetNamespace}
						</span>
					</dd>
				</div>
			{/if}
		</dl>
	</div>

	<!-- Reconciliation Settings -->
	<div class="rounded-lg border border-gray-200 bg-white p-6">
		<h3 class="mb-4 text-lg font-semibold text-gray-900">Reconciliation Settings</h3>
		<div class="flex flex-wrap gap-3">
			<div class="flex items-center gap-2 rounded-lg border border-gray-200 px-3 py-2">
				<span class="text-sm font-medium text-gray-500">Prune</span>
				<span class="inline-flex rounded-md px-2 py-0.5 text-xs font-medium {prune ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-600'}">
					{prune ? 'Enabled' : 'Disabled'}
				</span>
			</div>

			<div class="flex items-center gap-2 rounded-lg border border-gray-200 px-3 py-2">
				<span class="text-sm font-medium text-gray-500">Force</span>
				<span class="inline-flex rounded-md px-2 py-0.5 text-xs font-medium {force ? 'bg-yellow-100 text-yellow-800' : 'bg-gray-100 text-gray-600'}">
					{force ? 'Enabled' : 'Disabled'}
				</span>
			</div>

			<div class="flex items-center gap-2 rounded-lg border border-gray-200 px-3 py-2">
				<span class="text-sm font-medium text-gray-500">Suspended</span>
				<span class="inline-flex rounded-md px-2 py-0.5 text-xs font-medium {suspend ? 'bg-gray-100 text-gray-800' : 'bg-green-100 text-green-800'}">
					{suspend ? 'Yes' : 'No'}
				</span>
			</div>
		</div>
	</div>

	<!-- Revision Status -->
	{#if lastAppliedRevision || lastAttemptedRevision || lastHandledReconcileAt}
		<div class="rounded-lg border border-gray-200 bg-white p-6">
			<h3 class="mb-4 text-lg font-semibold text-gray-900">Revision Status</h3>
			<dl class="grid gap-4 sm:grid-cols-2">
				{#if lastAppliedRevision}
					<div class="sm:col-span-2">
						<dt class="text-sm font-medium text-gray-500">Last Applied Revision</dt>
						<dd class="mt-1 font-mono text-sm text-gray-900">{lastAppliedRevision}</dd>
					</div>
				{/if}

				{#if lastAttemptedRevision && lastAttemptedRevision !== lastAppliedRevision}
					<div class="sm:col-span-2">
						<dt class="text-sm font-medium text-gray-500">Last Attempted Revision</dt>
						<dd class="mt-1 font-mono text-sm text-gray-900">{lastAttemptedRevision}</dd>
					</div>
				{/if}

				{#if lastHandledReconcileAt}
					<div>
						<dt class="text-sm font-medium text-gray-500">Last Reconciled</dt>
						<dd class="mt-1 text-sm text-gray-900">{formatTimestamp(lastHandledReconcileAt)}</dd>
					</div>
				{/if}
			</dl>
		</div>
	{/if}

	<!-- Dependencies -->
	{#if dependsOn && dependsOn.length > 0}
		<div class="rounded-lg border border-gray-200 bg-white p-6">
			<h3 class="mb-4 text-lg font-semibold text-gray-900">Dependencies</h3>
			<div class="flex flex-wrap gap-2">
				{#each dependsOn as dep}
					<span class="inline-flex items-center gap-1.5 rounded-md bg-purple-100 px-2.5 py-1 text-xs font-medium text-purple-800">
						<svg class="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
							<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
						</svg>
						{dep.name}
						{#if dep.namespace}
							<span class="text-purple-600">({dep.namespace})</span>
						{/if}
					</span>
				{/each}
			</div>
		</div>
	{/if}

	<!-- Health Checks -->
	{#if healthChecks && healthChecks.length > 0}
		<div class="rounded-lg border border-gray-200 bg-white p-6">
			<h3 class="mb-4 text-lg font-semibold text-gray-900">Health Checks</h3>
			<div class="space-y-2">
				{#each healthChecks as check}
					<div class="flex items-center gap-2 rounded-lg bg-gray-50 px-3 py-2">
						<span class="inline-flex items-center rounded-md bg-gray-200 px-2 py-0.5 text-xs font-medium text-gray-700">
							{check.kind}
						</span>
						<span class="text-sm text-gray-900">{check.name}</span>
						<span class="text-sm text-gray-500">in {check.namespace}</span>
					</div>
				{/each}
			</div>
		</div>
	{/if}

	<!-- Patches Info -->
	{#if patches && patches.length > 0}
		<div class="rounded-lg border border-gray-200 bg-white p-6">
			<h3 class="mb-4 text-lg font-semibold text-gray-900">Patches</h3>
			<p class="text-sm text-gray-600">
				<span class="font-medium text-gray-900">{patches.length}</span> patch(es) configured
			</p>
		</div>
	{/if}

	<!-- PostBuild Substitutions -->
	{#if postBuild?.substitute && Object.keys(postBuild.substitute).length > 0}
		<div class="rounded-lg border border-gray-200 bg-white p-6">
			<h3 class="mb-4 text-lg font-semibold text-gray-900">PostBuild Substitutions</h3>
			<div class="flex flex-wrap gap-2">
				{#each Object.entries(postBuild.substitute) as [key, value]}
					<span class="inline-flex items-center rounded-md bg-orange-100 px-2 py-1 text-xs font-medium text-orange-800">
						<span class="font-semibold">{key}</span>=<span class="text-orange-600">{value}</span>
					</span>
				{/each}
			</div>
		</div>
	{/if}
</div>
