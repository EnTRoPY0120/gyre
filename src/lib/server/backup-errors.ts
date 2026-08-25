/**
 * Custom error for backup operations with HTTP status support.
 */
export class BackupError extends Error {
	constructor(
		message: string,
		public status: number = 500
	) {
		super(message);
		this.name = 'BackupError';
	}
}
