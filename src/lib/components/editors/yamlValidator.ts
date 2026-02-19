import { parseDocument, isMap, isPair, isScalar } from 'yaml';
import type { Scalar, YAMLMap, Pair } from 'yaml';
import type * as Monaco from 'monaco-editor';
import {
	KIND_API_VERSIONS,
	KIND_REQUIRED_SPEC,
	KIND_SPEC_ENUMS,
	SPEC_BOOLEAN_FIELDS,
	SPEC_DURATION_FIELDS,
	DURATION_PATTERN
} from './fluxSchemas';

const OWNER = 'flux-schema';
const DEBOUNCE_MS = 400;

// Convert character offset in content to a 1-based [line, column] pair.
function offsetToPos(content: string, offset: number): [number, number] {
	const lines = content.substring(0, Math.max(0, offset)).split('\n');
	return [lines.length, lines[lines.length - 1].length + 1];
}

function makeMarker(
	sl: number,
	sc: number,
	el: number,
	ec: number,
	message: string,
	severity: number
): Monaco.editor.IMarkerData {
	return {
		severity,
		message,
		startLineNumber: sl,
		startColumn: sc,
		endLineNumber: el,
		endColumn: ec
	};
}

function scalarMarker(
	content: string,
	scalar: Scalar<unknown>,
	message: string,
	severity: number
): Monaco.editor.IMarkerData {
	const range = scalar.range;
	if (!range) return makeMarker(1, 1, 1, 2, message, severity);
	const [sl, sc] = offsetToPos(content, range[0]);
	const [el, ec] = offsetToPos(content, range[1]);
	return makeMarker(sl, sc, el, ec, message, severity);
}

function pairKeyMarker(
	content: string,
	pair: Pair,
	message: string,
	severity: number
): Monaco.editor.IMarkerData | null {
	if (!isScalar(pair.key) || !pair.key.range) return null;
	const [sl, sc] = offsetToPos(content, pair.key.range[0]);
	const [el, ec] = offsetToPos(content, pair.key.range[1]);
	return makeMarker(sl, sc, el, ec, message, severity);
}

function validateSpecMap(
	specMap: YAMLMap,
	kind: string,
	content: string,
	markers: Monaco.editor.IMarkerData[],
	errorSev: number,
	warnSev: number,
	specPair: Pair,
	parentPath = ''
): void {
	const presentKeys = new Set<string>();

	for (const item of specMap.items) {
		if (!isPair(item) || !isScalar(item.key)) continue;
		const key = String(item.key.value);
		presentKeys.add(key);

		const fieldPath = parentPath ? `${parentPath}.${key}` : key;

		// Boolean field validation
		if (SPEC_BOOLEAN_FIELDS.has(key)) {
			if (!isScalar(item.value)) {
				const m = pairKeyMarker(
					content,
					item,
					`"${key}" must be a boolean (true or false)`,
					errorSev
				);
				if (m) markers.push(m);
			} else if (typeof item.value.value !== 'boolean') {
				markers.push(
					scalarMarker(
						content,
						item.value,
						`"${key}" must be a boolean (true or false), got: ${JSON.stringify(item.value.value)}`,
						errorSev
					)
				);
			}
		}

		// Duration field validation
		if (SPEC_DURATION_FIELDS.has(key)) {
			if (!isScalar(item.value)) {
				const m = pairKeyMarker(
					content,
					item,
					`"${key}" must be a duration string (e.g., 30s, 5m, 1h30m)`,
					errorSev
				);
				if (m) markers.push(m);
			} else {
				const val = String(item.value.value ?? '');
				if (val && !DURATION_PATTERN.test(val)) {
					markers.push(
						scalarMarker(
							content,
							item.value,
							`"${key}" must be a duration string (e.g., 30s, 5m, 1h30m), got: "${val}"`,
							errorSev
						)
					);
				}
			}
		}

		// Enum validation
		const enumVals = KIND_SPEC_ENUMS[`${kind}.${fieldPath}`];
		if (enumVals) {
			if (!isScalar(item.value)) {
				const m = pairKeyMarker(
					content,
					item,
					`non-scalar value is not valid for enum field "${key}"`,
					errorSev
				);
				if (m) markers.push(m);
			} else {
				const val = String(item.value.value ?? '');
				if (val && !enumVals.includes(val)) {
					markers.push(
						scalarMarker(
							content,
							item.value,
							`"${val}" is not a valid value for "${key}". Valid values: ${enumVals.join(', ')}`,
							errorSev
						)
					);
				}
			}
		}

		// Recurse into nested maps (one level deep covers the common nested cases)
		if (isMap(item.value)) {
			validateSpecMap(item.value, kind, content, markers, errorSev, warnSev, specPair, fieldPath);
		}
	}

	// Only check required fields at spec root (parentPath === '')
	if (!parentPath) {
		for (const required of KIND_REQUIRED_SPEC[kind] ?? []) {
			if (!presentKeys.has(required)) {
				const m = pairKeyMarker(
					content,
					specPair,
					`Missing required spec field: "${required}"`,
					warnSev
				);
				if (m) markers.push(m);
			}
		}
	}
}

