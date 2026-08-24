import { isMap, isPair, isScalar, parseDocument } from 'yaml';
import type { Pair, Scalar, YAMLMap } from 'yaml';
import type * as Monaco from 'monaco-editor';
import {
	DURATION_PATTERN,
	KIND_API_VERSIONS,
	KIND_REQUIRED_SPEC,
	KIND_SPEC_ENUMS,
	SPEC_BOOLEAN_FIELDS,
	SPEC_DURATION_FIELDS
} from './fluxSchemas';

export type FluxMarkerSeverity = {
	Error: number;
	Warning: number;
};

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

function validateBooleanField(
	item: Pair,
	key: string,
	content: string,
	markers: Monaco.editor.IMarkerData[],
	errorSeverity: number
): void {
	if (!SPEC_BOOLEAN_FIELDS.has(key)) return;

	if (!isScalar(item.value)) {
		const marker = pairKeyMarker(
			content,
			item,
			`"${key}" must be a boolean (true or false)`,
			errorSeverity
		);
		if (marker) markers.push(marker);
	} else if (typeof item.value.value !== 'boolean') {
		markers.push(
			scalarMarker(
				content,
				item.value,
				`"${key}" must be a boolean (true or false), got: ${JSON.stringify(item.value.value)}`,
				errorSeverity
			)
		);
	}
}

function validateDurationField(
	item: Pair,
	key: string,
	content: string,
	markers: Monaco.editor.IMarkerData[],
	errorSeverity: number
): void {
	if (!SPEC_DURATION_FIELDS.has(key)) return;

	if (!isScalar(item.value)) {
		const marker = pairKeyMarker(
			content,
			item,
			`"${key}" must be a duration string (e.g., 30s, 5m, 1h30m)`,
			errorSeverity
		);
		if (marker) markers.push(marker);
		return;
	}

	const value = String(item.value.value ?? '');
	if (value && !DURATION_PATTERN.test(value)) {
		markers.push(
			scalarMarker(
				content,
				item.value,
				`"${key}" must be a duration string (e.g., 30s, 5m, 1h30m), got: "${value}"`,
				errorSeverity
			)
		);
	}
}

function validateEnumField(
	item: Pair,
	key: string,
	kind: string,
	fieldPath: string,
	content: string,
	markers: Monaco.editor.IMarkerData[],
	errorSeverity: number
): void {
	const enumValues = KIND_SPEC_ENUMS[`${kind}.${fieldPath}`];
	if (!enumValues) return;

	if (!isScalar(item.value)) {
		const marker = pairKeyMarker(
			content,
			item,
			`non-scalar value is not valid for enum field "${key}"`,
			errorSeverity
		);
		if (marker) markers.push(marker);
		return;
	}

	const value = String(item.value.value ?? '');
	if (value && !enumValues.includes(value)) {
		markers.push(
			scalarMarker(
				content,
				item.value,
				`"${value}" is not a valid value for "${key}". Valid values: ${enumValues.join(', ')}`,
				errorSeverity
			)
		);
	}
}

function validateSpecField(
	item: Pair,
	kind: string,
	fieldPath: string,
	content: string,
	markers: Monaco.editor.IMarkerData[],
	errorSeverity: number
): void {
	const key = String(item.key.value);
	validateBooleanField(item, key, content, markers, errorSeverity);
	validateDurationField(item, key, content, markers, errorSeverity);
	validateEnumField(item, key, kind, fieldPath, content, markers, errorSeverity);
}

function validateSpecMap(
	specMap: YAMLMap,
	kind: string,
	content: string,
	markers: Monaco.editor.IMarkerData[],
	errorSeverity: number,
	warnSeverity: number,
	specPair: Pair,
	parentPath = ''
): void {
	const presentKeys = new Set<string>();

	for (const item of specMap.items) {
		if (!isPair(item) || !isScalar(item.key)) continue;
		const key = String(item.key.value);
		presentKeys.add(key);

		const fieldPath = parentPath ? `${parentPath}.${key}` : key;
		validateSpecField(item, kind, fieldPath, content, markers, errorSeverity);

		if (isMap(item.value)) {
			validateSpecMap(
				item.value,
				kind,
				content,
				markers,
				errorSeverity,
				warnSeverity,
				specPair,
				fieldPath
			);
		}
	}

	if (!parentPath) {
		for (const required of KIND_REQUIRED_SPEC[kind] ?? []) {
			if (presentKeys.has(required)) continue;
			const marker = pairKeyMarker(
				content,
				specPair,
				`Missing required spec field: "${required}"`,
				warnSeverity
			);
			if (marker) markers.push(marker);
		}
	}
}

