<script lang="ts">
	import { cn } from '$lib/utils';
	import { Copy, Check } from 'lucide-svelte';
	import { Button } from '$lib/components/ui/button';

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

	function handleKeyDown(e: KeyboardEvent) {
		if (e.key === 'Tab') {
			e.preventDefault();
			const textarea = e.target as HTMLTextAreaElement;
			const start = textarea.selectionStart;
			const end = textarea.selectionEnd;

			// Set textarea value to: text before caret + tab + text after caret
			value = value.substring(0, start) + '  ' + value.substring(end);

			// Put caret at right position again
			setTimeout(() => {
				textarea.selectionStart = textarea.selectionEnd = start + 2;
			}, 0);
		}
	}
</script>

<div class={cn('flex h-full flex-col gap-1.5', className)}>
	{#if label}
		<label for="yaml-editor" class="text-sm font-medium text-foreground">{label}</label>
	{/if}

	<div class="relative flex-1 overflow-hidden rounded-lg border border-border bg-zinc-950">
		<!-- Copy button positioned inside the editor -->
		{#if onCopy}
			<div class="absolute top-3 right-3 z-10">
				<Button
					variant="secondary"
					size="sm"
					onclick={onCopy}
					class="h-8 gap-1.5 bg-zinc-800/90 px-3 text-xs text-zinc-100 hover:bg-zinc-700"
				>
					{#if copySuccess}
						<Check size={14} class="text-green-400" />
						<span>Copied!</span>
					{:else}
						<Copy size={14} />
						<span>Copy YAML</span>
					{/if}
				</Button>
			</div>
		{/if}

		<textarea
			id="yaml-editor"
			bind:value
			onkeydown={handleKeyDown}
			{readonly}
			spellcheck="false"
			class={cn(
				'h-full w-full resize-none bg-transparent p-4 pr-32 font-mono text-sm text-zinc-100 outline-none placeholder:text-zinc-500',
				'scrollbar-thin scrollbar-track-zinc-900 scrollbar-thumb-zinc-700 overflow-y-scroll',
				error && 'border-red-500/50 focus:border-red-500 focus:ring-red-500/20',
				readonly && 'cursor-not-allowed opacity-70'
			)}
			placeholder="# Enter YAML here..."
		></textarea>

		{#if error}
			<p class="absolute bottom-3 left-3 mt-1 text-xs text-red-500">{error}</p>
		{/if}
	</div>
</div>

<style>
	/* Always show scrollbar but make it inactive when not needed */
	textarea::-webkit-scrollbar {
		width: 10px;
	}

	textarea::-webkit-scrollbar-track {
		background: transparent;
	}

	textarea::-webkit-scrollbar-thumb {
		background: #3f3f46;
		border-radius: 5px;
		border: 2px solid #09090b;
	}

	textarea::-webkit-scrollbar-thumb:hover {
		background: #52525b;
	}

	/* Firefox scrollbar */
	textarea {
		scrollbar-width: thin;
		scrollbar-color: #3f3f46 transparent;
	}
</style>
