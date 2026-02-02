<script lang="ts">
	import { page } from '$app/stores';
	import { getResourceInfo } from '$lib/config/resources';

	interface Props {
		health?: {
			connected: boolean;
			clusterName?: string;
		};
	}

	let { health = { connected: false } }: Props = $props();

	// Build breadcrumbs from current path
	const breadcrumbs = $derived(() => {
		const pathname = $page.url.pathname;
		const parts = pathname.split('/').filter(Boolean);
		const crumbs: { label: string; href: string }[] = [];

		if (parts.length === 0) {
			return [{ label: 'Dashboard', href: '/' }];
		}

		crumbs.push({ label: 'Dashboard', href: '/' });

		if (parts[0] === 'resources' && parts[1]) {
			const resourceInfo = getResourceInfo(parts[1]);
			const displayName = resourceInfo?.displayName || parts[1];
			crumbs.push({ label: displayName, href: `/resources/${parts[1]}` });

			if (parts[2] && parts[3]) {
				// Detail page: /resources/[type]/[namespace]/[name]
				const name = parts[3];
				crumbs.push({
					label: `${parts[2]}/${name}`,
					href: `/resources/${parts[1]}/${parts[2]}/${parts[3]}`
				});
			}
		}

		return crumbs;
	});
</script>

<header
	class="sticky top-0 z-10 flex h-16 items-center justify-between border-b border-gray-200 bg-white/95 px-6 backdrop-blur-sm"
>
	<!-- Breadcrumb Navigation -->
	<nav class="flex items-center" aria-label="Breadcrumb">
		<ol class="flex items-center space-x-2">
			{#each breadcrumbs() as crumb, i}
				{#if i > 0}
					<li class="flex items-center">
						<svg
							class="h-4 w-4 flex-shrink-0 text-gray-400"
							fill="currentColor"
							viewBox="0 0 20 20"
						>
							<path
								fill-rule="evenodd"
								d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z"
								clip-rule="evenodd"
							/>
						</svg>
					</li>
				{/if}
				<li>
					{#if i === breadcrumbs().length - 1}
						<span class="text-sm font-medium text-gray-900">{crumb.label}</span>
					{:else}
						<a href={crumb.href} class="text-sm text-gray-500 hover:text-gray-700">{crumb.label}</a>
					{/if}
				</li>
			{/each}
		</ol>
	</nav>

	<!-- Right Side: Connection Status & Actions -->
	<div class="flex items-center gap-4">
		<!-- Cluster Connection Status -->
		<div class="flex items-center gap-2">
			{#if health.connected}
				<span class="relative flex h-2.5 w-2.5">
					<span
						class="absolute inline-flex h-full w-full animate-ping rounded-full bg-green-400 opacity-75"
					></span>
					<span class="relative inline-flex h-2.5 w-2.5 rounded-full bg-green-500"></span>
				</span>
				<span class="text-sm text-gray-600">
					{health.clusterName || 'Connected'}
				</span>
			{:else}
				<span class="relative flex h-2.5 w-2.5">
					<span class="relative inline-flex h-2.5 w-2.5 rounded-full bg-red-500"></span>
				</span>
				<span class="text-sm text-gray-500">Disconnected</span>
			{/if}
		</div>

		<!-- Settings Button -->
		<button
			type="button"
			class="rounded-lg p-2 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600"
			aria-label="Settings"
		>
			<svg class="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
				<path
					stroke-linecap="round"
					stroke-linejoin="round"
					stroke-width="2"
					d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
				/>
				<path
					stroke-linecap="round"
					stroke-linejoin="round"
					stroke-width="2"
					d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
				/>
			</svg>
		</button>
	</div>
</header>
