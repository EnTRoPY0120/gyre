<script lang="ts">
	import { page } from '$app/stores';
	import { resourceGroups } from '$lib/config/resources';
	import { sidebarOpen } from '$lib/stores/sidebar';

	const isOpen = $derived($sidebarOpen);
	const currentPath = $derived($page.url.pathname);

	function isActive(type: string): boolean {
		return currentPath.includes(`/resources/${type}`);
	}
</script>

{#if isOpen}
	<aside class="flex h-screen w-64 flex-col border-r border-gray-200 bg-white">
		<!-- Logo and Brand -->
		<div class="flex h-16 items-center justify-between border-b border-gray-200 px-4">
			<a href="/" class="flex items-center gap-2">
				<span class="text-2xl">🌀</span>
				<span class="text-xl font-bold text-gray-900">Gyre</span>
			</a>
			<button
				type="button"
				class="rounded-md p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
				onclick={() => sidebarOpen.toggle()}
				aria-label="Close sidebar"
			>
				<svg class="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
					<path
						stroke-linecap="round"
						stroke-linejoin="round"
						stroke-width="2"
						d="M6 18L18 6M6 6l12 12"
					/>
				</svg>
			</button>
		</div>

		<!-- Navigation -->
		<nav class="flex-1 overflow-y-auto p-4">
			<div class="space-y-6">
				<!-- Dashboard Link -->
				<div>
					<a
						href="/"
						class="flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors {currentPath === '/'
							? 'bg-blue-50 text-blue-700'
							: 'text-gray-700 hover:bg-gray-50'}"
					>
						<span class="text-lg">📊</span>
						<span>Dashboard</span>
					</a>
				</div>

				<!-- Resource Groups -->
				{#each resourceGroups as group}
					<div>
						<h3 class="mb-2 px-3 text-xs font-semibold uppercase tracking-wider text-gray-500">
							{group.icon} {group.name}
						</h3>
						<div class="space-y-1">
							{#each group.resources as resource}
								<a
									href="/resources/{resource.type}"
									class="flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors {isActive(resource.type)
										? 'bg-blue-50 text-blue-700 font-medium'
										: 'text-gray-700 hover:bg-gray-50'}"
								>
									<span>{resource.displayName}</span>
								</a>
							{/each}
						</div>
					</div>
				{/each}
			</div>
		</nav>

		<!-- Footer -->
		<div class="border-t border-gray-200 p-4">
			<p class="text-xs text-gray-500">FluxCD WebUI v1.0.0</p>
		</div>
	</aside>
{:else}
	<!-- Collapsed sidebar -->
	<aside class="flex h-screen w-16 flex-col border-r border-gray-200 bg-white">
		<div class="flex h-16 items-center justify-center border-b border-gray-200">
			<button
				type="button"
				class="rounded-md p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
				onclick={() => sidebarOpen.toggle()}
				aria-label="Open sidebar"
			>
				<svg class="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
					<path
						stroke-linecap="round"
						stroke-linejoin="round"
						stroke-width="2"
						d="M4 6h16M4 12h16M4 18h16"
					/>
				</svg>
			</button>
		</div>
	</aside>
{/if}
