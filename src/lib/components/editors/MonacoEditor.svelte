<script lang="ts">
import { onMount } from 'svelte';
import { browser } from '$app/environment';
import { theme } from '$lib/stores/theme.svelte';
import { logger } from '$lib/utils/logger.js';
import type * as Monaco from 'monaco-editor';
import { defineMonacoThemes } from './monacoTheme';
import { registerFluxLanguageFeatures } from './fluxCompletions';
import { registerFluxValidation } from './yamlValidator';
import MonacoEditorFallback from './MonacoEditorFallback.svelte';
import { getMonacoWorker } from './monaco-workers';
import { syncEditorValue } from './monaco-value-sync';

	// Props
	interface Props {
		value: string;
		language?: 'yaml' | 'json';
		readonly?: boolean;
		height?: string;
		minimap?: boolean;
		lineNumbers?: 'on' | 'off';
		onChange?: (value: string) => void;
		onValidation?: (errors: Monaco.editor.IMarker[]) => void;
		onReady?: () => void;
		className?: string;
	}

	let {
		value = $bindable(''),
		language = 'yaml',
		readonly = false,
		height = '400px',
		minimap = false,
		lineNumbers = 'on',
		onChange,
		onValidation,
		onReady,
		className = ''
	}: Props = $props();

	// State
	let containerEl: HTMLDivElement | undefined = $state();
	let editor: Monaco.editor.IStandaloneCodeEditor | undefined = $state();
	let monaco: typeof Monaco | undefined = $state();
	let loading = $state(true);
	let error = $state<string | null>(null);

	// Fallback to textarea if Monaco fails to load or while it's loading
	let showFallback = $state(false);

	// Store disposables for cleanup
	let contentChangeDisposable: Monaco.IDisposable | undefined = $state();
	let markersDisposable: Monaco.IDisposable | undefined = $state();
	let fluxValidationDisposable: Monaco.IDisposable | undefined = $state();

	function createEditorInstance(
		monacoModule: typeof Monaco,
		container: HTMLDivElement
	): Monaco.editor.IStandaloneCodeEditor {
		return monacoModule.editor.create(container, {
			value,
			language,
			theme: theme.resolvedTheme === 'dark' ? 'gyre-dark' : 'gyre-light',
			readOnly: readonly,
			automaticLayout: true,
			minimap: { enabled: minimap },
			lineNumbers,
			scrollBeyondLastLine: false,
			fontSize: 14,
			lineHeight: 22,
			fontFamily:
				"'JetBrains Mono', 'Fira Code', 'Source Code Pro', 'Menlo', 'Monaco', 'Consolas', 'Courier New', monospace",
			fontLigatures: true,
			wordWrap: 'on',
			wrappingIndent: 'indent',
			tabSize: 2,
			insertSpaces: true,
			padding: { top: 12, bottom: 12 },
			cursorBlinking: 'smooth',
			cursorSmoothCaretAnimation: 'on',
			smoothScrolling: true,
			renderLineHighlight: 'all',
			roundedSelection: true,
			scrollbar: {
				vertical: 'visible',
				horizontal: 'visible',
				useShadows: false,
				verticalScrollbarSize: 10,
				horizontalScrollbarSize: 10
			}
		});
	}

	function registerContentChangeListener(editorInstance: Monaco.editor.IStandaloneCodeEditor): void {
		contentChangeDisposable = editorInstance.onDidChangeModelContent(() => {
			const currentValue = editorInstance.getValue();
			value = currentValue;
			onChange?.(currentValue);
		});
	}

	function registerMarkerListener(
		monacoModule: typeof Monaco,
		editorInstance: Monaco.editor.IStandaloneCodeEditor
	): void {
		if (!onValidation) return;

		markersDisposable = monacoModule.editor.onDidChangeMarkers((uris) => {
			const model = editorInstance.getModel();
			if (!model || !uris.some((uri) => uri.toString() === model.uri.toString())) return;

			onValidation(monacoModule.editor.getModelMarkers({ resource: model.uri }));
		});
	}

	// fallow-ignore-next-line complexity
	async function initializeEditor(container: HTMLDivElement): Promise<void> {
		try {
			const monacoModule = await import('monaco-editor');
			monaco = monacoModule;

			defineMonacoThemes(monacoModule);
			registerFluxLanguageFeatures(monacoModule);
			self.MonacoEnvironment = { getWorker: getMonacoWorker };

			editor = createEditorInstance(monacoModule, container);
			fluxValidationDisposable = registerFluxValidation(monacoModule, editor);
			registerContentChangeListener(editor);
			registerMarkerListener(monacoModule, editor);

			loading = false;
			onReady?.();
		} catch (err) {
			logger.error(err, 'Failed to load Monaco Editor:');
			error = err instanceof Error ? err.message : 'Failed to load editor';
			showFallback = true;
			loading = false;
			onReady?.();
		}
	}

	function disposeEditor(): void {
		contentChangeDisposable?.dispose();
		markersDisposable?.dispose();
		fluxValidationDisposable?.dispose();
		editor?.dispose();
	}

	// Initialize Monaco Editor
	onMount(() => {
		if (!browser || !containerEl) return;

		void initializeEditor(containerEl);

		// Cleanup on unmount
		return disposeEditor;
	});

	// Update editor value when prop changes externally
	$effect(() => {
		if (editor) syncEditorValue(editor, value);
	});

	// Update theme when it changes
	$effect(() => {
		if (!monaco || !editor) return;
		const monacoTheme = theme.resolvedTheme === 'dark' ? 'gyre-dark' : 'gyre-light';
		monaco.editor.setTheme(monacoTheme);
	});

	// Update language when it changes
	$effect(() => {
		if (!monaco || !editor) return;
		const model = editor.getModel();
		if (model) {
			monaco.editor.setModelLanguage(model, language);
		}
	});

	// Update readonly state when it changes
	$effect(() => {
		if (!editor) return;
		editor.updateOptions({ readOnly: readonly });
	});

</script>

<div class="monaco-editor-wrapper {className}" style="height: {height}">
	<MonacoEditorFallback
		bind:value
		{readonly}
		{loading}
		{showFallback}
		{error}
		{language}
		{onChange}
	/>

	<div
		bind:this={containerEl}
		class="monaco-container h-full overflow-hidden rounded-lg"
		class:hidden={loading || showFallback}
	></div>
</div>

<style>
	.monaco-editor-wrapper {
		position: relative;
		width: 100%;
	}

	.monaco-container {
		width: 100%;
		height: 100%;
	}

	:global(.monaco-editor) {
		--vscode-editor-background: transparent !important;
		--vscode-editorGutter-background: transparent !important;
	}
</style>
