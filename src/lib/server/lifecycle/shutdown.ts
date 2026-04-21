import { logger } from '../logger.js';
import { closeDb } from '../db/index.js';
import { stopCleanup } from '../kubernetes/flux/reconciliation-cleanup.js';
import { stopSessionCleanup } from '../auth/session-cleanup.js';
import { stopAuditLogCleanup } from '../audit.js';
import { closeAllEventStreams, setEventBusShuttingDown } from '../events.js';

let isShuttingDown = false;
let activeShutdownPromise: Promise<void> | null = null;

function safeCloseDb(context: string = 'shutdown') {
	try {
		closeDb();
		logger.info(`   ✓ Database connection closed (${context})`);
	} catch (error) {
		logger.error(error, `   ✗ Error closing database during ${context}:`);
	}
}

/**
 * Shutdown Gyre gracefully, awaiting any in-flight cleanup work before exiting.
 */
export async function shutdownGyre(): Promise<void> {
	logger.info('\n🛑 Shutting down Gyre background tasks...');
	// Mark event bus as shutting down early to reject new subscriptions before await steps
	setEventBusShuttingDown();
	try {
		const results = await Promise.allSettled([stopCleanup(), stopAuditLogCleanup()]);
		results.forEach((result, index) => {
			if (result.status === 'rejected') {
				const task = index === 0 ? 'stopCleanup' : 'stopAuditLogCleanup';
				logger.error(result.reason, `   ✗ Error during ${task}:`);
			}
		});
		try {
			stopSessionCleanup();
		} catch (error) {
			logger.error(error, '   ✗ Error during stopSessionCleanup:');
		}
		await closeAllEventStreams();
		logger.info('   ✓ Cleanup schedulers and SSE connections stopped');
	} catch (error) {
		logger.error(error, '   ✗ Error during shutdown:');
	}
}

// Register shutdown handlers
if (typeof process !== 'undefined') {
	let forceExit: NodeJS.Timeout | null = null;
	let httpDrainTimeout: NodeJS.Timeout | null = null;

	const handleSignal = async (signal: string) => {
		if (isShuttingDown) return;
		isShuttingDown = true;
		logger.info(`\n🛑 Received ${signal}, starting graceful shutdown...`);

		const isProd = process.env.NODE_ENV === 'production';

		// Force-exit after 15s if graceful shutdown hangs (5s in dev)
		// (K8s terminationGracePeriodSeconds defaults to 30s, so we want to exit before SIGKILL)
		// NOTE: Lowering terminationGracePeriodSeconds below 30s in K8s manifests would break this timing.
		forceExit = setTimeout(
			() => {
				logger.error('   ✗ Graceful shutdown took too long, forcing exit (HTTP drain timed out)');
				logger.error('   ✗ Force-exiting: any in-flight DB requests will fail');
				safeCloseDb('force-exit');
				process.exit(1);
			},
			isProd ? 15_000 : 5_000
		);
		forceExit.unref();

		activeShutdownPromise = shutdownGyre();
		await activeShutdownPromise;

		if (forceExit) {
			clearTimeout(forceExit);
			forceExit = null;
		}

		// In development (vite), sveltekit:shutdown is not emitted.
		// adapter-node only emits sveltekit:shutdown in production builds.
		// We exit immediately after cleanup.
		if (process.env.NODE_ENV !== 'production') {
			safeCloseDb('development shutdown');
			process.exit(0);
		} else {
			// Production path: adapter-node will emit sveltekit:shutdown when HTTP drain completes.
			// Guard against the event never firing.
			httpDrainTimeout = setTimeout(() => {
				logger.error('   ✗ sveltekit:shutdown not received within 10s, forcing exit');
				safeCloseDb('drain timeout');
				process.exit(1);
			}, 10_000);
			httpDrainTimeout.unref();
		}
	};

	process.on('SIGTERM', () =>
		handleSignal('SIGTERM').catch((err) => logger.error(err, 'Signal handler error:'))
	);
	process.on('SIGINT', () =>
		handleSignal('SIGINT').catch((err) => logger.error(err, 'Signal handler error:'))
	);

	process.on('sveltekit:shutdown', async () => {
		logger.info('   ✓ HTTP server stopped');

		// If sveltekit:shutdown fires without prior signal (adapter handled it),
		// run shutdown now to ensure cleanup completes.
		// If a signal handler already started shutdown, await the same promise so
		// safeCloseDb only runs after that work is fully done (no race).
		if (!isShuttingDown) {
			isShuttingDown = true;
			// Arm the same fail-safe backstop used in handleSignal so a hung
			// shutdownGyre() cannot block the process indefinitely.
			const isProd = process.env.NODE_ENV === 'production';
			const svkForceExit = setTimeout(
				() => {
					logger.error('   ✗ Graceful shutdown took too long, forcing exit');
					safeCloseDb('force-exit');
					process.exit(1);
				},
				isProd ? 15_000 : 5_000
			);
			svkForceExit.unref();
			activeShutdownPromise = shutdownGyre();
			await activeShutdownPromise;
			clearTimeout(svkForceExit);
		} else if (activeShutdownPromise) {
			await activeShutdownPromise;
		}

		// Clear fail-safe timers only after active shutdown finishes so they
		// remain in place as a backstop if shutdownGyre() hangs.
		if (forceExit) clearTimeout(forceExit);
		if (httpDrainTimeout) clearTimeout(httpDrainTimeout);

		safeCloseDb('graceful shutdown');
		logger.info('👋 Gyre shutdown complete.');
		process.exit(0);
	});
}
