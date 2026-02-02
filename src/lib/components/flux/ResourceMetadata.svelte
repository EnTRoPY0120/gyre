<script lang="ts">
	import type { K8sMetadata } from '$lib/types/flux';
	import { formatTimestamp } from '$lib/utils/flux';

	interface Props {
		metadata: K8sMetadata;
		showNamespace?: boolean;
	}

	let { metadata, showNamespace = true }: Props = $props();

	const age = $derived(formatTimestamp(metadata.creationTimestamp));
</script>

<div class="space-y-2">
	<div class="grid grid-cols-2 gap-4">
		<div>
			<dt class="text-sm font-medium text-gray-500 dark:text-gray-400">Name</dt>
			<dd class="mt-1 text-sm text-gray-900 dark:text-gray-100">{metadata.name}</dd>
		</div>

		{#if showNamespace && metadata.namespace}
			<div>
				<dt class="text-sm font-medium text-gray-500 dark:text-gray-400">Namespace</dt>
				<dd class="mt-1 text-sm text-gray-900 dark:text-gray-100">{metadata.namespace}</dd>
			</div>
		{/if}

		<div>
			<dt class="text-sm font-medium text-gray-500 dark:text-gray-400">Age</dt>
			<dd class="mt-1 text-sm text-gray-900 dark:text-gray-100">{age}</dd>
		</div>

		{#if metadata.uid}
			<div>
				<dt class="text-sm font-medium text-gray-500 dark:text-gray-400">UID</dt>
				<dd class="mt-1 font-mono text-sm text-gray-900 dark:text-gray-100">{metadata.uid}</dd>
			</div>
		{/if}
	</div>

	{#if metadata.labels && Object.keys(metadata.labels).length > 0}
		<div class="mt-4">
			<dt class="text-sm font-medium text-gray-500 dark:text-gray-400">Labels</dt>
			<dd class="mt-2 flex flex-wrap gap-2">
				{#each Object.entries(metadata.labels) as [key, value]}
					<span
						class="inline-flex items-center rounded-md bg-gray-100 px-2 py-1 text-xs font-medium text-gray-800 dark:bg-gray-700 dark:text-gray-200"
					>
						{key}={value}
					</span>
				{/each}
			</dd>
		</div>
	{/if}

	{#if metadata.annotations && Object.keys(metadata.annotations).length > 0}
		<div class="mt-4">
			<dt class="text-sm font-medium text-gray-500 dark:text-gray-400">Annotations</dt>
			<dd class="mt-2 space-y-1">
				{#each Object.entries(metadata.annotations) as [key, value]}
					<div class="text-xs">
						<span class="font-medium text-gray-700 dark:text-gray-300">{key}:</span>
						<span class="text-gray-600 dark:text-gray-400">{value}</span>
					</div>
				{/each}
			</dd>
		</div>
	{/if}
</div>
