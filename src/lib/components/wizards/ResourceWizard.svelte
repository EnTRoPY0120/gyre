<script lang="ts">
	import { goto } from '$app/navigation';
	import WizardContent from '$lib/components/wizards/WizardContent.svelte';
	import WizardHeader from '$lib/components/wizards/WizardHeader.svelte';
	import WizardPreview from '$lib/components/wizards/WizardPreview.svelte';
	import type { ResourceTemplate, TemplateField } from '$lib/templates';
	import { logger } from '$lib/utils/logger.js';
	import { parse, parseDocument, YAMLError } from 'yaml';
	import { getCsrfToken } from '$lib/utils/csrf';
	import {
		coerceWizardFieldValue,
		validateHelmReleaseResourceValues as validateWizardHelmReleaseResourceValues,
		validateWizardField
	} from './field-validation';
	import { createResourceFromWizard, getWizardResourceRedirect } from './resource-submit';
	import {
		buildWizardFormValues,
		getWizardValueAtPath,
		inferVirtualFieldValue
	} from './wizard-values';

	let {
		template,
		defaultNamespace = 'flux-system'
	}: {
		template: ResourceTemplate;
		defaultNamespace?: string;
	} = $props();

	let mode = $state<'wizard' | 'yaml'>('wizard');
	let isSubmitting = $state(false);
	let error = $state<string | null>(null);
	let success = $state(false);
	let copySuccess = $state(false);
	let validationErrors = $state<Record<string, string>>({});
	let yamlError = $state<string | null>(null);

	// Track which sections are expanded
	let expandedSections = $state<Record<string, boolean>>({});

	// Initialize expanded sections from template
	$effect(() => {
		if (template.sections) {
			const initial: Record<string, boolean> = {};
			template.sections.forEach((section) => {
				initial[section.id] = section.defaultExpanded ?? true;
			});
			expandedSections = initial;
		}
	});

	// Current YAML - starts with template YAML and can be edited
	let currentYaml = $state('');

	// Form values derived from parsing the current YAML
	let formValues = $state<Record<string, unknown>>({});
	let hasInitializedFormValues = $state(false);

	// Update currentYaml when template changes
	$effect(() => {
		currentYaml = template.yaml;
		yamlError = null;
		hasInitializedFormValues = false;
	});

	// Validate YAML in real-time when in YAML mode
	$effect(() => {
		if (mode === 'yaml' && currentYaml) {
			try {
				parse(currentYaml);
				yamlError = null;
			} catch (err) {
				if (err instanceof YAMLError) {
					yamlError = `YAML Syntax Error: ${err.message}`;
				} else {
					yamlError = 'Invalid YAML syntax';
				}
			}
		}
	});

	// Initialize form values from initial YAML and defaults
	$effect(() => {
		try {
			const parsed = parse(template.yaml) as Record<string, unknown> & {
				metadata?: { namespace?: string; name?: string };
			};
			formValues = buildWizardFormValues(template, parsed, defaultNamespace);
			hasInitializedFormValues = true;
		} catch (err) {
			logger.error(err, 'Failed to parse initial YAML');
			formValues = {};
			yamlError = 'Failed to parse template YAML';
			hasInitializedFormValues = true;
		}
	});

	$effect(() => {
		if (mode !== 'wizard' || !currentYaml || !hasInitializedFormValues) return;

		JSON.stringify(formValues);
		updateYamlFromForm();
	});

	// Synchronize YAML when form values change (Wizard -> YAML)
	function updateYamlFromForm() {
		try {
			const doc = parseDocument(currentYaml || template.yaml);
			template.fields.forEach((field) => applyFieldToYaml(doc, field));

			currentYaml = doc.toString();
		} catch (err) {
			logger.error(err, 'Failed to update YAML from form');
		}
	}

	function applyFieldToYaml(doc: ReturnType<typeof parseDocument>, field: TemplateField) {
		if (field.virtual || removeHiddenField(doc, field)) return;

		const value = coerceFieldValue(field, formValues[field.name]);
		if (removeEmptyFieldValue(doc, field, value)) return;

		doc.setIn(field.path.split('.'), value);
	}

	function removeHiddenField(doc: ReturnType<typeof parseDocument>, field: TemplateField): boolean {
		if (shouldShowField(field)) return false;

		const visibleFieldWithSamePath = template.fields.some(
			(candidate) =>
				candidate !== field &&
				!candidate.virtual &&
				candidate.path === field.path &&
				shouldShowField(candidate)
		);
		if (!visibleFieldWithSamePath) doc.deleteIn(field.path.split('.'));
		return true;
	}

	function removeEmptyFieldValue(
		doc: ReturnType<typeof parseDocument>,
		field: TemplateField,
		value: unknown
	): boolean {
		const path = field.path.split('.');
		if (field.name === 'verifyMode' && value === '') {
			doc.deleteIn(path.slice(0, -1));
			return true;
		}
		if (field.type === 'number' && value === undefined) {
			doc.deleteIn(path);
			return true;
		}
		return false;
	}

	// Synchronize form values when YAML changes (YAML -> Wizard)
	function updateFormFromYaml() {
		try {
			const parsed = parse(currentYaml) as Record<string, unknown>;
			yamlError = null;
			const values: Record<string, unknown> = { ...formValues };

			template.fields.forEach((field) => {
				if (field.virtual) {
				const manifestValue = inferVirtualFieldValue(field, template.fields, parsed);
					if (manifestValue !== undefined) {
						values[field.name] = manifestValue;
					} else if (values[field.name] === undefined && field.default !== undefined) {
						values[field.name] = field.default;
					}
					return;
				}

				values[field.name] = coerceFieldValue(field, getWizardValueAtPath(parsed, field.path));
			});
			formValues = values;
		} catch (err) {
			if (err instanceof YAMLError) {
				yamlError = `YAML Syntax Error: ${err.message}`;
			} else {
				yamlError = 'Invalid YAML syntax';
			}
		}
	}

	function coerceFieldValue(field: TemplateField, value: unknown): unknown {
		return coerceWizardFieldValue(field, value);
	}

	function ensureTemplateField(field: TemplateField): TemplateField {
		const existingField = template.fields.find((candidate) => candidate.name === field.name);
		if (existingField) {
			return existingField;
		}

		template.fields = [...template.fields, field];
		return field;
	}

	function commitFieldValue(field: TemplateField) {
		const nextValue = coerceFieldValue(field, formValues[field.name]);
		formValues[field.name] = nextValue;
		handleFieldChange(field);
	}

	function setFieldValue(field: TemplateField, value: unknown) {
		formValues[field.name] =
			field.type === 'number' && typeof value === 'string' ? value : coerceFieldValue(field, value);
		handleFieldChange(field);
	}

	function setFieldValueByName(fieldName: string, value: unknown) {
		const targetField = template.fields.find((candidate) => candidate.name === fieldName);

		if (targetField) {
			setFieldValue(targetField, value);
			return;
		}

		logger.warn(
			`ResourceWizard: template field "${fieldName}" is missing from template.fields; using fallback validation flow`
		);
		const fallbackField = ensureTemplateField({
			name: fieldName,
			label: fieldName,
			path: fieldName,
			type: 'string'
		});
		setFieldValue(fallbackField, value);
	}

	function getSubmitValidationError(): string | null {
		if (yamlError) return yamlError;
		if (mode === 'wizard' && !validateForm()) {
			return 'Please fix validation errors before submitting';
		}
		return null;
	}

	function prepareWizardSubmission(): void {
		if (mode !== 'wizard') return;

		template.fields.forEach((field) => {
			if (field.type === 'number') commitFieldValue(field);
		});
		updateYamlFromForm();
	}

	async function createSubmittedResource(): Promise<Awaited<ReturnType<typeof createResourceFromWizard>>> {
		prepareWizardSubmission();
		const parsed = parse(currentYaml) as Record<string, unknown> & {
			metadata?: { namespace?: string; name?: string };
		};
		return createResourceFromWizard(template.plural, parsed, getCsrfToken());
	}

	function scheduleResourceRedirect(
		createdResource: Awaited<ReturnType<typeof createResourceFromWizard>>
	): void {
		setTimeout(() => {
			void goto(getWizardResourceRedirect(template.plural, createdResource));
		}, 1500);
	}

	async function handleSubmit() {
		const validationError = getSubmitValidationError();
		if (validationError) {
			error = validationError;
			return;
		}

		isSubmitting = true;
		error = null;

		try {
			const createdResource = await createSubmittedResource();

			success = true;
			scheduleResourceRedirect(createdResource);
		} catch (err) {
			error = (err as Error).message;
		} finally {
			isSubmitting = false;
		}
	}

	// Validate field on change
	function handleFieldChange(field: (typeof template.fields)[0]) {
		const error = validateField(field);
		if (error) {
			validationErrors[field.name] = error;
		} else {
			const rest = { ...validationErrors };
			delete rest[field.name];
			validationErrors = rest;
		}
	}

	function handleReferenceValueChange(
		field: (typeof template.fields)[0],
		nextValue: string,
		selection?: { namespace?: string }
	) {
		setFieldValue(field, nextValue);

		if (!field.referenceNamespaceField) return;
		if (selection?.namespace === undefined) return;

		const namespaceField = template.fields.find(
			(candidate) => candidate.name === field.referenceNamespaceField
		);
		if (namespaceField) {
			setFieldValue(namespaceField, selection.namespace);
		} else {
			setFieldValueByName(field.referenceNamespaceField, selection.namespace);
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
			logger.error(err, 'Failed to copy YAML:');
		}
	}

	// Check if a field should be visible based on its showIf condition
	function shouldShowField(field: (typeof template.fields)[0]): boolean {
		if (!field.showIf) return true;

		const dependentValue = formValues[field.showIf.field];
		const expectedValues = Array.isArray(field.showIf.value)
			? field.showIf.value
			: [field.showIf.value];

		return expectedValues.includes(String(dependentValue));
	}

	// Validate a single field
	function validateField(field: (typeof template.fields)[0]): string | null {
		return validateWizardField(field, formValues[field.name], shouldShowField(field));
	}

	// Validate all fields
	function validateForm(): boolean {
		const errors: Record<string, string> = {};

		template.fields.forEach((field) => {
			const error = validateField(field);
			if (error) {
				errors[field.name] = error;
			}
		});

		const resourceConflict = validateHelmReleaseResourceValues();
		if (resourceConflict) {
			for (const fieldName of [
				'resourceLimitsCpu',
				'resourceLimitsMemory',
				'resourceRequestsCpu',
				'resourceRequestsMemory'
			]) {
				if (formValues[fieldName]) {
					errors[fieldName] = resourceConflict;
				}
			}
		}

		validationErrors = errors;
		return Object.keys(errors).length === 0;
	}

	function validateHelmReleaseResourceValues(): string | null {
		return validateWizardHelmReleaseResourceValues(template, formValues);
	}

	// Check if form is valid (derived)
	const isFormValid = $derived.by(() => {
		if (yamlError) return false; // Invalid if YAML has syntax errors
		if (mode === 'yaml') return true; // Skip field validation in YAML mode
		return Object.keys(validationErrors).length === 0;
	});

	// Group fields by section
	const fieldsBySection = $derived.by(() => {
		if (!template.sections) {
			return { '': template.fields };
		}

		const grouped: Record<string, typeof template.fields> = {};
		template.sections.forEach((section) => {
			grouped[section.id] = template.fields.filter((f) => f.section === section.id);
		});

		// Add fields without section to default group
		const unsectioned = template.fields.filter((f) => !f.section);
		if (unsectioned.length > 0) {
			grouped[''] = unsectioned;
		}

		return grouped;
	});
</script>

<div class="flex flex-col gap-6">
	<WizardHeader {template} {mode} onToggleMode={toggleMode} />

	<!-- Content -->
	<div class="grid gap-8 lg:grid-cols-[1fr_400px]">
		<!-- Primary Content -->
		<WizardContent
			{mode}
			{template}
			{fieldsBySection}
			{expandedSections}
			{formValues}
			{validationErrors}
			{shouldShowField}
			bind:currentYaml
			{copySuccess}
			yamlError={yamlError}
			onCopy={copyYaml}
			onToggleSection={toggleSection}
			onSetFieldValue={setFieldValue}
			onReferenceValueChange={handleReferenceValueChange}
			onCommit={commitFieldValue}
		/>

		<!-- Sidebar / Preview -->
		<WizardPreview
			{template}
			{mode}
			{isSubmitting}
			{success}
			{isFormValid}
			{error}
			onSubmit={handleSubmit}
		/>
	</div>
</div>
