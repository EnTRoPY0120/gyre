/**
 * Debounce a function call
 */
export function debounce<T extends (...args: any[]) => any>(
	fn: T,
	delay: number
): (...args: Parameters<T>) => void {
	let timeoutId: ReturnType<typeof setTimeout>;
	return (...args: Parameters<T>) => {
		clearTimeout(timeoutId);
		timeoutId = setTimeout(() => fn(...args), delay);
	};
}

/**
 * Throttle a function call
 */
export function throttle<T extends (...args: any[]) => any>(
	fn: T,
	limit: number
): (...args: Parameters<T>) => void {
	let inThrottle: boolean;
	return (...args: Parameters<T>) => {
		if (!inThrottle) {
			fn(...args);
			inThrottle = true;
			setTimeout(() => (inThrottle = false), limit);
		}
	};
}

/**
 * Check if should compress based on content type and size
 */
export function shouldCompress(contentType: string | null, size: number): boolean {
	if (!contentType) return false;
	const compressibleTypes = [
		'application/json',
		'text/html',
		'text/css',
		'application/javascript',
		'text/plain',
		'image/svg+xml'
	];
	return compressibleTypes.some((type) => contentType.includes(type)) && size > 1024;
}
