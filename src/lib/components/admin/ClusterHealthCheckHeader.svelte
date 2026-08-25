<script lang="ts">
	let {
		clusterName,
		connected,
		onClose
	}: {
		clusterName: string;
		connected: boolean;
		onClose: () => void;
	} = $props();
</script>

<div class="mb-4 flex items-center justify-between">
	<div class="flex items-center gap-3">
		<div
			class="flex h-12 w-12 items-center justify-center rounded-full {connected ? 'bg-emerald-500/20' : 'bg-red-500/20'}"
		>
			{#if connected}
				<svg class="h-6 w-6 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
					<path
						stroke-linecap="round"
						stroke-linejoin="round"
						stroke-width="2"
						d="M5 13l4 4L19 7"
					/>
				</svg>
			{:else}
				<svg class="h-6 w-6 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
					<path
						stroke-linecap="round"
						stroke-linejoin="round"
						stroke-width="2"
						d="M6 18L18 6M6 6l12 12"
					/>
				</svg>
			{/if}
		</div>
		<div>
			<h2 class="text-xl font-bold text-white">Connection Diagnostics</h2>
			<p class="text-sm text-slate-400">{clusterName}</p>
		</div>
	</div>
	<button onclick={onClose} class="text-slate-400 hover:text-white" aria-label="Close">
		<svg class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
			<path
				stroke-linecap="round"
				stroke-linejoin="round"
				stroke-width="2"
				d="M6 18L18 6M6 6l12 12"
			/>
		</svg>
	</button>
</div>
