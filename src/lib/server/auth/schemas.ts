import { z } from '$lib/server/openapi';

export const providerTypeSchema = z.enum([
	'oidc',
	'oauth2-github',
	'oauth2-google',
	'oauth2-gitlab',
	'oauth2-generic'
]);

export const authProviderSchema = z.object({
	id: z.string(),
	name: z.string().openapi({ example: 'My OIDC Provider' }),
	type: providerTypeSchema,
	enabled: z.boolean(),
	clientId: z.string().openapi({ example: 'my-client-id' }),
	clientSecretEncrypted: z.string().openapi({ example: '***' }),
	issuerUrl: z.string().nullable().optional().openapi({ example: 'https://accounts.example.com' }),
	authorizationUrl: z.string().nullable().optional(),
	tokenUrl: z.string().nullable().optional(),
	userInfoUrl: z.string().nullable().optional(),
	jwksUrl: z.string().nullable().optional(),
	autoProvision: z.boolean(),
	defaultRole: z.enum(['admin', 'editor', 'viewer']),
	roleMapping: z.record(z.string(), z.string()).nullable().optional(),
	roleClaim: z.string().openapi({ example: 'groups' }),
	usernameClaim: z.string().openapi({ example: 'preferred_username' }),
	emailClaim: z.string().openapi({ example: 'email' }),
	usePkce: z.boolean(),
	scopes: z.string().openapi({ example: 'openid profile email' })
});
