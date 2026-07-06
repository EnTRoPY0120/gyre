<script lang="ts">
	import { onMount } from 'svelte';
	import type { Snippet } from 'svelte';

	interface Props {
		title: string;
		titleId: string;
		onClose: () => void;
		children: Snippet;
	}

	let { title, titleId, onClose, children }: Props = $props();
	let dialogElement: HTMLDivElement;

	onMount(() => {
		dialogElement.focus();
	});
</script>

<div
	bind:this={dialogElement}
	class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-0 sm:p-4"
	role="dialog"
	aria-modal="true"
	aria-labelledby={titleId}
	tabindex="-1"
	onclick={(e) => e.target === e.currentTarget && onClose()}
	onkeydown={(e) => e.key === 'Escape' && onClose()}
>
	<div
		class="h-full w-full overflow-y-auto border border-red-500/30 bg-slate-800 p-6 shadow-2xl sm:h-auto sm:max-w-md sm:rounded-xl"
	>
		<div class="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-red-500/20">
			<svg class="h-6 w-6 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
				<path
					stroke-linecap="round"
					stroke-linejoin="round"
					stroke-width="2"
					d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
				/>
			</svg>
		</div>
		<h2 id={titleId} class="mb-2 text-xl font-bold text-white">{title}</h2>
		{@render children()}
	</div>
</div>
