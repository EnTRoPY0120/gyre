<script lang="ts">
	import { templates } from '$lib/templates';
	import Icon from '$lib/components/ui/Icon.svelte';
	import { ArrowRight } from 'lucide-svelte';

	// Group templates by category
	const categories = [
		{
			id: 'sources',
			name: 'Sources',
			description: 'Define where your manifests and charts come from',
			templates: templates.filter((t) => t.category === 'sources')
		},
		{
			id: 'deployments',
			name: 'Deployments',
			description: 'Deploy resources from sources',
			templates: templates.filter((t) => t.category === 'deployments')
		},
		{
			id: 'notifications',
			name: 'Notifications',
			description: 'Configure alerts and notification channels',
			templates: templates.filter((t) => t.category === 'notifications')
		},
		{
			id: 'image-automation',
			name: 'Image Automation',
			description: 'Automate container image updates',
			templates: templates.filter((t) => t.category === 'image-automation')
		}
	];
</script>

<svelte:head>
	<title>Create Resource | Gyre</title>
</svelte:head>

<div class="space-y-8 p-4 sm:p-8">
	<!-- Header -->
	<div class="flex items-center justify-between">
		<div>
			<h1 class="font-display text-3xl font-black tracking-tight">Create Resource</h1>
			<p class="mt-2 text-muted-foreground">
				Choose a template to get started with your new FluxCD resource.
			</p>
		</div>
	</div>

	<!-- Template Categories -->
	<div class="space-y-12">
		{#each categories as category (category.id)}
			<section>
				<div class="mb-6">
					<h2 class="text-xl font-bold">{category.name}</h2>
					<p class="text-sm text-muted-foreground">{category.description}</p>
				</div>

				<div class="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
					{#each category.templates as template (template.id)}
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
				</div>
			</section>
		{/each}
	</div>
</div>
