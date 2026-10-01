import { render } from 'svelte/server';
import { describe, expect, test } from 'vitest';
import ResourceDiffViewer from '../lib/components/flux/ResourceDiffViewer.svelte';
import { formatDiffExport } from '../lib/components/resources/tabs/diff-export.js';
import type { ResourceDiff } from '../lib/types/resource.js';

const failedDiff: ResourceDiff = {
	kind: 'ConfigMap',
	name: 'app-config',
	namespace: 'apps',
	desired: 'metadata:\n  name: app-config\n',
	live: null,
	error: 'server-side apply rejected: forbidden'
};

describe('failed drift preview presentation', () => {
	test('renders a visible failure state and the server error', () => {
		const { body } = render(ResourceDiffViewer, { props: { diffs: [failedDiff] } });

		expect(body).toContain('Preview failed');
		expect(body).toContain('Preview Failed');
		expect(body).toContain('Server-side dry-run failed: server-side apply rejected: forbidden');
		expect(body).not.toContain('New Resource');
	});

	test('includes preview errors in the exported drift report', () => {
		expect(formatDiffExport([failedDiff])).toContain(
			'Preview failed: server-side apply rejected: forbidden'
		);
	});
});
