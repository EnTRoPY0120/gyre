<script lang="ts">
	import type { K8sCondition } from '$lib/types/flux';
	import { formatTimestamp } from '$lib/utils/flux';

	interface Props {
		conditions: K8sCondition[];
	}

	let { conditions }: Props = $props();
</script>

<div class="space-y-3">
	{#if conditions.length === 0}
		<p class="text-sm text-gray-500 dark:text-gray-400">No conditions available</p>
	{:else}
		{#each conditions as condition}
			<div class="rounded-lg border border-gray-200 bg-gray-50 p-4 dark:border-gray-600 dark:bg-gray-700/50">
				<div class="flex items-start justify-between">
					<div class="flex-1">
						<div class="flex items-center gap-2">
							<h4 class="text-sm font-semibold text-gray-900 dark:text-gray-100">{condition.type}</h4>
							<span
								class="inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium {condition.status === 'True'
									? 'bg-green-100 text-green-800 dark:bg-green-900/50 dark:text-green-300'
									: condition.status === 'False'
										? 'bg-red-100 text-red-800 dark:bg-red-900/50 dark:text-red-300'
										: 'bg-gray-100 text-gray-800 dark:bg-gray-600 dark:text-gray-300'}"
							>
								{condition.status}
							</span>
						</div>

						{#if condition.message}
							<p class="mt-1 text-sm text-gray-600 dark:text-gray-300">{condition.message}</p>
						{/if}

						<div class="mt-2 flex gap-4 text-xs text-gray-500 dark:text-gray-400">
							{#if condition.reason}
								<span>
									<span class="font-medium">Reason:</span>
									{condition.reason}
								</span>
							{/if}
							{#if condition.lastTransitionTime}
								<span>
									<span class="font-medium">Last Transition:</span>
									{formatTimestamp(condition.lastTransitionTime)}
								</span>
							{/if}
						</div>
					</div>
				</div>
			</div>
		{/each}
	{/if}
</div>
