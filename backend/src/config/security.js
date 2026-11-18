const KNOWN_INSECURE_SECRETS = new Set([
  'fallback_secret_never_use_in_prod',
  'replace_with_a_long_random_secret_at_least_64_characters_long_for_security',
  'secret',
  'changeme',
  'jwt_secret',
  'pharmacare_secret',
]);

const MIN_PRODUCTION_SECRET_LENGTH = 32;

/**
 * Validates JWT_SECRET configuration.
 * - Rejects missing or known insecure/placeholder secrets in all environments.
 * - Enforces minimum 32-character length in production.
 * - Never logs or exposes the secret value.
 */
export function getJwtSecret() {
  const secret = typeof process.env.JWT_SECRET === 'string' ? process.env.JWT_SECRET.trim() : '';

  if (!secret) {
    throw new Error('JWT_SECRET environment variable is required and cannot be empty.');
  }

  if (KNOWN_INSECURE_SECRETS.has(secret)) {
    throw new Error('JWT_SECRET is set to an insecure placeholder value. Configure a strong random secret.');
  }

  if (process.env.NODE_ENV === 'production' && secret.length < MIN_PRODUCTION_SECRET_LENGTH) {
    throw new Error(
      `JWT_SECRET must be at least ${MIN_PRODUCTION_SECRET_LENGTH} characters long in production.`
    );
  }

  return secret;
}

/**
 * Called at server boot before listening on the network port.
 * Exits safely if JWT_SECRET is missing or insecure.
 */
export function validateSecurityConfigOnStartup() {
  getJwtSecret();
}

export default {
  getJwtSecret,
  validateSecurityConfigOnStartup,
};
