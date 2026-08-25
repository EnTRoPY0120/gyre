<script lang="ts">
	import type { OCIRepositoryRef } from './oci-repository-detail-types';

	let {
		url,
		insecure,
		ref,
		provider
	}: {
		url: string | undefined;
		insecure: boolean | undefined;
		ref: OCIRepositoryRef | undefined;
		provider: string | undefined;
	} = $props();
</script>

{#if url}
	<div class="sm:col-span-2">
		<dt class="text-sm font-medium text-gray-500 dark:text-gray-400">OCI Registry URL</dt>
		<dd class="mt-1">
			<span
				class="inline-flex items-center gap-1.5 font-mono text-sm text-gray-900 dark:text-gray-100"
			>
				<svg class="h-4 w-4 text-indigo-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
					<path
						stroke-linecap="round"
						stroke-linejoin="round"
						stroke-width="2"
						d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"
					/>
				</svg>
				{url}
			</span>
			{#if insecure}
				<span
					class="ml-2 inline-flex items-center gap-1 rounded-md bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700 dark:bg-red-900/50 dark:text-red-300"
				>
					Insecure (HTTP)
				</span>
			{/if}
		</dd>
	</div>
{/if}

{#if ref}
	<div>
		<dt class="text-sm font-medium text-gray-500 dark:text-gray-400">OCI Reference</dt>
		<dd class="mt-1 text-sm text-gray-900 dark:text-gray-100">
			{#if ref.tag}
				<span
					class="inline-flex items-center gap-1.5 rounded-md bg-blue-100 px-2 py-1 text-xs font-medium text-blue-800 dark:bg-blue-900/50 dark:text-blue-300"
				>
					<svg class="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
						<path
							stroke-linecap="round"
							stroke-linejoin="round"
							stroke-width="2"
							d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z"
						/>
					</svg>
					tag: {ref.tag}
				</span>
			{:else if ref.semver}
				<span
					class="inline-flex items-center rounded-md bg-green-100 px-2 py-1 text-xs font-medium text-green-800 dark:bg-green-900/50 dark:text-green-300"
				>
					semver: {ref.semver}
				</span>
			{:else if ref.digest}
				<span
					class="inline-flex items-center gap-1.5 rounded-md bg-gray-100 px-2 py-1 font-mono text-xs text-gray-800 dark:bg-gray-700 dark:text-gray-200"
				>
					{ref.digest.substring(0, 19)}...
				</span>
			{/if}
		</dd>
	</div>
{/if}

{#if provider}
	<div>
		<dt class="text-sm font-medium text-gray-500 dark:text-gray-400">Cloud Provider</dt>
		<dd class="mt-1">
			<span
				class="inline-flex items-center rounded-md bg-cyan-100 px-2 py-1 text-xs font-medium text-cyan-800 dark:bg-cyan-900/50 dark:text-cyan-300"
			>
				{provider}
			</span>
		</dd>
	</div>
{/if}
