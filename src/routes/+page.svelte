<script lang="ts">
	import { resourceGroups } from '$lib/config/resources';

	interface Props {
		data: {
			health: {
				connected: boolean;
				clusterName?: string;
			};
			groupCounts: Record<
				string,
				{ total: number; healthy: number; failed: number; error: boolean }
			>;
		};
	}

	let { data }: Props = $props();

	// Get total counts across all groups
	const totals = $derived(() => {
		let total = 0;
		let healthy = 0;
		let failed = 0;

		for (const counts of Object.values(data.groupCounts)) {
			total += counts.total;
			healthy += counts.healthy;
			failed += counts.failed;
		}

		return { total, healthy, failed };
	});
</script>

<div class="space-y-8">
	<!-- Welcome Header -->
	<div>
		<h1 class="text-3xl font-bold text-gray-900 dark:text-gray-100">Dashboard</h1>
		<p class="mt-2 text-gray-600 dark:text-gray-400">Monitor and manage your FluxCD resources</p>
	</div>

	<!-- Cluster Status Card -->
	<div class="overflow-hidden rounded-xl border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800">
		<div class="border-b border-gray-200 bg-gray-50 px-6 py-4 dark:border-gray-700 dark:bg-gray-800/50">
			<h2 class="text-lg font-semibold text-gray-900 dark:text-gray-100">Cluster Connection</h2>
		</div>
		<div class="p-6">
			<div class="flex items-center gap-4">
				{#if data.health.connected}
					<div
						class="flex h-14 w-14 items-center justify-center rounded-full bg-green-100 dark:bg-green-900/50"
					>
						<svg class="h-7 w-7 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
							<path
								stroke-linecap="round"
								stroke-linejoin="round"
								stroke-width="2"
								d="M5 13l4 4L19 7"
							/>
						</svg>
					</div>
					<div>
						<p class="text-lg font-semibold text-gray-900 dark:text-gray-100">Connected</p>
						<p class="text-sm text-gray-500 dark:text-gray-400">
							{data.health.clusterName || 'Kubernetes cluster is reachable'}
						</p>
					</div>
				{:else}
					<div
						class="flex h-14 w-14 items-center justify-center rounded-full bg-red-100 dark:bg-red-900/50"
					>
						<svg class="h-7 w-7 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
							<path
								stroke-linecap="round"
								stroke-linejoin="round"
								stroke-width="2"
								d="M6 18L18 6M6 6l12 12"
							/>
						</svg>
					</div>
					<div>
						<p class="text-lg font-semibold text-gray-900 dark:text-gray-100">Disconnected</p>
						<p class="text-sm text-gray-500 dark:text-gray-400">
							Unable to connect to Kubernetes cluster
						</p>
					</div>
				{/if}
			</div>
		</div>
	</div>

	<!-- Overall Statistics -->
	<div class="grid gap-4 sm:grid-cols-3">
		<div class="rounded-xl border border-gray-200 bg-white p-6 dark:border-gray-700 dark:bg-gray-800">
			<div class="flex items-center gap-4">
				<div class="flex h-12 w-12 items-center justify-center rounded-lg bg-blue-100 dark:bg-blue-900/50">
					<svg class="h-6 w-6 text-blue-600 dark:text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
						<path
							stroke-linecap="round"
							stroke-linejoin="round"
							stroke-width="2"
							d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"
						/>
					</svg>
				</div>
				<div>
					<p class="text-sm font-medium text-gray-500 dark:text-gray-400">Total Resources</p>
					<p class="text-2xl font-bold text-gray-900 dark:text-gray-100">{totals().total}</p>
				</div>
			</div>
		</div>

		<div class="rounded-xl border border-green-200 bg-green-50 p-6 dark:border-green-800 dark:bg-green-900/30">
			<div class="flex items-center gap-4">
				<div class="flex h-12 w-12 items-center justify-center rounded-lg bg-green-200 dark:bg-green-800">
					<svg class="h-6 w-6 text-green-700 dark:text-green-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
						<path
							stroke-linecap="round"
							stroke-linejoin="round"
							stroke-width="2"
							d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
						/>
					</svg>
				</div>
				<div>
					<p class="text-sm font-medium text-green-700 dark:text-green-300">Healthy</p>
					<p class="text-2xl font-bold text-green-900 dark:text-green-100">{totals().healthy}</p>
				</div>
			</div>
		</div>

		<div class="rounded-xl border border-red-200 bg-red-50 p-6 dark:border-red-800 dark:bg-red-900/30">
			<div class="flex items-center gap-4">
				<div class="flex h-12 w-12 items-center justify-center rounded-lg bg-red-200 dark:bg-red-800">
					<svg class="h-6 w-6 text-red-700 dark:text-red-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
						<path
							stroke-linecap="round"
							stroke-linejoin="round"
							stroke-width="2"
							d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
						/>
					</svg>
				</div>
				<div>
					<p class="text-sm font-medium text-red-700 dark:text-red-300">Failed</p>
					<p class="text-2xl font-bold text-red-900 dark:text-red-100">{totals().failed}</p>
				</div>
			</div>
		</div>
	</div>

	<!-- Resource Groups -->
	<div>
		<h2 class="mb-4 text-xl font-semibold text-gray-900 dark:text-gray-100">Resource Groups</h2>
		<div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
			{#each resourceGroups as group}
				{@const counts = data.groupCounts[group.name] || { total: 0, healthy: 0, failed: 0, error: false }}
				<div class="overflow-hidden rounded-xl border border-gray-200 bg-white transition-shadow hover:shadow-md dark:border-gray-700 dark:bg-gray-800">
					<div class="border-b border-gray-100 bg-gray-50 px-5 py-3 dark:border-gray-700 dark:bg-gray-800/50">
						<div class="flex items-center gap-2">
							<span class="text-xl">{group.icon}</span>
							<h3 class="font-semibold text-gray-900 dark:text-gray-100">{group.name}</h3>
						</div>
					</div>
					<div class="p-5">
						{#if counts.error}
							<p class="text-sm text-gray-500 dark:text-gray-400">Unable to fetch data</p>
						{:else}
							<div class="mb-4 flex items-baseline gap-2">
								<span class="text-3xl font-bold text-gray-900 dark:text-gray-100">{counts.total}</span>
								<span class="text-sm text-gray-500 dark:text-gray-400">resources</span>
							</div>
							<div class="flex gap-4 text-sm">
								<div class="flex items-center gap-1.5">
									<span class="h-2 w-2 rounded-full bg-green-500"></span>
									<span class="text-gray-600 dark:text-gray-400">{counts.healthy} healthy</span>
								</div>
								{#if counts.failed > 0}
									<div class="flex items-center gap-1.5">
										<span class="h-2 w-2 rounded-full bg-red-500"></span>
										<span class="text-gray-600 dark:text-gray-400">{counts.failed} failed</span>
									</div>
								{/if}
							</div>
						{/if}

						<!-- Resource Links -->
						<div class="mt-4 flex flex-wrap gap-2">
							{#each group.resources as resource}
								<a
									href="/resources/{resource.type}"
									class="rounded-md bg-gray-100 px-2.5 py-1 text-xs font-medium text-gray-700 transition-colors hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600"
								>
									{resource.displayName}
								</a>
							{/each}
						</div>
					</div>
				</div>
			{/each}
		</div>
	</div>

	<!-- Quick Actions -->
	<div class="rounded-xl border border-gray-200 bg-white p-6 dark:border-gray-700 dark:bg-gray-800">
		<h2 class="mb-4 text-lg font-semibold text-gray-900 dark:text-gray-100">Quick Actions</h2>
		<div class="flex flex-wrap gap-3">
			<a
				href="/resources/gitrepositories"
				class="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-blue-700"
			>
				<svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
					<path
						stroke-linecap="round"
						stroke-linejoin="round"
						stroke-width="2"
						d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4"
					/>
				</svg>
				View Git Sources
			</a>
			<a
				href="/resources/kustomizations"
				class="inline-flex items-center gap-2 rounded-lg bg-gray-100 px-4 py-2.5 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600"
			>
				<svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
				View Kustomizations
			</a>
			<a
				href="/resources/helmreleases"
				class="inline-flex items-center gap-2 rounded-lg bg-gray-100 px-4 py-2.5 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600"
			>
				<svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
					<path
						stroke-linecap="round"
						stroke-linejoin="round"
						stroke-width="2"
						d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4"
					/>
				</svg>
				View Helm Releases
			</a>
			<button
				type="button"
				class="inline-flex items-center gap-2 rounded-lg bg-gray-100 px-4 py-2.5 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600"
				onclick={() => window.location.reload()}
			>
				<svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
					<path
						stroke-linecap="round"
						stroke-linejoin="round"
						stroke-width="2"
						d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
					/>
				</svg>
				Refresh
			</button>
		</div>
	</div>
</div>
