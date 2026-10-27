// Public key for pack signatures. The private key stays on the build server. Replacing this key in a
// copy only makes that copy trust other packs.
export const PUBLIC_KEY_PEM = `-----BEGIN PUBLIC KEY-----
MCowBQYDK2VwAyEAfG/7MtuMVn62hOoxJG0ZjFw1bJ/jSMsbIxTaOj0o9BQ=
-----END PUBLIC KEY-----
`;
