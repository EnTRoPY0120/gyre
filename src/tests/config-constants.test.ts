import { describe, test, expect, afterEach } from 'vitest';
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

	test('returns defaultValue when env var is negative', () => {
		process.env[ENV_VAR] = '-5';
		expect(parseEnvInt(ENV_VAR, 42)).toBe(42);
	});

	test('returns defaultValue when env var is not a number', () => {
		process.env[ENV_VAR] = 'abc';
		expect(parseEnvInt(ENV_VAR, 42)).toBe(42);
	});

	test('returns defaultValue when env var has a unit suffix like "5s"', () => {
		process.env[ENV_VAR] = '5s';
		expect(parseEnvInt(ENV_VAR, 42)).toBe(42);
	});

	test('returns defaultValue when env var is empty string', () => {
		process.env[ENV_VAR] = '';
		expect(parseEnvInt(ENV_VAR, 42)).toBe(42);
	});

	test('returns defaultValue when env var is a float', () => {
		process.env[ENV_VAR] = '3.9';
		expect(parseEnvInt(ENV_VAR, 42)).toBe(42);
	});

	describe('range validation', () => {
		test('accepts value equal to min', () => {
			process.env[ENV_VAR] = '5';
			expect(parseEnvInt(ENV_VAR, 42, { min: 5 })).toBe(5);
		});

		test('returns defaultValue when value is below min', () => {
			process.env[ENV_VAR] = '4';
			expect(parseEnvInt(ENV_VAR, 42, { min: 5 })).toBe(42);
		});

		test('accepts value equal to max', () => {
			process.env[ENV_VAR] = '10';
			expect(parseEnvInt(ENV_VAR, 42, { max: 10 })).toBe(10);
		});

		test('returns defaultValue when value is above max', () => {
			process.env[ENV_VAR] = '11';
			expect(parseEnvInt(ENV_VAR, 42, { max: 10 })).toBe(42);
		});

		test('accepts value within min and max', () => {
			process.env[ENV_VAR] = '7';
			expect(parseEnvInt(ENV_VAR, 42, { min: 5, max: 10 })).toBe(7);
		});

		test('returns defaultValue when value is outside min-max range', () => {
			process.env[ENV_VAR] = '1';
			expect(parseEnvInt(ENV_VAR, 42, { min: 5, max: 10 })).toBe(42);
		});
	});
});
