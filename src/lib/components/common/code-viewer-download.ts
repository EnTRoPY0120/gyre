import { toYaml } from '$lib/utils/format';
import { formatResourceForExport } from '$lib/utils/export';

export type CodeViewerFormat = 'yaml' | 'json';

export interface CodeViewerDownload {
	content: string;
	filename: string;
	contentType: string;
}

export function getCodeViewerDownload(
	data: Record<string, unknown>,
	format: CodeViewerFormat
): CodeViewerDownload {
	const exported = formatResourceForExport(data, format);
	const content = format === 'json' ? exported : toYaml(exported);
	const metadata = data.metadata as { name?: string } | undefined;
	const name = metadata?.name || 'resource';

	return {
		content,
		filename: `${name}.${format}`,
		contentType: format === 'json' ? 'application/json' : 'text/yaml'
	};
}
