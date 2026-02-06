<script lang="ts">
	import { onMount } from 'svelte';
	import { browser } from '$app/environment';
	import { theme } from '$lib/stores/theme.svelte';
	import type * as Monaco from 'monaco-editor';

	// Props
	interface Props {
		value: string;
		language?: 'yaml' | 'json';
		readonly?: boolean;
		height?: string;
		minimap?: boolean;
		lineNumbers?: 'on' | 'off';
		onChange?: (value: string) => void;
		onValidation?: (errors: any[]) => void;
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
		className = ''
	}: Props = $props();

	// State
	let containerEl: HTMLDivElement | undefined = $state();
	let editor: Monaco.editor.IStandaloneCodeEditor | undefined = $state();
	let monaco: typeof Monaco | undefined = $state();
	let loading = $state(true);
	let error = $state<string | null>(null);

	// Fallback to textarea if Monaco fails to load
	let showFallback = $state(false);

	// Initialize Monaco Editor
	onMount(() => {
		if (!browser || !containerEl) return;

		(async () => {
			try {
			// Dynamically import Monaco to avoid SSR issues
			const monacoModule = await import('monaco-editor');
			monaco = monacoModule;

			// Configure Monaco environment - use CDN for workers in production
			self.MonacoEnvironment = {
				getWorkerUrl: function (_moduleId: string, label: string) {
					// Use jsdelivr CDN for workers to avoid bundling issues
					const version = '0.55.1'; // Match installed version
					const base = `https://cdn.jsdelivr.net/npm/monaco-editor@${version}/min/vs`;
					if (label === 'json') {
						return `${base}/language/json/json.worker.js`;
					}
					if (label === 'css' || label === 'scss' || label === 'less') {
						return `${base}/language/css/css.worker.js`;
					}
					if (label === 'html' || label === 'handlebars' || label === 'razor') {
						return `${base}/language/html/html.worker.js`;
					}
					if (label === 'typescript' || label === 'javascript') {
						return `${base}/language/typescript/ts.worker.js`;
					}
					return `${base}/editor/editor.worker.js`;
				}
			};

			// Create editor instance
			editor = monaco.editor.create(containerEl, {
				value: value,
				language: language,
				theme: theme.resolvedTheme === 'dark' ? 'vs-dark' : 'vs-light',
				readOnly: readonly,
				automaticLayout: true,
				minimap: { enabled: minimap },
				lineNumbers: lineNumbers,
				scrollBeyondLastLine: false,
				fontSize: 14,
				fontFamily: 'JetBrains Mono, monospace',
				wordWrap: 'on',
				wrappingIndent: 'indent',
				tabSize: 2,
				insertSpaces: true
			});

			// Listen for content changes
			editor.onDidChangeModelContent(() => {
				if (!editor) return;
				const currentValue = editor.getValue();
				value = currentValue;
				onChange?.(currentValue);
			});

			// Listen for validation markers
			if (onValidation) {
				monaco.editor.onDidChangeMarkers((uris) => {
					if (!editor || !monaco) return;
					const model = editor.getModel();
					if (!model || !uris.some((uri) => uri.toString() === model.uri.toString())) return;

					const markers = monaco.editor.getModelMarkers({ resource: model.uri });
					onValidation(markers);
				});
			}

			loading = false;
		} catch (err) {
			console.error('Failed to load Monaco Editor:', err);
			error = err instanceof Error ? err.message : 'Failed to load editor';
			showFallback = true;
			loading = false;
		}
		})();

		// Cleanup on unmount
		return () => {
			editor?.dispose();
		};
	});

	// Update editor value when prop changes externally
	$effect(() => {
		if (!editor || !monaco) return;

		const currentValue = editor.getValue();
		if (value !== currentValue) {
			// Preserve cursor position and scroll
			const position = editor.getPosition();
			const scrollTop = editor.getScrollTop();

			editor.setValue(value);

			if (position) {
				editor.setPosition(position);
			}
			editor.setScrollTop(scrollTop);
		}
	});

	// Update theme when it changes
	$effect(() => {
		if (!monaco || !editor) return;
		const monacoTheme = theme.resolvedTheme === 'dark' ? 'vs-dark' : 'vs-light';
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

	// Fallback textarea handlers
	function handleTextareaChange(e: Event) {
		const target = e.target as HTMLTextAreaElement;
		value = target.value;
		onChange?.(target.value);
	}
</script>

<div class="monaco-editor-wrapper {className}" style="height: {height}">
	{#if loading}
		<div class="flex items-center justify-center h-full bg-zinc-900 rounded">
			<div class="flex flex-col items-center gap-2">
				<div class="animate-spin rounded-full h-8 w-8 border-b-2 border-amber-500"></div>
				<p class="text-sm text-zinc-400">Loading editor...</p>
			</div>
		</div>
	{:else if showFallback}
		<div class="fallback-editor h-full">
			<textarea
				bind:value
				oninput={handleTextareaChange}
				{readonly}
				class="w-full h-full p-4 bg-zinc-900 text-zinc-100 font-mono text-sm rounded border border-zinc-700 focus:border-amber-500 focus:outline-none resize-none"
				placeholder="Enter {language.toUpperCase()} content..."
			></textarea>
			{#if error}
				<p class="text-xs text-red-400 mt-1">Editor failed to load: {error}</p>
			{/if}
		</div>
	{:else}
		<div bind:this={containerEl} class="monaco-container h-full rounded overflow-hidden"></div>
	{/if}
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

	.fallback-editor {
		width: 100%;
	}
</style>
