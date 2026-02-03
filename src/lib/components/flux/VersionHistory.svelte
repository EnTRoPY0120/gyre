<script lang="ts">
	import { cn } from '$lib/utils';
	import { formatDistanceToNow } from 'date-fns';

	interface ResourceRevision {
		revision: string;
		timestamp: string;
		status: string;
		message?: string;
	}

	let {
		history = [],
		loading = false,
		onRollback
	}: {
		history: ResourceRevision[];
		loading?: boolean;
		onRollback?: (revision: string) => void;
	} = $props();

	function getStatusClass(status: string) {
		switch (status.toLowerCase()) {
			case 'deployed':
			case 'superseded':
				return 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400';
			case 'failed':
				return 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400';
			default:
				return 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-400';
		}
	}
</script>

<div class="space-y-4">
	{#if loading}
		<div class="flex justify-center py-8">
			<div
				class="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent"
			></div>
		</div>
	{:else if history.length === 0}
		<div class="py-8 text-center text-muted-foreground">No history found for this resource.</div>
	{:else}
		<div class="relative overflow-x-auto rounded-lg border border-sidebar-border shadow-sm">
			<table class="w-full text-left text-sm">
				<thead class="bg-sidebar-accent/30 text-xs font-bold text-muted-foreground uppercase">
					<tr>
						<th class="px-6 py-3">Version</th>
						<th class="px-6 py-3">Created</th>
						<th class="px-6 py-3">Status</th>
						<th class="px-6 py-3 text-right">Actions</th>
					</tr>
				</thead>
				<tbody class="divide-y divide-sidebar-border bg-sidebar/50">
					{#each history as rev, i}
						<tr class="transition-colors hover:bg-sidebar-accent/10">
							<td class="px-6 py-4">
								<span class="font-mono font-bold">v{rev.revision}</span>
								{#if i === 0}
									<span
										class="ml-2 rounded-full bg-blue-100 px-2 py-0.5 text-[10px] font-bold text-blue-700 dark:bg-blue-900/40 dark:text-blue-300"
										>current</span
									>
								{/if}
							</td>
							<td class="px-6 py-4 text-muted-foreground">
								{rev.timestamp ? formatDistanceToNow(new Date(rev.timestamp), { addSuffix: true }) : 'unknown'}
							</td>
							<td class="px-6 py-4">
								<span
									class={cn(
										'inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium',
										getStatusClass(rev.status)
									)}
								>
									{rev.status}
								</span>
							</td>
							<td class="px-6 py-4 text-right">
								{#if i > 0 && onRollback}
									<button
										onclick={() => onRollback(rev.revision)}
										class="text-xs font-bold text-primary transition-colors hover:text-primary/70"
									>
										Rollback to this version
									</button>
								{:else if i === 0}
									<span class="text-xs text-muted-foreground/50">Current version</span>
								{/if}
							</td>
						</tr>
					{/each}
				</tbody>
			</table>
		</div>
	{/if}
</div>
