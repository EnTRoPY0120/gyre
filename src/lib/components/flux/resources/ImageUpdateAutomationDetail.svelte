<script lang="ts">
	import type { FluxResource } from '$lib/types/flux';
	import { formatTimestamp } from '$lib/utils/flux';

	interface Props {
		resource: FluxResource;
	}

	let { resource }: Props = $props();

	const spec = $derived(resource.spec || {});
	const status = $derived(resource.status || {});

	const interval = $derived(spec.interval as string | undefined);
	const sourceRef = $derived(
		spec.sourceRef as { kind: string; name: string; namespace?: string } | undefined
	);
	const gitSpec = $derived(
		spec.git as
			| {
					checkout?: { ref?: { branch?: string; tag?: string; commit?: string } };
					commit?: {
						author?: { email?: string; name?: string };
						messageTemplate?: string;
						signingKey?: { secretRef?: { name: string } };
					};
					push?: { branch?: string; refspec?: string };
			  }
			| undefined
	);
	const update = $derived(
		spec.update as { path?: string; strategy?: string } | undefined
	);
	const suspend = $derived(spec.suspend as boolean | undefined);

	// Status fields
	const lastAutomationRunTime = $derived(
		(status as Record<string, unknown>).lastAutomationRunTime as string | undefined
	);
	const lastPushCommit = $derived(
		(status as Record<string, unknown>).lastPushCommit as string | undefined
	);
	const lastPushTime = $derived(
		(status as Record<string, unknown>).lastPushTime as string | undefined
	);
</script>

