<script lang="ts">
	import Button from '$lib/components/ui/button/button.svelte';
	import { goto } from '$app/navigation';
	import { ChevronLeft, ChevronRight } from 'lucide-svelte';

	interface Props {
		total: number;
		limit: number;
		offset: number;
		onPageChange?: (offset: number) => void;
	}

	let { total, limit, offset, onPageChange }: Props = $props();

	const currentPage = $derived(Math.floor(offset / limit) + 1);
	const totalPages = $derived(Math.ceil(total / limit));
	const hasNext = $derived(offset + limit < total);
	const hasPrev = $derived(offset > 0);

	function goToPage(page: number) {
		const newOffset = (page - 1) * limit;
		if (onPageChange) {
			onPageChange(newOffset);
		}
	}

	function nextPage() {
		if (hasNext) {
			goToPage(currentPage + 1);
		}
	}

	function prevPage() {
		if (hasPrev) {
			goToPage(currentPage - 1);
		}
	}
</script>

{#if totalPages > 1}
	<div class="flex items-center justify-between border-t border-slate-700/50 px-4 py-3">
		<div class="flex items-center gap-2">
			<span class="text-sm text-slate-400">
				Showing {offset + 1} to {Math.min(offset + limit, total)} of {total}
			</span>
		</div>

		<div class="flex items-center gap-2">
			<Button
				variant="ghost"
				size="sm"
				onclick={prevPage}
				disabled={!hasPrev}
				aria-label="Previous page"
			>
				<ChevronLeft size={16} />
			</Button>

			<span class="text-sm text-slate-300">
				Page {currentPage} of {totalPages}
			</span>

			<Button variant="ghost" size="sm" onclick={nextPage} disabled={!hasNext} aria-label="Next page">
				<ChevronRight size={16} />
			</Button>
		</div>
	</div>
{/if}
