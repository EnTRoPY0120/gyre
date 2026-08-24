<script lang="ts">
	let { status }: { status: 'connected' | 'connecting' | 'disconnected' | 'error' } = $props();
</script>

<div class="flex items-center justify-between border-t border-gray-200 px-4 py-2 dark:border-gray-700">
	<div class="flex items-center gap-2">
		<span
			class="h-2 w-2 rounded-full {status === 'connected'
				? 'bg-green-400'
				: status === 'connecting'
					? 'animate-pulse bg-yellow-400'
					: status === 'error'
						? 'bg-red-400'
						: 'bg-gray-400'}"
		></span>
		<span class="text-xs text-gray-500 dark:text-gray-400">
			{status === 'connected'
				? 'Live updates active'
				: status === 'connecting'
					? 'Connecting...'
					: status === 'error'
						? 'Connection error'
						: 'Disconnected'}
		</span>
	</div>
</div>
