/**
 * Sanitizes a Kubernetes resource by removing internal metadata that should not be visible to users.
 * Specifically removes managedFields (FieldsV1) and other internal fields.
 */
export function sanitizeResource<T>(resource: T): T {
	if (!resource || typeof resource !== 'object') return resource;

	// Deep clone to avoid mutating the original object
	const sanitized = JSON.parse(JSON.stringify(resource));

	if (sanitized.metadata) {
		// Remove managedFields which contains FieldsV1 metadata (Issue #94)
		delete sanitized.metadata.managedFields;
	}

	return sanitized as T;
}
