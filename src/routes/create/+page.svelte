<script lang="ts">
	import { templates } from '$lib/templates';
	import { Button } from '$lib/components/ui/button';
	import Icon from '$lib/components/ui/Icon.svelte';
	import { cn } from '$lib/utils';
	import { Plus, ArrowRight } from 'lucide-svelte';
</script>

<svelte:head>
	<title>Create Resource | Gyre</title>
</svelte:head>

<div class="space-y-8 p-8">
	<!-- Header -->
	<div class="flex items-center justify-between">
		<div>
			<h1 class="font-display text-3xl font-black tracking-tight">Create Resource</h1>
			<p class="mt-2 text-muted-foreground">
				Choose a template to get started with your new FluxCD resource.
			</p>
		</div>
	</div>

	<!-- Template Grid -->
	<div class="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
		{#each templates as template}
			<a
				href="/create/{template.id}"
				class="group relative flex flex-col overflow-hidden rounded-2xl border border-border bg-card/60 p-6 transition-all hover:border-blue-500/50 hover:bg-card hover:shadow-lg hover:shadow-blue-500/5"
			>
				<div
					class="mb-4 flex size-12 items-center justify-center rounded-xl bg-blue-500/10 text-blue-500 transition-colors group-hover:bg-blue-500 group-hover:text-white"
				>
					<Icon name={template.kind.toLowerCase()} size={24} />
				</div>

				<h3 class="mb-2 text-lg font-bold group-hover:text-blue-500">{template.name}</h3>
				<p class="mb-6 flex-1 text-sm text-muted-foreground">
					{template.description}
				</p>

				<div class="flex items-center gap-2 text-sm font-semibold text-blue-500">
					Create Now
					<ArrowRight size={16} class="transition-transform group-hover:translate-x-1" />
				</div>
			</a>
		{/each}

		<!-- Custom / Advanced Card -->
		<a
			href="/create/custom"
			class="group relative flex flex-col overflow-hidden rounded-2xl border border-dashed border-border bg-muted/20 p-6 transition-all hover:border-blue-500/50 hover:bg-muted/30"
		>
			<div
				class="mb-4 flex size-12 items-center justify-center rounded-xl bg-muted text-muted-foreground transition-all group-hover:bg-blue-500/10 group-hover:text-blue-500"
			>
				<Plus size={24} />
			</div>

			<h3 class="mb-2 text-lg font-bold">Custom Resource</h3>
			<p class="mb-6 flex-1 text-sm text-muted-foreground">
				Start with a blank YAML manifest for any FluxCD or Kubernetes resource.
			</p>

			<div
				class="flex items-center gap-2 text-sm font-semibold text-muted-foreground group-hover:text-blue-500"
			>
				Advanced Mode
				<ArrowRight size={16} class="transition-transform group-hover:translate-x-1" />
			</div>
		</a>
	</div>
</div>
