<script lang="ts">
	import { onMount } from 'svelte';
	import { browser } from '$app/environment';
	import { theme } from '$lib/stores/theme.svelte';
	import type * as Monaco from 'monaco-editor';

	// Props
	interface Props {
		original: string;
		modified: string;
		language?: 'yaml' | 'json';
		readonly?: boolean;
		height?: string;
		minimap?: boolean;
		lineNumbers?: 'on' | 'off';
		className?: string;
	}

	let {
		original = '',
		modified = '',
		language = 'yaml',
		readonly = true,
		height = '400px',
		minimap = false,
		lineNumbers = 'on',
		className = ''
	}: Props = $props();

	// State
	let containerEl: HTMLDivElement | undefined = $state();
	let diffEditor: Monaco.editor.IStandaloneDiffEditor | undefined = $state();
	let monaco: typeof Monaco | undefined = $state();
	let originalModel: Monaco.editor.ITextModel | undefined = $state();
	let modifiedModel: Monaco.editor.ITextModel | undefined = $state();
	let loading = $state(true);
	let error = $state<string | null>(null);

	// Initialize Monaco Diff Editor
	onMount(() => {
		if (!browser || !containerEl) return;

		(async () => {
			try {
				const monacoModule = await import('monaco-editor');
				monaco = monacoModule;

				// Configure Monaco environment if not already done
				if (!self.MonacoEnvironment) {
					self.MonacoEnvironment = {
						getWorkerUrl: function (_moduleId: string, label: string) {
							const version = '0.55.1';
							const base = `https://cdn.jsdelivr.net/npm/monaco-editor@${version}/min/vs`;
							if (label === 'json') return `${base}/language/json/json.worker.js`;
							return `${base}/editor/editor.worker.js`;
						}
					};
				}

				// Create diff editor instance
				diffEditor = monaco.editor.createDiffEditor(containerEl, {
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
					renderLineHighlight: 'all',
					scrollbar: {
						vertical: 'visible',
						horizontal: 'visible',
						useShadows: false,
						verticalScrollbarSize: 10,
						horizontalScrollbarSize: 10
					},
					originalEditable: false,
					renderSideBySide: true
				});

				// Create models and store references for cleanup
				originalModel = monaco.editor.createModel(original, language);
				modifiedModel = monaco.editor.createModel(modified, language);

				diffEditor.setModel({
					original: originalModel,
					modified: modifiedModel
				});

				loading = false;
			} catch (err) {
				console.error('Failed to load Monaco Diff Editor:', err);
				error = err instanceof Error ? err.message : 'Failed to load diff editor';
				loading = false;
			}
		})();

		// Cleanup on unmount
		return () => {
			// Dispose models and editor
			originalModel?.dispose();
			modifiedModel?.dispose();
			diffEditor?.dispose();
		};
	});

	// Update models when props change
	$effect(() => {
		if (!diffEditor || !monaco) return;

		const models = diffEditor.getModel();
		if (models) {
			if (original !== models.original.getValue()) {
				models.original.setValue(original);
			}
			if (modified !== models.modified.getValue()) {
				models.modified.setValue(modified);
			}
		}
	});

	// Update theme when it changes
	$effect(() => {
		if (!monaco || !diffEditor) return;
		const monacoTheme = theme.resolvedTheme === 'dark' ? 'vs-dark' : 'vs-light';
		monaco.editor.setTheme(monacoTheme);
	});

	// Update readonly state when it changes
	$effect(() => {
		if (!diffEditor) return;
		diffEditor.updateOptions({ readOnly: readonly });
	});
</script>

<div class="monaco-diff-editor-wrapper {className}" style="height: {height}">
	{#if loading}
		<div
			class="absolute inset-0 z-10 flex items-center justify-center rounded-lg bg-zinc-950/50 backdrop-blur-[2px]"
		>
			<div class="flex flex-col items-center gap-3">
				<div
					class="h-8 w-8 animate-spin rounded-full border-2 border-zinc-800 border-t-amber-500"
				></div>
				<p class="text-xs font-medium tracking-widest text-zinc-500 uppercase">
					Initialising Diff Editor
				</p>
			</div>
		</div>
	{:else if error}
		<div
			class="flex h-full items-center justify-center rounded-lg border border-red-500/20 bg-red-500/5 p-8 text-center"
		>
			<div class="max-w-md space-y-2">
				<p class="text-sm font-semibold text-red-400">Failed to load diff editor</p>
				<p class="text-xs text-red-300/70">{error}</p>
			</div>
		</div>
	{/if}

	<div
		bind:this={containerEl}
		class="monaco-container h-full overflow-hidden rounded-lg"
		class:hidden={loading || error}
	></div>
</div>

<style>
	.monaco-diff-editor-wrapper {
		position: relative;
		width: 100%;
	}

	.monaco-container {
		width: 100%;
		height: 100%;
	}

	:global(.monaco-diff-editor .monaco-editor) {
		--vscode-editor-background: transparent !important;
		--vscode-editorGutter-background: transparent !important;
	}
</style>
