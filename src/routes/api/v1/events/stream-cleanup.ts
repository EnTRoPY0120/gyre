type TimeoutHandle = ReturnType<typeof setTimeout>;

export interface SseCleanupController {
	cleanup: () => void;
	setUnsubscribe: (unsubscribe: () => void) => void;
	setTimeoutHandle: (timeoutHandle: TimeoutHandle) => void;
}

export function createSseCleanup(options: {
	release: () => void;
	close: () => void;
	clearTimer?: (timeoutHandle: TimeoutHandle) => void;
}): SseCleanupController {
	let isCleanedUp = false;
	let unsubscribe: (() => void) | undefined;
	let timeoutHandle: TimeoutHandle | null = null;
	const clearTimer = options.clearTimer ?? clearTimeout;

	return {
		cleanup: () => {
			if (isCleanedUp) return;
			isCleanedUp = true;
			options.release();
			unsubscribe?.();
			if (timeoutHandle !== null) {
				clearTimer(timeoutHandle);
				timeoutHandle = null;
			}
			try {
				options.close();
			} catch {
				// The stream may already be closed.
			}
		},
		setUnsubscribe: (nextUnsubscribe) => {
			unsubscribe = nextUnsubscribe;
		},
		setTimeoutHandle: (nextTimeoutHandle) => {
			timeoutHandle = nextTimeoutHandle;
		}
	};
}
