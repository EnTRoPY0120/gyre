export function importFresh<TModule>(path: string): Promise<TModule> {
	const moduleUrl = new URL(path, new URL('../', import.meta.url));
	moduleUrl.searchParams.set('case', `${Date.now()}-${Math.random()}`);
	return import(moduleUrl.href) as Promise<TModule>;
}
