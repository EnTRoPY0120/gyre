import type * as Monaco from 'monaco-editor';
import { validateFluxYaml } from './flux-yaml-validation';

const OWNER = 'flux-schema';
const DEBOUNCE_MS = 400;

/**
 * Register per-editor FluxCD semantic validation.
 * Validates immediately and re-validates on every content change (debounced).
 * Returns a disposable to cancel validation when the editor is torn down.
 */
export function registerFluxValidation(
	monacoInstance: typeof Monaco,
	editor: Monaco.editor.IStandaloneCodeEditor
): Monaco.IDisposable {
	let timer: ReturnType<typeof setTimeout> | undefined;

	const run = () => {
		const model = editor.getModel();
		if (!model) return;

		if (model.getLanguageId() !== 'yaml') {
			monacoInstance.editor.setModelMarkers(model, OWNER, []);
			return;
		}

		const markers = validateFluxYaml(model.getValue(), monacoInstance.MarkerSeverity);
		monacoInstance.editor.setModelMarkers(model, OWNER, markers);
	};

	run();

	const subscription = editor.onDidChangeModelContent(() => {
		if (timer) clearTimeout(timer);
		timer = setTimeout(run, DEBOUNCE_MS);
	});

	return {
		dispose: () => {
			if (timer) clearTimeout(timer);
			subscription.dispose();
		}
	};
}
