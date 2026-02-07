<script lang="ts">
	import { cn } from '$lib/utils';
	import { Copy, Check } from 'lucide-svelte';
	import { Button } from '$lib/components/ui/button';
	import MonacoEditor from './MonacoEditor.svelte';

	let {
		value = $bindable(''),
		label,
		error,
		readonly = false,
		className,
		onCopy,
		copySuccess = false
	}: {
		value: string;
		label?: string;
		error?: string | null;
		readonly?: boolean;
		className?: string;
		onCopy?: () => void;
		copySuccess?: boolean;
	} = $props();

	// Handle value changes from Monaco
	function handleChange(newValue: string) {
		value = newValue;
	}
</script>

<div class={cn('flex h-full flex-col gap-1.5', className)}>
	{#if label}
		<label for="yaml-editor" class="text-sm font-medium text-foreground">{label}</label>
	{/if}

	<div
		class="group relative flex-1 overflow-hidden rounded-xl border border-zinc-800 bg-zinc-950 transition-all focus-within:border-zinc-700"
	>
		<!-- Copy button positioned inside the editor -->
		{#if onCopy}
			<div
				class="absolute top-3 right-3 z-10 opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100"
			>
				<Button
					variant="secondary"
					size="sm"
					onclick={onCopy}
					class="h-7 gap-1.5 border border-zinc-700 bg-zinc-800/80 px-2.5 text-[11px] font-medium text-zinc-200 backdrop-blur-sm hover:bg-zinc-700 hover:text-white"
				>
					{#if copySuccess}
						<Check size={12} class="text-green-400" />
						<span>Copied</span>
					{:else}
						<Copy size={12} />
						<span>Copy YAML</span>
					{/if}
				</Button>
			</div>
		{/if}

		<!-- Monaco Editor -->
		<MonacoEditor
			bind:value
			language="yaml"
			{readonly}
			height="100%"
			lineNumbers="on"
			minimap={false}
			onChange={handleChange}
			className="h-full"
		/>
	</div>

	{#if error}
		<div
			class="animate-in fade-in slide-in-from-top-1 mt-2 flex flex-col gap-2 rounded-lg border border-red-500/20 bg-red-500/5 p-3 text-xs duration-200"
		>
			<div class="flex items-center gap-2 font-semibold text-red-400">
				<div class="flex size-4 items-center justify-center rounded-full bg-red-500/20 text-[10px]">
					!
				</div>
				<span>Syntax Error</span>
			</div>
			<pre class="overflow-x-auto font-mono leading-relaxed text-red-300/90">{error.replace(
					'YAML Syntax Error: ',
					''
				)}</pre>
		</div>
	{/if}
</div>
