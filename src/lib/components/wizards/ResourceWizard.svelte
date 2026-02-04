<script lang="ts">
	import { goto } from '$app/navigation';
	import { Button } from '$lib/components/ui/button';
	import YamlEditor from '$lib/components/editors/YamlEditor.svelte';
	import type { ResourceTemplate } from '$lib/templates';
	import { cn } from '$lib/utils';
	import { Loader2, Check, AlertCircle, Code, ListChecks, Copy, ChevronDown } from 'lucide-svelte';
	import yaml from 'js-yaml';

	let { template }: { template: ResourceTemplate } = $props();

	let mode = $state<'wizard' | 'yaml'>('wizard');
	let isSubmitting = $state(false);
	let error = $state<string | null>(null);
	let success = $state(false);
	let copySuccess = $state(false);

	// Track which sections are expanded
	let expandedSections = $state<Record<string, boolean>>({});

	// Initialize expanded sections from template
	$effect(() => {
		if (template.sections) {
			const initial: Record<string, boolean> = {};
			template.sections.forEach(section => {
				initial[section.id] = section.defaultExpanded ?? true;
			});
			expandedSections = initial;
		}
	});

	// Use derived for currentYaml
	let currentYaml = $derived.by(() => template.yaml);

	// Form values derived from parsing the current YAML
	let formValues = $state<Record<string, unknown>>({});

	// Update currentYaml from template
	$effect(() => {
		currentYaml = template.yaml;
	});

	// Initialize form values from initial YAML
	$effect(() => {
		try {
			const parsed = yaml.load(template.yaml) as Record<string, unknown> & {
				metadata?: { namespace?: string; name?: string };
			};
			const values: Record<string, unknown> = {};

			template.fields.forEach((field) => {
				const path = field.path.split('.');
				let current = parsed;
				for (let i = 0; i < path.length; i++) {
					if (!current) break;
					if (i === path.length - 1) {
						values[field.name] = current[path[i]];
					} else {
						current = current[path[i]] as Record<string, unknown>;
					}
				}
			});
			formValues = values;
		} catch {
			console.error('Failed to parse initial YAML');
		}
	});

	// Synchronize YAML when form values change (Wizard -> YAML)
	function updateYamlFromForm() {
		try {
			const parsed = yaml.load(currentYaml) as Record<string, unknown>;

			template.fields.forEach((field) => {
				const value = formValues[field.name];
				const path = field.path.split('.');

				let current = parsed;
				for (let i = 0; i < path.length; i++) {
					if (i === path.length - 1) {
						current[path[i]] = value;
					} else {
						if (!current[path[i]]) current[path[i]] = {};
						current = current[path[i]] as Record<string, unknown>;
					}
				}
			});

			currentYaml = yaml.dump(parsed);
		} catch {
			console.error('Failed to update YAML from form');
		}
	}

	// Synchronize form values when YAML changes (YAML -> Wizard)
	function updateFormFromYaml() {
		try {
			const parsed = yaml.load(currentYaml) as Record<string, unknown>;
			const values: Record<string, unknown> = { ...formValues };

			template.fields.forEach((field) => {
				const path = field.path.split('.');
				let current = parsed;
				for (let i = 0; i < path.length; i++) {
					if (!current) break;
					if (i === path.length - 1) {
						values[field.name] = current[path[i]];
					} else {
						current = current[path[i]] as Record<string, unknown>;
					}
				}
			});
			formValues = values;
		} catch {
			// Don't log here to avoid spamming as user types invalid YAML
		}
	}

	async function handleSubmit() {
		isSubmitting = true;
		error = null;

		try {
			const parsed = yaml.load(currentYaml) as Record<string, unknown> & {
				metadata?: { namespace?: string; name?: string };
			};
			const response = await fetch(`/api/flux/${template.id.split('-')[0]}s`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(parsed)
			});

			if (!response.ok) {
				const data = await response.json();
				throw new Error(data.message || 'Failed to create resource');
			}

			success = true;
			setTimeout(() => {
				void goto(
					`/resources/${template.id.split('-')[0]}s/${parsed.metadata?.namespace}/${parsed.metadata?.name}`
				);
			}, 1500);
		} catch (err) {
			error = (err as Error).message;
		} finally {
			isSubmitting = false;
		}
	}

	function toggleMode(newMode: 'wizard' | 'yaml') {
		if (newMode === 'wizard') {
			updateFormFromYaml();
		} else {
			updateYamlFromForm();
		}
		mode = newMode;
	}

	function toggleSection(sectionId: string) {
		expandedSections[sectionId] = !expandedSections[sectionId];
	}

	async function copyYaml() {
		try {
			if (mode === 'wizard') {
				updateYamlFromForm();
			}
			await navigator.clipboard.writeText(currentYaml);
			copySuccess = true;
			setTimeout(() => {
				copySuccess = false;
			}, 2000);
		} catch (err) {
			console.error('Failed to copy YAML:', err);
		}
	}

	// Group fields by section
	const fieldsBySection = $derived.by(() => {
		if (!template.sections) {
			return { '': template.fields };
		}

		const grouped: Record<string, typeof template.fields> = {};
		template.sections.forEach(section => {
			grouped[section.id] = template.fields.filter(f => f.section === section.id);
		});

		// Add fields without section to default group
		const unsectioned = template.fields.filter(f => !f.section);
		if (unsectioned.length > 0) {
			grouped[''] = unsectioned;
		}

		return grouped;
	});
