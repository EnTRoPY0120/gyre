import { describe, test, expect, afterEach } from 'bun:test';
import { parseEnvInt } from '../lib/server/config/constants';

const ENV_VAR = 'GYRE_TEST_PARSE_ENV_INT';

describe('parseEnvInt', () => {
	afterEach(() => {
		delete process.env[ENV_VAR];
	});

	test('returns defaultValue when env var is absent', () => {
		expect(parseEnvInt(ENV_VAR, 42)).toBe(42);
	});

	test('returns parsed integer when env var is a valid positive integer', () => {
		process.env[ENV_VAR] = '100';
		expect(parseEnvInt(ENV_VAR, 42)).toBe(100);
	});

	test('returns zero when env var is "0"', () => {
		process.env[ENV_VAR] = '0';
		expect(parseEnvInt(ENV_VAR, 42)).toBe(0);
	});

	test('returns negative integer when env var is negative', () => {
		process.env[ENV_VAR] = '-5';
		expect(parseEnvInt(ENV_VAR, 42)).toBe(-5);
	});

	test('returns defaultValue when env var is not a number', () => {
		process.env[ENV_VAR] = 'abc';
		expect(parseEnvInt(ENV_VAR, 42)).toBe(42);
	});

	test('returns defaultValue when env var is empty string', () => {
		process.env[ENV_VAR] = '';
		expect(parseEnvInt(ENV_VAR, 42)).toBe(42);
	});

	test('truncates float to integer', () => {
		process.env[ENV_VAR] = '3.9';
		expect(parseEnvInt(ENV_VAR, 42)).toBe(3);
	});
});
