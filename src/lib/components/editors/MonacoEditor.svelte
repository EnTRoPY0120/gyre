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
						// IMPORTANT: Keep this version in sync with package.json "monaco-editor" version
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

				// Listen for content changes and store disposable
				contentChangeDisposable = editor.onDidChangeModelContent(() => {
					if (!editor) return;
					const currentValue = editor.getValue();
					value = currentValue;
					onChange?.(currentValue);
				});

				// Listen for validation markers and store disposable
				if (onValidation) {
					markersDisposable = monaco.editor.onDidChangeMarkers((uris) => {
						if (!editor || !monaco) return;
						const model = editor.getModel();
						if (!model || !uris.some((uri) => uri.toString() === model.uri.toString())) return;

						const markers = monaco.editor.getModelMarkers({ resource: model.uri });
						onValidation(markers);
					});
				}

				loading = false;
				onReady?.();
			} catch (err) {
				console.error('Failed to load Monaco Editor:', err);
				error = err instanceof Error ? err.message : 'Failed to load editor';
				showFallback = true;
				loading = false;
			}
		})();

		// Cleanup on unmount
		return () => {
			contentChangeDisposable?.dispose();
			markersDisposable?.dispose();
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
	<div class="h-full w-full" class:hidden={!loading && !showFallback}>
		<textarea
			bind:value
			oninput={handleTextareaChange}
			{readonly}
			spellcheck="false"
			class="h-full w-full resize-none rounded-lg border border-zinc-800 bg-zinc-950 p-4 font-mono text-sm text-zinc-300 transition-all focus:border-amber-500/50 focus:ring-1 focus:ring-amber-500/20 focus:outline-none"
			placeholder="Enter {language.toUpperCase()} content..."
		></textarea>

		{#if loading}
			<div
				class="absolute inset-0 flex items-center justify-center rounded-lg bg-zinc-950/50 backdrop-blur-[2px]"
			>
				<div class="flex flex-col items-center gap-3">
					<div
						class="h-8 w-8 animate-spin rounded-full border-2 border-zinc-800 border-t-amber-500"
					></div>
					<p class="text-xs font-medium tracking-widest text-zinc-500 uppercase">
						Initialising Editor
					</p>
				</div>
			</div>
		{:else if error}
			<div
				class="absolute top-2 right-2 flex items-center gap-2 rounded border border-red-500/20 bg-red-500/10 px-2 py-1 text-[10px] font-medium text-red-400"
			>
				<span>Basic Mode</span>
				<span class="opacity-50">|</span>
				<span>{error}</span>
			</div>
		{/if}
	</div>

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
