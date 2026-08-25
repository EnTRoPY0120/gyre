import type { FormattedLogLine } from './tabs/logs-tab-types';

interface StructuredLogLine {
	ts?: string;
	level?: string;
	msg?: string;
	message?: string;
}

export function formatLogLine(line: string): FormattedLogLine {
	try {
		const parsed = JSON.parse(line) as StructuredLogLine;
		return {
			ts: parsed.ts ? new Date(parsed.ts).toLocaleTimeString() : '',
			level: (parsed.level || 'info').toUpperCase(),
			msg: parsed.msg || parsed.message || line,
			full: line
		};
	} catch {
		return { ts: '', level: 'INFO', msg: line, full: line };
	}
}
