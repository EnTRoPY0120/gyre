import { describe, expect, test } from 'vitest';
import { getCodeViewerDownload } from '../lib/components/common/code-viewer-download.js';

const resource = {
	apiVersion: 'v1',
	kind: 'ConfigMap',
	metadata: {
		name: 'settings',
		uid: 'remove-me',
		resourceVersion: 'remove-me-too'
	},
	data: { mode: 'safe' },
	status: { ready: true }
};

describe('getCodeViewerDownload', () => {
	test('builds a sanitized JSON download', () => {
		expect(getCodeViewerDownload(resource, 'json')).toEqual({
			content:
				'{\n  "apiVersion": "v1",\n  "kind": "ConfigMap",\n  "metadata": {\n    "name": "settings"\n  },\n  "data": {\n    "mode": "safe"\n  }\n}',
			filename: 'settings.json',
			contentType: 'application/json'
		});
	});

	test('builds a YAML download and uses a fallback name', () => {
		const download = getCodeViewerDownload({ ...resource, metadata: {} }, 'yaml');

		expect(download.filename).toBe('resource.yaml');
		expect(download.contentType).toBe('text/yaml');
		expect(download.content).toContain('kind: ConfigMap');
		expect(download.content).not.toContain('status:');
	});
});
