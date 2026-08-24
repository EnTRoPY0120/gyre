<script lang="ts">
	import { RefreshCw } from '@lucide/svelte';
import type { BatchAction } from './bulk-actions';

	let { currentOperation }: { currentOperation: BatchAction | null } = $props();
</script>

<div class="fixed inset-0 z-40 flex items-center justify-center bg-background/50 backdrop-blur-sm">
	<div class="rounded-lg border border-border bg-card p-6 shadow-xl">
		<div class="flex items-center gap-3">
			<RefreshCw size={20} class="animate-spin text-primary" />
			<p class="text-sm font-medium">Processing {currentOperation} operation...</p>
		</div>
	</div>
</div>
