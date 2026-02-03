/**
 * Download a string as a file
 */
export function downloadFile(content: string, filename: string, contentType: string = 'text/yaml') {
	const blob = new Blob([content], { type: contentType });
	const url = URL.createObjectURL(blob);
	const link = document.createElement('a');
	link.href = url;
	link.download = filename;
	document.body.appendChild(link);
	link.click();
	document.body.removeChild(link);
	URL.revokeObjectURL(url);
}

/**
 * Format a resource for export (removing sensitive or unnecessary fields)
 */
export function formatResourceForExport(resource: any, format: 'yaml' | 'json' = 'yaml') {
	// Deep clone
	const exported = JSON.parse(JSON.stringify(resource));

	// Remove managed fields and status for a cleaner export
	delete exported.metadata.managedFields;
	delete exported.status;
	
	// Keep uid, generation, etc? Usually better to remove for portability
	delete exported.metadata.uid;
	delete exported.metadata.resourceVersion;
	delete exported.metadata.creationTimestamp;
	delete exported.metadata.generation;

	if (format === 'json') {
		return JSON.stringify(exported, null, 2);
	}
	
	// For YAML, we'd ideally use a library like js-yaml, 
	// but we can return JSON and handle it or use a simple stringify if needed.
	// Actually, the app already uses JSON for display in most places.
	return exported;
}
