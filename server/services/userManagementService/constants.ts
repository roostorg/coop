// 15-character minimum per NIST SP 800-63-4 §3.1.1, which requires verifiers to
// permit (and recommends requiring) passwords of at least 15 characters:
// https://pages.nist.gov/800-63-4/sp800-63b.html#passwordver
// Hardcoded on purpose — not admin-configurable and not an env var.
export const MIN_PASSWORD_LENGTH = 15;
