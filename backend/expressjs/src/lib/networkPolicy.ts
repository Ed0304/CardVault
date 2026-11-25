import ipaddr from "ipaddr.js";

/**
 * Which addresses CardVault may fetch web pages from (URL Ingestion REQ-URL-003).
 *
 * An allowlist, not a blocklist: only globally routable unicast addresses pass. That rejects
 * loopback, private (10/8, 172.16/12, 192.168/16), link-local (169.254/16 including cloud
 * metadata at 169.254.169.254, fe80::/10), unique-local IPv6 (fc00::/7, which includes Railway's
 * private network), carrier-grade NAT, multicast, broadcast, unspecified, documentation and other
 * reserved ranges, and IPv6 transition ranges (6to4, NAT64, Teredo) that can wrap a private IPv4
 * address. IPv4-mapped IPv6 (::ffff:a.b.c.d) is unwrapped and judged as IPv4.
 */
export function isPublicAddress(address: string): boolean {
  if (!ipaddr.isValid(address)) return false;
  return ipaddr.process(address).range() === "unicast";
}
