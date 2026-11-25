// See https://svelte.dev/docs/kit/types#app.d.ts
// for information about these interfaces
declare global {
	namespace App {
		interface Error {
			message: string;
			code?: string;
			status: number;
		}
		interface Locals {
			requestId: string;
			/** Canonical cluster ID: "in-cluster" or an uploaded clusters.id value. */
			cluster: import('#lib/clusters/identity.js').ClusterId | undefined;
			user: import('#lib/server/db/schema.js').User | null;
			session: import('#lib/server/db/schema.js').Session | null;
		}
		// interface PageData {}
		// interface PageState {}
		// interface Platform {}
	}
}

export {};
