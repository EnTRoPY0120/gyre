<script lang="ts">
	import { resolve } from '$app/paths';

	interface Props {
		resourceType: string;
		namespace: string;
		name: string;
	}

	let { resourceType, namespace, name }: Props = $props();

	const breadcrumbs = $derived([
		{ label: 'Resources', href: '/resources' },
		{ label: resourceType, href: `/resources/${resourceType}` },
		{ label: namespace, href: `/resources/${resourceType}?namespace=${namespace}` },
		{ label: name, href: null }
	]);
</script>

<nav class="flex" aria-label="Breadcrumb">
	<ol class="inline-flex items-center space-x-1 md:space-x-3">
		{#each breadcrumbs as crumb, i}
			<li class="inline-flex items-center">
				{#if i > 0}
					<svg
						class="mx-1 h-6 w-6 text-gray-400"
						fill="currentColor"
						viewBox="0 0 20 20"
						xmlns="http://www.w3.org/2000/svg"
					>
						<path
							fill-rule="evenodd"
							d="M7.293 14.707a1.1 1.1 0 010-1.414L10.586 10 7.293 6.707a1.1 1.1 0 011.414-1.414l4 4a1.1 1.1 0 010 1.414l-4 4a1.1 1.1 0 01-1.414 0z"
							clip-rule="evenodd"
						></path>
					</svg>
				{/if}
				{#if crumb.href}
					<a
						href={crumb.href}
						class="inline-flex items-center text-sm font-medium text-gray-700 hover:text-blue-600 dark:text-gray-400 dark:hover:text-white"
					>
						{#if i === 0}
							<svg
								class="mr-2 h-4 w-4"
								fill="currentColor"
								viewBox="0 0 20 20"
								xmlns="http://www.w3.org/2000/svg"
							>
								<path
									d="M10.707 2.293a1 1 0 00-1.414 0l-7 7a1 1 0 001.414 1.414L4 10.414V17a1 1 0 001 1h2a1 1 0 001-1v-2a1 1 0 011-1h2a1 1 0 011 1v2a1 1 0 001 1h2a1 1 0 001-1v-6.586l.293.293a1 1 0 001.414-1.414l-7-7z"
								></path>
							</svg>
						{/if}
						{crumb.label}
					</a>
				{:else}
					<span class="ml-1 text-sm font-medium text-gray-500 md:ml-2 dark:text-gray-400">
						{crumb.label}
					</span>
				{/if}
			</li>
		{/each}
	</ol>
</nav>
