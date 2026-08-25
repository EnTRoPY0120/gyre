import tailwindcss from '@tailwindcss/vite';
import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig, loadEnv } from 'vite';

const VENDOR_CHUNK_RULES = [
	['monaco-editor', 'monaco-editor'],
	['@lucide/svelte', 'vendor-icons'],
	['bits-ui', 'vendor-ui'],
	['/svelte/', 'vendor-svelte'],
	['@sveltejs', 'vendor-svelte'],
	['drizzle-orm', 'vendor-db'],
	['yaml', 'vendor-yaml'],
	['js-yaml', 'vendor-yaml']
] as const;

function getVendorChunk(id: string): string | undefined {
	if (!id.includes('node_modules')) return;

	return VENDOR_CHUNK_RULES.find(([dependency]) => id.includes(dependency))?.[1] ?? 'vendor';
}

export default defineConfig(({ mode }) => {
	// Load .env vars and inject them into process.env so server-side code
	// that reads process.env directly (e.g. backup.ts, auth/crypto.ts) works
	// the same way in dev as it does in production/Kubernetes.
	const env = loadEnv(mode, process.cwd(), '');
	Object.assign(process.env, env);

	return {
		plugins: [tailwindcss(), sveltekit()],
		test: {
			environment: 'node',
			include: ['src/tests/**/*.test.ts'],
			fileParallelism: false,
			isolate: true
		},
		server: {
			fs: {
				// Allow Vite dev server to serve files from the project root so that
				// server-side modules (e.g. kubeconfig files, test fixtures) resolved
				// relative to process.cwd() are reachable during development.
				allow: ['.']
			}
		},
		optimizeDeps: {
			include: ['monaco-editor'],
			rolldownOptions: {
				// Ensure monaco-editor is fully tree-shaken during pre-bundling
				treeshake: true
			}
		},
		build: {
			sourcemap: false, // never emit .map files in production — avoids exposing source paths and pre-minified logic
			reportCompressedSize: true,
			// Monaco is intentionally lazy-loaded and emitted as its own large editor chunk.
			chunkSizeWarningLimit: 4300,
			rolldownOptions: {
				output: {
					manualChunks: getVendorChunk
				}
			}
		}
	};
});