type ManifestFields = {
	apiVersion?: string;
	kind?: string;
	apiVersionPair?: Pair;
	specPair?: Pair;
	metadataPair?: Pair;
};

function collectManifestFields(root: YAMLMap): ManifestFields {
	const fields: ManifestFields = {};

	for (const item of root.items) {
		if (!isPair(item) || !isScalar(item.key)) continue;
		const key = String(item.key.value);

		if (key === 'apiVersion' && isScalar(item.value)) {
			fields.apiVersion = String(item.value.value ?? '');
			fields.apiVersionPair = item;
		} else if (key === 'kind' && isScalar(item.value)) {
			fields.kind = String(item.value.value ?? '');
		} else if (key === 'spec') {
			fields.specPair = item;
		} else if (key === 'metadata') {
			fields.metadataPair = item;
		}
	}

	return fields;
}

function validateApiVersion(
	content: string,
	fields: ManifestFields,
	markers: Monaco.editor.IMarkerData[],
	severity: FluxMarkerSeverity
): void {
	if (!fields.kind || !fields.apiVersion || !fields.apiVersionPair) return;
	if (!isScalar(fields.apiVersionPair.value)) return;

	const validVersions = KIND_API_VERSIONS[fields.kind];
	if (validVersions.includes(fields.apiVersion)) return;

	markers.push(
		scalarMarker(
			content,
			fields.apiVersionPair.value,
			`Invalid apiVersion "${fields.apiVersion}" for kind "${fields.kind}". Expected one of: ${validVersions.join(', ')}`,
			severity.Error
		)
	);
}

function validateMetadata(
	content: string,
	metadataPair: Pair | undefined,
	markers: Monaco.editor.IMarkerData[],
	severity: FluxMarkerSeverity
): void {
	if (!metadataPair) {
		markers.push(makeMarker(1, 1, 1, 2, 'Missing required field: "metadata"', severity.Warning));
		return;
	}

	if (!isMap(metadataPair.value)) {
		const marker = pairKeyMarker(content, metadataPair, '"metadata" must be a map', severity.Error);
		if (marker) markers.push(marker);
		return;
	}

	const hasName = metadataPair.value.items.some(
		(pair) => isPair(pair) && isScalar(pair.key) && pair.key.value === 'name'
	);
	if (hasName) return;

	const marker = pairKeyMarker(
		content,
		metadataPair,
		'Missing required field: "name" in metadata',
		severity.Warning
	);
	if (marker) markers.push(marker);
}

function validateSpec(
	content: string,
	kind: string,
	specPair: Pair | undefined,
	markers: Monaco.editor.IMarkerData[],
	severity: FluxMarkerSeverity
): void {
	if (!specPair) {
		markers.push(makeMarker(1, 1, 1, 2, 'Missing required field: "spec"', severity.Warning));
		return;
	}

	if (!isMap(specPair.value)) {
		const marker = pairKeyMarker(content, specPair, '"spec" must be a map', severity.Error);
		if (marker) markers.push(marker);
		return;
	}

	validateSpecMap(
		specPair.value,
		kind,
		content,
		markers,
		severity.Error,
		severity.Warning,
		specPair
	);
}

export function validateFluxYaml(
	content: string,
	severity: FluxMarkerSeverity
): Monaco.editor.IMarkerData[] {
	const markers: Monaco.editor.IMarkerData[] = [];
	if (!content.trim()) return markers;

	let document;
	try {
		document = parseDocument(content, { logLevel: 'silent' });
	} catch {
		return markers;
	}

	if (document.errors && document.errors.length > 0) return markers;
	if (!isMap(document.contents)) return markers;

	const fields = collectManifestFields(document.contents);
	if (!fields.kind || !KIND_API_VERSIONS[fields.kind]) return markers;

	validateApiVersion(content, fields, markers, severity);
	validateMetadata(content, fields.metadataPair, markers, severity);
	validateSpec(content, fields.kind, fields.specPair, markers, severity);

	return markers;
}
