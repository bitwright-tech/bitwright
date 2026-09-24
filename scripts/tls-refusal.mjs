/**
 * Reads the outcome of an attempt to open TLS 1.0 or 1.1 against the live host.
 *
 * Separated from check-live.mjs so it can be tested without opening a socket,
 * because the defect this replaces was in the reading rather than in the probe.
 * The old assertion resolved a pass on any socket error, and OpenSSL 3 refuses
 * to emit a legacy ClientHello at its default security level, so the error it
 * kept passing on was ERR_SSL_NO_PROTOCOLS_AVAILABLE: the server was never
 * asked. It reported "TLS below 1.2 is refused" against a host measured
 * accepting TLS 1.1.
 *
 * The distinction that matters is who said no. A protocol alert or a reset can
 * only come from the peer. Anything else means the question was never put, and
 * a question never put is not an answer.
 */

/** Errors a server produces when it declines the old protocol. */
const PEER_REFUSED = new Set([
  "ECONNRESET",
  "EPROTO",
  "ERR_SSL_TLSV1_ALERT_PROTOCOL_VERSION",
  "ERR_SSL_UNSUPPORTED_PROTOCOL",
  "ERR_SSL_VERSION_TOO_LOW",
  "ERR_SSL_WRONG_VERSION_NUMBER",
]);

/**
 * `null` when the host refused, a sentence naming the problem otherwise.
 * Matches the contract the rest of check-live.mjs uses.
 *
 * @param {{ handshake?: boolean, protocol?: string, code?: string, timedOut?: boolean }} outcome
 */
export function legacyTlsProblem(outcome) {
  if (outcome.handshake) {
    return `the handshake succeeded at ${outcome.protocol ?? "a version below 1.2"}`;
  }
  if (outcome.timedOut) {
    return "timed out before the host answered, so nothing was measured";
  }
  if (PEER_REFUSED.has(outcome.code)) return null;
  return `inconclusive: this client never offered TLS 1.1 (${outcome.code ?? "no error code"})`;
}
