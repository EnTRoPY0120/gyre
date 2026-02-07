<script lang="ts">
	import Icon from '$lib/components/ui/Icon.svelte';

	const adminFeatures = [
		{
			title: 'User Management',
			description: 'Manage user accounts, roles, and permissions.',
			href: '/admin/users',
			icon: 'users',
			color: 'text-blue-500',
			bg: 'bg-blue-500/10'
		},
		{
			title: 'Cluster Management',
			description: 'Configure and manage Kubernetes cluster contexts.',
			href: '/admin/clusters',
			icon: 'server',
			color: 'text-amber-500',
			bg: 'bg-amber-500/10'
		},
		{
			title: 'Auth Providers',
			description: 'Configure SSO and OAuth2 authentication providers.',
			href: '/admin/auth-providers',
			icon: 'key',
			color: 'text-emerald-500',
			bg: 'bg-emerald-500/10'
		},
		{
			title: 'Policies & RBAC',
			description: 'Define access control policies and permissions.',
			href: '/admin/policies',
			icon: 'shield-check',
			color: 'text-purple-500',
			bg: 'bg-purple-500/10'
		}
	];
</script>

<div class="space-y-6">
	<!-- Header -->
	<div>
		<h1 class="text-2xl font-bold text-white">Administration</h1>
		<p class="text-slate-400">Manage system settings, users, and cluster configurations</p>
	</div>

	<div class="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-4">
		{#each adminFeatures as feature (feature.title)}
			<a
				href={feature.href}
				class="group relative flex flex-col rounded-2xl border border-slate-700/50 bg-slate-800/40 p-6 transition-all duration-300 hover:border-amber-500/30 hover:bg-slate-800/60 hover:shadow-2xl hover:shadow-amber-500/5"
			>
				<div
					class="mb-4 flex h-12 w-12 items-center justify-center rounded-xl {feature.bg} {feature.color} transition-transform duration-300 group-hover:scale-110"
				>
					<Icon name={feature.icon} size={24} />
				</div>
				<h3 class="mb-2 text-lg font-bold text-white group-hover:text-amber-400">
					{feature.title}
				</h3>
				<p class="text-sm leading-relaxed text-slate-400 group-hover:text-slate-300">
					{feature.description}
				</p>

				<div
					class="mt-6 flex items-center text-xs font-bold tracking-wider text-amber-500 uppercase opacity-0 transition-opacity duration-300 group-hover:opacity-100"
				>
					Open {feature.title}
					<Icon name="arrow-right" size={14} class="ml-2" />
				</div>
			</a>
		{/each}
	</div>

	<!-- System Info Section (Optional future expansion) -->
	<div class="mt-12 rounded-2xl border border-slate-700/50 bg-slate-800/20 p-8">
		<div class="flex items-start gap-4">
			<div
				class="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-slate-700/50 text-slate-400"
			>
				<Icon name="settings" size={20} />
			</div>
			<div>
				<h2 class="text-lg font-bold text-white">System Configuration</h2>
				<p class="mt-1 text-sm text-slate-400">
					Gyre is currently running in a single-cluster mode with local SQLite database. Some
					settings may be controlled via environment variables.
				</p>
				<div class="mt-4 flex gap-4">
					<div class="flex flex-col">
						<span class="text-[10px] font-bold tracking-widest text-slate-500 uppercase"
							>Version</span
						>
						<span class="font-mono text-sm text-slate-300">v0.0.1</span>
					</div>
					<div class="flex flex-col">
						<span class="text-[10px] font-bold tracking-widest text-slate-500 uppercase"
							>Environment</span
						>
						<span class="font-mono text-sm text-slate-300">Production</span>
					</div>
				</div>
			</div>
		</div>
	</div>
</div>
