<script lang="ts">
	import { page } from '$app/stores';

	const status = $derived($page.status);
	const message = $derived($page.error?.message || 'An unexpected error occurred');

	const is404 = $derived(status === 404);
</script>

<div class="flex min-h-[60vh] flex-col items-center justify-center text-center">
	<!-- Error Icon -->
	<div
		class="mb-6 flex h-24 w-24 items-center justify-center rounded-full {is404
			? 'bg-blue-100'
			: 'bg-red-100'}"
	>
		{#if is404}
			<svg class="h-12 w-12 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
				<path
					stroke-linecap="round"
					stroke-linejoin="round"
					stroke-width="2"
					d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
				/>
			</svg>
		{:else}
			<svg class="h-12 w-12 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
				<path
					stroke-linecap="round"
					stroke-linejoin="round"
					stroke-width="2"
					d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
				/>
			</svg>
		{/if}
	</div>

	<!-- Error Status -->
	<h1 class="mb-2 text-6xl font-bold {is404 ? 'text-blue-600' : 'text-red-600'}">
		{status}
	</h1>

	<!-- Error Title -->
	<h2 class="mb-4 text-2xl font-semibold text-gray-900">
		{#if is404}
			Page Not Found
		{:else if status === 500}
			Internal Server Error
		{:else if status === 503}
			Service Unavailable
		{:else}
			Something Went Wrong
		{/if}
	</h2>

	<!-- Error Message -->
	<p class="mb-8 max-w-md text-gray-600">
		{#if is404}
			The page you're looking for doesn't exist or has been moved.
		{:else}
			{message}
		{/if}
	</p>

	<!-- Action Buttons -->
	<div class="flex gap-4">
		<button
			type="button"
			class="inline-flex items-center gap-2 rounded-lg bg-gray-100 px-5 py-2.5 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-200"
			onclick={() => window.history.back()}
		>
			<svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
				<path
					stroke-linecap="round"
					stroke-linejoin="round"
					stroke-width="2"
					d="M10 19l-7-7m0 0l7-7m-7 7h18"
				/>
			</svg>
			Go Back
		</button>
		<a
			href="/"
			rel="external"
			class="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-blue-700"
		>
			<svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
				<path
					stroke-linecap="round"
					stroke-linejoin="round"
					stroke-width="2"
					d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"
				/>
			</svg>
			Go to Dashboard
		</a>
	</div>

	<!-- Technical Details (for non-404 errors) -->
	{#if !is404 && message}
		<div class="mt-8 rounded-lg border border-gray-200 bg-gray-50 p-4">
			<p class="text-xs font-medium text-gray-500 uppercase">Technical Details</p>
			<p class="mt-1 font-mono text-sm text-gray-600">{message}</p>
		</div>
	{/if}
</div>