</script>

<div class="flex flex-col gap-6">
	<!-- Head -->
	<div class="flex items-center justify-between">
		<div>
			<h2 class="text-xl font-bold">{template.name} Creation</h2>
			<p class="text-sm text-muted-foreground">{template.description}</p>
		</div>

		<div class="flex items-center gap-2">
			{#if mode === 'yaml'}
				<Button
					variant="outline"
					size="sm"
					onclick={copyYaml}
					class="gap-2"
				>
					{#if copySuccess}
						<Check size={16} class="text-green-500" />
						Copied!
					{:else}
						<Copy size={16} />
						Copy YAML
					{/if}
				</Button>
			{/if}

			<div class="flex rounded-lg border border-border bg-card p-1">
				<button
					class={cn(
						'flex items-center gap-2 rounded-md px-3 py-1.5 text-sm font-medium transition-all',
						mode === 'wizard' ? 'bg-primary text-primary-foreground shadow-sm' : 'hover:bg-accent'
					)}
					onclick={() => toggleMode('wizard')}
				>
					<ListChecks size={16} />
					Form
				</button>
				<button
					class={cn(
						'flex items-center gap-2 rounded-md px-3 py-1.5 text-sm font-medium transition-all',
						mode === 'yaml' ? 'bg-primary text-primary-foreground shadow-sm' : 'hover:bg-accent'
					)}
					onclick={() => toggleMode('yaml')}
				>
					<Code size={16} />
					Edit as YAML
				</button>
			</div>
		</div>
	</div>

	<!-- Content -->
	<div class="grid gap-8 lg:grid-cols-[1fr_400px]">
		<!-- Primary Content -->
		<div class="rounded-xl border border-border bg-card/60 backdrop-blur-sm">
			{#if mode === 'wizard'}
				<div class="divide-y divide-border">
					{#if template.sections}
						{#each template.sections as section (section.id)}
							{@const sectionFields = fieldsBySection[section.id] || []}
							{#if sectionFields.length > 0}
								<div class="p-6">
									<button
										onclick={() => toggleSection(section.id)}
										class="mb-4 flex w-full items-center justify-between text-left"
									>
										<div>
											<h3 class="font-semibold text-base">{section.title}</h3>
											{#if section.description}
												<p class="text-sm text-muted-foreground">{section.description}</p>
											{/if}
										</div>
										{#if section.collapsible}
											<ChevronDown
												size={20}
												class={cn(
													'transition-transform text-muted-foreground',
													expandedSections[section.id] ? 'rotate-180' : ''
												)}
											/>
										{/if}
									</button>

									{#if expandedSections[section.id]}
										<div class="grid gap-6">
											{#each sectionFields as field (field.name)}
												<div class="flex flex-col gap-1.5">
													<label
														for="field-{field.name}"
														class="text-sm leading-none font-medium peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
													>
														{field.label}
														{#if field.required}<span class="text-red-500">*</span>{/if}
													</label>

													{#if field.type === 'select'}
														<select
															id="field-{field.name}"
															bind:value={formValues[field.name]}
															class="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50"
														>
															{#each field.options || [] as opt (opt.value)}
																<option value={opt.value}>{opt.label}</option>
															{/each}
														</select>
													{:else if field.type === 'boolean'}
														<div class="flex items-center gap-2">
															<input
																type="checkbox"
																bind:checked={formValues[field.name] as boolean}
																class="size-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
															/>
															<span class="text-sm text-muted-foreground">{field.description || ''}</span>
														</div>
													{:else if field.type === 'textarea'}
														<textarea
															id="field-{field.name}"
															bind:value={formValues[field.name] as string}
															placeholder={field.placeholder || field.description}
															rows="4"
															class="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50 font-mono"
														></textarea>
													{:else}
														<input
															id="field-{field.name}"
															type={field.type === 'number' ? 'number' : 'text'}
															bind:value={formValues[field.name] as string}
															placeholder={field.placeholder || field.description}
															class="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50"
														/>
													{/if}

													{#if field.description && field.type !== 'boolean'}
														<p class="text-xs text-muted-foreground">{field.description}</p>
													{/if}
												</div>
											{/each}
										</div>
									{/if}
								</div>
							{/if}
						{/each}
					{:else}
						<!-- Fallback for templates without sections -->
						<div class="p-6">
							<div class="grid gap-6">
								{#each template.fields as field (field.name)}
									<div class="flex flex-col gap-1.5">
										<label
											for="field-{field.name}"
											class="text-sm leading-none font-medium peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
										>
											{field.label}
											{#if field.required}<span class="text-red-500">*</span>{/if}
										</label>

										{#if field.type === 'select'}
											<select
												id="field-{field.name}"
												bind:value={formValues[field.name]}
												class="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50"
											>
												{#each field.options || [] as opt (opt.value)}
													<option value={opt.value}>{opt.label}</option>
												{/each}
											</select>
										{:else if field.type === 'boolean'}
											<div class="flex items-center gap-2">
												<input
													type="checkbox"
													bind:checked={formValues[field.name] as boolean}
													class="size-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
												/>
												<span class="text-sm text-muted-foreground">{field.description || ''}</span>
											</div>
										{:else if field.type === 'textarea'}
											<textarea
												id="field-{field.name}"
												bind:value={formValues[field.name] as string}
												placeholder={field.placeholder || field.description}
												rows="4"
												class="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50 font-mono"
											></textarea>
										{:else}
											<input
												id="field-{field.name}"
												type={field.type === 'number' ? 'number' : 'text'}
												bind:value={formValues[field.name] as string}
												placeholder={field.placeholder || field.description}
												class="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50"
											/>
										{/if}

										{#if field.description && field.type !== 'boolean'}
											<p class="text-xs text-muted-foreground">{field.description}</p>
										{/if}
									</div>
								{/each}
							</div>
						</div>
					{/if}
				</div>
			{:else}
				<YamlEditor value={currentYaml} className="min-h-[500px]" />
			{/if}
		</div>

		<!-- Sidebar / Preview -->
		<div class="flex flex-col gap-6">
			<div class="rounded-xl border border-border bg-card/60 p-6 backdrop-blur-sm">
				<h3 class="mb-4 font-semibold">Ready to Create?</h3>
				<p class="mb-6 text-sm text-muted-foreground">
					This will create a new {template.kind} in your cluster. Make sure the configuration is correct.
				</p>

				<Button class="w-full" size="lg" disabled={isSubmitting || success} onclick={handleSubmit}>
					{#if isSubmitting}
						<Loader2 class="mr-2 h-4 w-4 animate-spin" />
						Creating...
					{:else if success}
						<Check class="mr-2 h-4 w-4" />
						Created!
					{:else}
						Create {template.kind}
					{/if}
				</Button>

				{#if error}
					<div
						class="mt-4 flex items-start gap-2 rounded-lg border border-red-500/20 bg-red-500/10 p-3 text-sm text-red-500"
					>
						<AlertCircle class="mt-0.5 shrink-0" size={16} />
						<span>{error}</span>
					</div>
				{/if}
			</div>

			<!-- Quick Help -->
			<div class="rounded-xl border border-border bg-muted/30 p-6">
				<h4 class="mb-2 text-sm font-semibold">Tips</h4>
				<ul class="space-y-2 text-xs leading-relaxed text-muted-foreground">
					<li class="flex gap-2">
						<span class="text-primary">•</span>
						<span>Use <strong>Form mode</strong> for guided configuration with all available fields</span>
					</li>
					<li class="flex gap-2">
						<span class="text-primary">•</span>
						<span>Switch to <strong>Edit as YAML</strong> for direct manifest editing</span>
					</li>
					<li class="flex gap-2">
						<span class="text-primary">•</span>
						<span>Click <strong>Copy YAML</strong> to copy the generated manifest</span>
					</li>
				</ul>
			</div>
		</div>
	</div>
</div>