<div class="space-y-6">
	<!-- Automation Configuration -->
	<div class="rounded-lg border border-gray-200 bg-white p-6 dark:border-gray-700 dark:bg-gray-800">
		<h3 class="mb-4 text-lg font-semibold text-gray-900 dark:text-gray-100">
			Automation Configuration
		</h3>
		<dl class="grid gap-4 sm:grid-cols-2">
			{#if sourceRef}
				<div class="sm:col-span-2">
					<dt class="text-sm font-medium text-gray-500 dark:text-gray-400">Source Reference</dt>
					<dd class="mt-1 flex items-center gap-2">
						<span
							class="inline-flex items-center gap-1.5 rounded-md bg-blue-100 px-2 py-1 text-xs font-medium text-blue-800 dark:bg-blue-900/50 dark:text-blue-300"
						>
							{sourceRef.kind}
						</span>
						<span class="text-sm text-gray-900 dark:text-gray-100">
							{sourceRef.name}
							{#if sourceRef.namespace}
								<span class="text-gray-500 dark:text-gray-400">
									({sourceRef.namespace})
								</span>
							{/if}
						</span>
					</dd>
				</div>
			{/if}

			{#if interval}
				<div>
					<dt class="text-sm font-medium text-gray-500 dark:text-gray-400">Interval</dt>
					<dd class="mt-1 text-sm text-gray-900 dark:text-gray-100">{interval}</dd>
				</div>
			{/if}

			{#if update}
				<div>
					<dt class="text-sm font-medium text-gray-500 dark:text-gray-400">Update Strategy</dt>
					<dd class="mt-1">
						<span
							class="inline-flex items-center rounded-md bg-orange-100 px-2 py-1 text-xs font-medium text-orange-800 dark:bg-orange-900/50 dark:text-orange-300"
						>
							{update.strategy || 'Setters'}
						</span>
						{#if update.path}
							<code
								class="ml-2 rounded bg-gray-100 px-2 py-1 text-xs text-gray-800 dark:bg-gray-700 dark:text-gray-200"
								>{update.path}</code
							>
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

	<!-- Git Configuration -->
	{#if gitSpec}
		<div
			class="rounded-lg border border-gray-200 bg-white p-6 dark:border-gray-700 dark:bg-gray-800"
		>
			<h3 class="mb-4 text-lg font-semibold text-gray-900 dark:text-gray-100">
				Git Configuration
			</h3>
			<dl class="grid gap-4 sm:grid-cols-2">
				{#if gitSpec.checkout?.ref}
					<div>
						<dt class="text-sm font-medium text-gray-500 dark:text-gray-400">Checkout Branch</dt>
						<dd class="mt-1">
							<span
								class="inline-flex items-center gap-1.5 rounded-md bg-purple-100 px-2 py-1 text-xs font-medium text-purple-800 dark:bg-purple-900/50 dark:text-purple-300"
							>
								<svg class="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
									<path
										stroke-linecap="round"
										stroke-linejoin="round"
										stroke-width="2"
										d="M8 9l3 3-3 3m5 0h3M5 20h14a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
									/>
								</svg>
								{gitSpec.checkout.ref.branch || gitSpec.checkout.ref.tag || gitSpec.checkout.ref.commit?.substring(0, 12) || 'default'}
							</span>
						</dd>
					</div>
				{/if}

				{#if gitSpec.push?.branch}
					<div>
						<dt class="text-sm font-medium text-gray-500 dark:text-gray-400">Push Branch</dt>
						<dd class="mt-1">
							<span
								class="inline-flex items-center gap-1.5 rounded-md bg-emerald-100 px-2 py-1 text-xs font-medium text-emerald-800 dark:bg-emerald-900/50 dark:text-emerald-300"
							>
								{gitSpec.push.branch}
							</span>
						</dd>
					</div>
				{/if}

				{#if gitSpec.commit?.author}
					<div>
						<dt class="text-sm font-medium text-gray-500 dark:text-gray-400">Commit Author</dt>
						<dd class="mt-1 text-sm text-gray-900 dark:text-gray-100">
							{gitSpec.commit.author.name || 'Unknown'}
							{#if gitSpec.commit.author.email}
								<span class="text-gray-500 dark:text-gray-400">
									&lt;{gitSpec.commit.author.email}&gt;
								</span>
							{/if}
						</dd>
					</div>
				{/if}

				{#if gitSpec.commit?.signingKey?.secretRef}
					<div>
						<dt class="text-sm font-medium text-gray-500 dark:text-gray-400">Signing Key</dt>
						<dd class="mt-1">
							<span
								class="inline-flex items-center gap-1 rounded-md bg-yellow-100 px-2 py-1 text-xs font-medium text-yellow-800 dark:bg-yellow-900/50 dark:text-yellow-300"
							>
								<svg class="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
									<path
										stroke-linecap="round"
										stroke-linejoin="round"
										stroke-width="2"
										d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z"
									/>
								</svg>
								{gitSpec.commit.signingKey.secretRef.name}
							</span>
						</dd>
					</div>
				{/if}

				{#if gitSpec.commit?.messageTemplate}
					<div class="sm:col-span-2">
						<dt class="text-sm font-medium text-gray-500 dark:text-gray-400">
							Commit Message Template
						</dt>
						<dd class="mt-1">
							<pre
								class="overflow-auto rounded-lg bg-gray-100 p-3 text-xs text-gray-800 dark:bg-gray-900 dark:text-gray-200"><code
									>{gitSpec.commit.messageTemplate}</code
								></pre>
						</dd>
					</div>
				{/if}
			</dl>
		</div>
	{/if}

	<!-- Automation Status -->
	{#if lastAutomationRunTime || lastPushCommit || lastPushTime}
		<div
			class="rounded-lg border border-gray-200 bg-white p-6 dark:border-gray-700 dark:bg-gray-800"
		>
			<h3 class="mb-4 text-lg font-semibold text-gray-900 dark:text-gray-100">
				Automation Status
			</h3>
			<dl class="grid gap-4 sm:grid-cols-2">
				{#if lastPushCommit}
					<div class="sm:col-span-2">
						<dt class="text-sm font-medium text-gray-500 dark:text-gray-400">Last Push Commit</dt>
						<dd class="mt-1 font-mono text-sm text-gray-900 dark:text-gray-100">
							{lastPushCommit}
						</dd>
					</div>
				{/if}

				{#if lastPushTime}
					<div>
						<dt class="text-sm font-medium text-gray-500 dark:text-gray-400">Last Push Time</dt>
						<dd class="mt-1 text-sm text-gray-900 dark:text-gray-100">
							{formatTimestamp(lastPushTime)}
						</dd>
					</div>
				{/if}

				{#if lastAutomationRunTime}
					<div>
						<dt class="text-sm font-medium text-gray-500 dark:text-gray-400">
							Last Automation Run
						</dt>
						<dd class="mt-1 text-sm text-gray-900 dark:text-gray-100">
							{formatTimestamp(lastAutomationRunTime)}
						</dd>
					</div>
				{/if}
			</dl>
		</div>
	{/if}
</div>
