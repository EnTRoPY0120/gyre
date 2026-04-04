import { describe, expect, test } from 'bun:test';
import {
	assertSafeOidcDiscoveryDocument,
	getIssuerUrlValidationError
} from '../lib/server/auth/oauth/url-security.js';

const baseDiscovery = {
	issuer: 'https://issuer.example.com/oidc',
	authorization_endpoint: 'https://issuer.example.com/oidc/auth',
	token_endpoint: 'https://issuer.example.com/oidc/token',
	jwks_uri: 'https://issuer.example.com/oidc/jwks',
	response_types_supported: ['code'],
	subject_types_supported: ['public'],
	id_token_signing_alg_values_supported: ['RS256']
};

describe('url-security', () => {
	test('rejects issuer URLs with a trailing localhost root dot', () => {
		expect(getIssuerUrlValidationError('https://localhost./oidc')).toBe(
			'Issuer URL must not use localhost hosts'
		);
	});

	test('rejects IPv4-mapped IPv6 hex hostnames that resolve to loopback IPv4', () => {
		expect(getIssuerUrlValidationError('https://[::ffff:7f00:1]/oidc')).toBe(
			'Issuer URL must not use private, loopback, or reserved IP addresses'
		);
	});

	test('rejects discovery issuers with query parameters before issuer comparison', () => {
		expect(() =>
			assertSafeOidcDiscoveryDocument(
				{
					...baseDiscovery,
					issuer: 'https://issuer.example.com/oidc?x=1'
				},
				'https://issuer.example.com/oidc'
			)
		).toThrow('Discovery issuer must not include query parameters or fragments');
	});
});
