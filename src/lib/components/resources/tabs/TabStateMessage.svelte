<script lang="ts">
	interface Props {
		title: string;
		message: string;
		onRetry?: () => void;
	}

	let { title, message, onRetry }: Props = $props();
</script>

<div
	class="rounded-lg border border-red-200 bg-red-50 p-6 text-center dark:border-red-900/50 dark:bg-red-900/20"
	role="alert"
	aria-live="assertive"
>
	<svg
		class="mx-auto h-12 w-12 text-red-400"
		fill="none"
		stroke="currentColor"
		viewBox="0 0 24 24"
		aria-hidden="true"
	>
		<path
			stroke-linecap="round"
			stroke-linejoin="round"
			stroke-width="2"
			d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
		/>
	</svg>
	<h3 class="mt-2 text-sm font-medium text-red-800 dark:text-red-300">{title}</h3>
	<p class="mt-1 text-sm text-red-600 dark:text-red-400">{message}</p>
	{#if onRetry}
		<div class="mt-4">
			<button
				type="button"
				class="inline-flex items-center gap-1.5 rounded-md bg-red-100 px-3 py-2 text-sm font-medium text-red-800 hover:bg-red-200 dark:bg-red-900 dark:text-red-100 dark:hover:bg-red-800"
				onclick={onRetry}
			>
				<svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
					<path
						stroke-linecap="round"
						stroke-linejoin="round"
						stroke-width="2"
						d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
					/>
				</svg>
				Try Again
			</button>
		</div>
	{/if}
</div>
