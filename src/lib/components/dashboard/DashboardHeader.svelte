<script lang="ts">
	interface Props {
		isLoading: boolean;
	}

	let { isLoading }: Props = $props();
</script>

<!-- Welcome Header -->
<div class="flex flex-col justify-between gap-6 lg:flex-row lg:items-center">
	<div>
		<h1 class="text-2xl font-bold tracking-tight text-foreground md:text-3xl">Welcome to Gyre</h1>
		<p class="mt-2 text-base text-muted-foreground md:text-lg">
			Monitor and manage your FluxCD resources
		</p>
	</div>
	<div
		class="flex items-center gap-3 self-start rounded-full border border-sidebar-border bg-sidebar px-5 py-2.5 shadow-sm backdrop-blur-md"
	>
		{#if isLoading}
			<div
				class="size-2.5 animate-spin rounded-full border border-green-500 border-t-transparent"
			></div>
			<span class="text-xs leading-none font-black tracking-[0.2em] text-muted-foreground uppercase"
				>Initializing...</span
			>
		{:else}
			<div
				class="size-2.5 animate-pulse rounded-full bg-green-500 shadow-[0_0_10px_rgba(34,197,94,0.6)]"
			></div>
			<span class="text-xs leading-none font-black tracking-[0.2em] text-muted-foreground uppercase"
				>Cluster Live</span
			>
		{/if}
	</div>
</div>
