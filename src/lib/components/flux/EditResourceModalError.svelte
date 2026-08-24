<script lang="ts">
	import { AlertTriangle } from '@lucide/svelte';

	let { error }: { error: string } = $props();
</script>

<div class="px-6 pb-4">
	<div
		class="animate-in fade-in slide-in-from-top-1 flex flex-col gap-2 rounded-lg border border-red-500/20 bg-red-500/5 p-3 text-xs duration-200"
	>
		<div class="flex items-center gap-2 font-semibold text-red-400">
			<AlertTriangle size={14} />
			<span>Validation Error</span>
		</div>
		<pre class="overflow-x-auto font-mono leading-relaxed whitespace-pre-wrap text-red-300/90">{error}</pre>
	</div>
</div>
