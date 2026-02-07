<script lang="ts">
	import type { FluxResource } from '$lib/types/flux';
	import { formatTimestamp } from '$lib/utils/flux';
	import StatusBadge from './StatusBadge.svelte';
	import { PackageX, ChevronLeft, ChevronRight } from 'lucide-svelte';

	interface Props {
		resources: FluxResource[];
		showNamespace?: boolean;
		onRowClick?: (resource: FluxResource) => void;
	}

	let { resources, showNamespace = true, onRowClick }: Props = $props();

	// Pagination state
	let currentPage = $state(1);
	let itemsPerPage = 10;

	const totalPages = $derived(Math.ceil(resources.length / itemsPerPage));
	const paginatedResources = $derived(
		resources.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage)
	);

	function handleRowClick(resource: FluxResource) {
		if (onRowClick) {
			onRowClick(resource);
		}
	}

	function getReadyMessage(resource: FluxResource): string {
		const ready = resource.status?.conditions?.find((c) => c.type === 'Ready');
		return ready?.message || '-';
	}

	// Reset page when resources change
	$effect(() => {
		if (currentPage > totalPages && totalPages > 0) {
			currentPage = totalPages;
		}
	});
</script>

<div class="flex flex-col gap-4">
	<div
		class="overflow-hidden rounded-xl border border-border bg-card/60 shadow-sm backdrop-blur-sm"
	>
		<div class="scrollbar-thin overflow-x-auto">
			<table class="w-full min-w-[700px] text-left text-sm">
				<thead class="border-b border-border bg-muted/30">
					<tr>
						<th
							class="px-6 py-4 font-display text-[10px] font-black tracking-[0.2em] text-muted-foreground/80 uppercase"
						>
							Resource
						</th>
						{#if showNamespace}
							<th
								class="px-6 py-4 font-display text-[10px] font-black tracking-[0.2em] text-muted-foreground/80 uppercase"
							>
								Namespace
							</th>
						{/if}
						<th
							class="px-6 py-4 font-display text-[10px] font-black tracking-[0.2em] text-muted-foreground/80 uppercase"
						>
							Status
						</th>
						<th
							class="px-6 py-4 font-display text-[10px] font-black tracking-[0.2em] text-muted-foreground/80 uppercase"
						>
							Age
						</th>
						<th
							class="px-6 py-4 font-display text-[10px] font-black tracking-[0.2em] text-muted-foreground/80 uppercase"
						>
							Message
						</th>
					</tr>
				</thead>
				<tbody class="divide-y divide-border/40">
					{#if resources.length === 0}
						<tr>
							<td
								colspan={showNamespace ? 5 : 4}
								class="px-6 py-12 text-center text-sm text-muted-foreground"
							>
								<div class="flex flex-col items-center gap-3">
									<PackageX size={40} class="text-muted-foreground/40" />
									<p class="font-medium">No resources found</p>
									<p class="text-xs text-muted-foreground/60">
										Try adjusting your filters or checking connection.
									</p>
								</div>
							</td>
						</tr>
					{:else}
						{#each paginatedResources as resource (resource.metadata.uid)}
							<tr
								class="group cursor-pointer transition-colors hover:bg-accent/40 hover:text-accent-foreground"
								onclick={() => handleRowClick(resource)}
							>
								<td
									class="px-6 py-4 whitespace-nowrap transition-all duration-200 group-hover:pl-7"
								>
									<div
										class="font-mono text-[13px] font-medium text-foreground transition-colors group-hover:text-primary"
									>
										{resource.metadata.name}
									</div>
								</td>
								{#if showNamespace}
									<td class="px-6 py-4 whitespace-nowrap">
										<div
											class="inline-flex items-center rounded-md border border-transparent bg-secondary/40 px-2 py-1 text-[11px] font-medium text-muted-foreground transition-all group-hover:border-border/50"
										>
											{resource.metadata.namespace || '-'}
										</div>
									</td>
								{/if}
								<td class="px-6 py-4 whitespace-nowrap">
									<StatusBadge
										conditions={resource.status?.conditions}
										suspended={resource.spec?.suspend as boolean | undefined}
										size="sm"
									/>
								</td>
								<td class="px-6 py-4 whitespace-nowrap">
									<div class="font-mono text-xs font-medium text-muted-foreground">
										{formatTimestamp(resource.metadata.creationTimestamp)}
									</div>
								</td>
								<td class="max-w-[300px] px-6 py-4">
									<div
										class="truncate text-xs text-muted-foreground/80 group-hover:text-muted-foreground"
									>
										{getReadyMessage(resource)}
									</div>
								</td>
							</tr>
						{/each}
					{/if}
				</tbody>
			</table>
		</div>
	</div>

	{#if totalPages > 1}
		<div class="flex items-center justify-between px-2">
			<div class="text-xs text-muted-foreground">
				Showing <span class="font-medium">{(currentPage - 1) * itemsPerPage + 1}</span> to
				<span class="font-medium">{Math.min(currentPage * itemsPerPage, resources.length)}</span>
				of <span class="font-medium">{resources.length}</span> results
			</div>
			<div class="flex items-center gap-2">
				<button
					class="flex size-8 items-center justify-center rounded-md border border-border bg-card/60 text-muted-foreground transition-all hover:bg-accent disabled:opacity-30"
					onclick={() => (currentPage = Math.max(1, currentPage - 1))}
					disabled={currentPage === 1}
					aria-label="Previous page"
				>
					<ChevronLeft size={16} />
				</button>
				<div class="text-xs font-medium">
					Page {currentPage} of {totalPages}
				</div>
				<button
					class="flex size-8 items-center justify-center rounded-md border border-border bg-card/60 text-muted-foreground transition-all hover:bg-accent disabled:opacity-30"
					onclick={() => (currentPage = Math.min(totalPages, currentPage + 1))}
					disabled={currentPage === totalPages}
					aria-label="Next page"
				>
					<ChevronRight size={16} />
				</button>
			</div>
		</div>
	{/if}
</div>
