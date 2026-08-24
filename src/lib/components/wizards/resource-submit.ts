export interface CreatedResource {
	metadata?: { namespace?: string; name?: string };
}

/** Create a resource from the wizard manifest and normalize API failures. */
export async function createResourceFromWizard(
	plural: string,
	manifest: Record<string, unknown>,
	csrfToken: string,
	fetcher: typeof fetch = fetch
): Promise<CreatedResource> {
	const response = await fetcher(`/api/v1/flux/${plural}`, {
		method: 'POST',
		headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrfToken },
		body: JSON.stringify(manifest)
	});

	if (!response.ok) {
		const data = (await response.json().catch(() => null)) as { message?: unknown } | null;
		const message = typeof data?.message === 'string' ? data.message : 'Failed to create resource';
		throw new Error(message);
	}

	return (await response.json()) as CreatedResource;
}
