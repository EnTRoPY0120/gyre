<script lang="ts">
	import { page } from '$app/state';
	import { templates } from '$lib/templates';
	import ResourceWizard from '$lib/components/wizards/ResourceWizard.svelte';
	import { ChevronLeft } from 'lucide-svelte';

	const templateId = $derived(page.params.templateId);
	const template = $derived(templates.find((t) => t.id === templateId));

	// Fallback for "custom" or unknown templates
	const customTemplate = {
		id: 'custom',
		name: 'Custom Resource',
		description: 'Create any resource using raw YAML',
		kind: 'Resource',
		group: '',
		version: '',
		plural: 'resources',
		yaml: `apiVersion: v1
kind: ConfigMap
metadata:
  name: example
  namespace: default
data:
  key: value`,
		fields: []
	};

	const activeTemplate = $derived(template || customTemplate);
</script>

<svelte:head>
	<title>{activeTemplate.name} | Create | Gyre</title>
</svelte:head>

<div class="space-y-6 p-8">
	<!-- Top Navigation -->
	<header class="flex items-center gap-4">
		<a
			href="/create"
			rel="external"
			class="flex size-10 items-center justify-center rounded-full border border-border bg-card transition-colors hover:bg-accent"
			aria-label="Back to template selection"
		>
			<ChevronLeft size={20} />
		</a>
		<div>
			<h1 class="text-2xl font-bold tracking-tight">Create {activeTemplate.name}</h1>
		</div>
	</header>

	<hr class="border-border/50" />

	<!-- Wizard -->
	<ResourceWizard template={activeTemplate} defaultNamespace="flux-system" />
</div>
