<script lang="ts">
	let {
		value = $bindable(''),
		readonly,
		loading,
		showFallback,
		error,
		language,
		onChange
	}: {
		value: string;
		readonly: boolean;
		loading: boolean;
		showFallback: boolean;
		error: string | null;
		language: 'yaml' | 'json';
		onChange?: (value: string) => void;
	} = $props();

	function handleTextareaChange(e: Event) {
		const target = e.target as HTMLTextAreaElement;
		value = target.value;
		onChange?.(target.value);
	}
</script>

<div class="h-full w-full" class:hidden={!loading && !showFallback}>
	<textarea
		bind:value
		oninput={handleTextareaChange}
		{readonly}
		spellcheck="false"
		class="h-full w-full resize-none rounded-lg border border-zinc-800 bg-zinc-950 p-4 font-mono text-sm text-zinc-300 transition-all focus:border-amber-500/50 focus:ring-1 focus:ring-amber-500/20 focus:outline-none"
		placeholder="Enter {language.toUpperCase()} content..."
	></textarea>

	{#if loading}
		<div
			class="absolute inset-0 flex items-center justify-center rounded-lg bg-zinc-950/50 backdrop-blur-[2px]"
		>
			<div class="flex flex-col items-center gap-3">
				<div class="h-8 w-8 animate-spin rounded-full border-2 border-zinc-800 border-t-amber-500"></div>
				<p class="text-xs font-medium tracking-widest text-zinc-500 uppercase">Initialising Editor</p>
			</div>
		</div>
	{:else if error}
		<div
			class="absolute top-2 right-2 flex items-center gap-2 rounded border border-red-500/20 bg-red-500/10 px-2 py-1 text-[10px] font-medium text-red-400"
		>
			<span>Basic Mode</span>
			<span class="opacity-50">|</span>
			<span>{error}</span>
		</div>
	{/if}
</div>
