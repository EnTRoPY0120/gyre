<script lang="ts">
	const isMacPlatform =
		typeof navigator !== 'undefined' &&
		((navigator as any).userAgentData?.platform ?? navigator.platform)?.toLowerCase().includes('mac');
</script>

<div class="flex items-center justify-between border-t border-zinc-800 px-3 py-2 text-xs text-zinc-500">
	<div class="flex items-center gap-4">
		<div class="flex items-center gap-1.5">
			<kbd class="flex h-5 items-center gap-1 rounded border border-zinc-700 bg-zinc-800 px-1.5 font-mono text-[10px] font-medium">↑↓</kbd>
			<span>Navigate</span>
		</div>
		<div class="flex items-center gap-1.5">
			<kbd class="flex h-5 items-center gap-1 rounded border border-zinc-700 bg-zinc-800 px-1.5 font-mono text-[10px] font-medium">↵</kbd>
			<span>Select</span>
		</div>
		<div class="flex items-center gap-1.5">
			<kbd class="flex h-5 items-center gap-1 rounded border border-zinc-700 bg-zinc-800 px-1.5 font-mono text-[10px] font-medium">ESC</kbd>
			<span>Close</span>
		</div>
	</div>
	<div class="flex items-center gap-1.5">
		<span>Press</span>
		<kbd class="flex h-5 items-center gap-1 rounded border border-zinc-700 bg-zinc-800 px-1.5 font-mono text-[10px] font-medium">
			{#if isMacPlatform}⌘K{:else}Ctrl+K{/if}
		</kbd>
		<span>anytime</span>
	</div>
</div>
