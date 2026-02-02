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
			<dt class="text-sm font-medium text-gray-500">Name</dt>
			<dd class="mt-1 text-sm text-gray-900">{metadata.name}</dd>
		</div>

		{#if showNamespace && metadata.namespace}
			<div>
				<dt class="text-sm font-medium text-gray-500">Namespace</dt>
				<dd class="mt-1 text-sm text-gray-900">{metadata.namespace}</dd>
			</div>
		{/if}

		<div>
			<dt class="text-sm font-medium text-gray-500">Age</dt>
			<dd class="mt-1 text-sm text-gray-900">{age}</dd>
		</div>

		{#if metadata.uid}
			<div>
				<dt class="text-sm font-medium text-gray-500">UID</dt>
				<dd class="mt-1 text-sm font-mono text-gray-900">{metadata.uid}</dd>
			</div>
		{/if}
	</div>

	{#if metadata.labels && Object.keys(metadata.labels).length > 0}
		<div class="mt-4">
			<dt class="text-sm font-medium text-gray-500">Labels</dt>
			<dd class="mt-2 flex flex-wrap gap-2">
				{#each Object.entries(metadata.labels) as [key, value]}
					<span class="inline-flex items-center rounded-md bg-gray-100 px-2 py-1 text-xs font-medium text-gray-800">
						{key}={value}
					</span>
				{/each}
			</dd>
		</div>
	{/if}

	{#if metadata.annotations && Object.keys(metadata.annotations).length > 0}
		<div class="mt-4">
			<dt class="text-sm font-medium text-gray-500">Annotations</dt>
			<dd class="mt-2 space-y-1">
				{#each Object.entries(metadata.annotations) as [key, value]}
					<div class="text-xs">
						<span class="font-medium text-gray-700">{key}:</span>
						<span class="text-gray-600">{value}</span>
					</div>
				{/each}
			</dd>
		</div>
	{/if}
</div>
