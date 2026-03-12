<script lang="ts">
	import type { K8sCondition } from '$lib/types/flux';
	import { formatTimestamp } from '$lib/utils/flux';

	interface Props {
		conditions: K8sCondition[];
	}

	let { conditions }: Props = $props();
</script>

<div>
	{#if conditions.length === 0}
		<p class="text-sm text-gray-500 dark:text-gray-400 py-2">No conditions available</p>
	{:else}
		<div class="divide-y divide-gray-100 dark:divide-gray-700/50">
			{#each conditions as condition (condition.type)}
				<div class="py-3 first:pt-0 last:pb-0">
					<div class="flex items-start justify-between">
						<div class="flex-1">
							<div class="flex items-center gap-2">
								<h4 class="text-sm font-semibold text-gray-900 dark:text-gray-100">
									{condition.type}
								</h4>
								<span
									class="inline-flex items-center rounded-md px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider {condition.status ===
									'True'
										? 'bg-green-100 text-green-800 dark:bg-green-900/50 dark:text-green-300'
										: condition.status === 'False'
											? 'bg-red-100 text-red-800 dark:bg-red-900/50 dark:text-red-300'
											: 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300'}"
								>
									{condition.status}
								</span>
							</div>

							{#if condition.message}
								<p class="mt-1 text-sm text-gray-600 dark:text-gray-300">{condition.message}</p>
							{/if}

							<div class="mt-1.5 flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-500 dark:text-gray-400">
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
		</div>
	{/if}
</div>