export function validateFluxYaml(
	content: string,
	monacoInstance: typeof Monaco
): Monaco.editor.IMarkerData[] {
	const markers: Monaco.editor.IMarkerData[] = [];
	if (!content.trim()) return markers;

	let doc;
	try {
		doc = parseDocument(content, { logLevel: 'silent' });
	} catch {
		return markers;
	}

	// Only do semantic validation on syntactically valid YAML
	if (doc.errors && doc.errors.length > 0) return markers;
	if (!isMap(doc.contents)) return markers;

	const root = doc.contents;
	const sev = monacoInstance.MarkerSeverity;

	let apiVersion: string | undefined;
	let kind: string | undefined;
	let apiVersionPair: Pair | undefined;
	let specPair: Pair | undefined;
	let metadataPair: Pair | undefined;

	for (const item of root.items) {
		if (!isPair(item) || !isScalar(item.key)) continue;
		const key = String(item.key.value);

		if (key === 'apiVersion' && isScalar(item.value)) {
			apiVersion = String(item.value.value ?? '');
			apiVersionPair = item;
		} else if (key === 'kind' && isScalar(item.value)) {
			kind = String(item.value.value ?? '');
		} else if (key === 'spec') {
			specPair = item;
		} else if (key === 'metadata') {
			metadataPair = item;
		}
	}

	// Only validate known FluxCD kinds
	if (!kind || !KIND_API_VERSIONS[kind]) return markers;

	// Validate apiVersion matches kind
	if (apiVersion && apiVersionPair && isScalar(apiVersionPair.value)) {
		const validVersions = KIND_API_VERSIONS[kind];
		if (!validVersions.includes(apiVersion)) {
			markers.push(
				scalarMarker(
					content,
					apiVersionPair.value,
					`Invalid apiVersion "${apiVersion}" for kind "${kind}". Expected one of: ${validVersions.join(', ')}`,
					sev.Error
				)
			);
		}
	}

	// Validate metadata
	if (!metadataPair) {
		markers.push(makeMarker(1, 1, 1, 2, 'Missing required field: "metadata"', sev.Warning));
	} else if (isMap(metadataPair.value)) {
		const hasName = metadataPair.value.items.some(
			(p) => isPair(p) && isScalar(p.key) && p.key.value === 'name'
		);
		if (!hasName) {
			const m = pairKeyMarker(
				content,
				metadataPair,
				'Missing required field: "name" in metadata',
				sev.Warning
			);
			if (m) markers.push(m);
		}
	} else {
		const m = pairKeyMarker(content, metadataPair, '"metadata" must be a map', sev.Error);
		if (m) markers.push(m);
	}

	// Validate spec
	if (!specPair) {
		markers.push(makeMarker(1, 1, 1, 2, 'Missing required field: "spec"', sev.Warning));
	} else if (isMap(specPair.value)) {
		validateSpecMap(specPair.value, kind, content, markers, sev.Error, sev.Warning, specPair);
	} else {
		const m = pairKeyMarker(content, specPair, '"spec" must be a map', sev.Error);
		if (m) markers.push(m);
	}

	return markers;
}

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

		const markers = validateFluxYaml(model.getValue(), monacoInstance);
		monacoInstance.editor.setModelMarkers(model, OWNER, markers);
	};

	run();

	return editor.onDidChangeModelContent(() => {
		if (timer) clearTimeout(timer);
		timer = setTimeout(run, DEBOUNCE_MS);
	});
}
