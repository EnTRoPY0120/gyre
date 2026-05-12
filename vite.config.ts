/// <reference types="vitest/config" />

import tailwindcss from '@tailwindcss/vite';
import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig, loadEnv } from 'vite';

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
			globals: false,
			include: ['src/tests/**/*.test.ts']
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
			rolldownOptions: {
				output: {
					manualChunks: (id) => {
						if (id.includes('node_modules')) {
							if (id.includes('monaco-editor')) return 'monaco-editor';
							if (id.includes('lucide-svelte')) return 'vendor-icons';
							if (id.includes('drizzle-orm')) return 'vendor-db';
							return 'vendor';
						}
					}
				}
			}
		}
	};
});
