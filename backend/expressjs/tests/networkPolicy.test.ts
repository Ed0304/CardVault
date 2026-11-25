import { describe, expect, it } from "@jest/globals";
import { isPublicAddress } from "../src/lib/networkPolicy.js";

describe("isPublicAddress (SSRF address policy)", () => {
  it.each([
    "8.8.8.8",
    "93.184.216.34",
    "1.1.1.1",
    "2606:4700:4700::1111",
    "::ffff:8.8.8.8",
  ])("allows the public address %s", (address) => {
    expect(isPublicAddress(address)).toBe(true);
  });

  it.each([
    ["loopback", "127.0.0.1"],
    ["loopback (other)", "127.255.255.254"],
    ["private 10/8", "10.0.0.1"],
    ["private 172.16/12", "172.31.255.255"],
    ["private 192.168/16", "192.168.0.1"],
    ["link-local / cloud metadata", "169.254.169.254"],
    ["carrier-grade NAT", "100.64.0.1"],
    ["unspecified", "0.0.0.0"],
    ["broadcast", "255.255.255.255"],
    ["multicast", "224.0.0.1"],
    ["reserved", "240.0.0.1"],
    ["benchmarking", "198.18.0.1"],
    ["IPv6 loopback", "::1"],
    ["IPv6 unspecified", "::"],
    ["IPv6 link-local", "fe80::1"],
    ["IPv6 unique-local (Railway private network)", "fd12:4454:c5c1:1:c000:bd:63d3:68ca"],
    ["IPv4-mapped loopback", "::ffff:127.0.0.1"],
    ["IPv4-mapped private", "::ffff:10.0.0.1"],
    ["NAT64", "64:ff9b::a00:1"],
    ["6to4", "2002:7f00:1::1"],
    ["documentation", "2001:db8::1"],
    ["zone id", "fe80::1%eth0"],
    ["not an address", "example.com"],
    ["empty", ""],
  ])("blocks %s (%s)", (_label, address) => {
    expect(isPublicAddress(address)).toBe(false);
  });
});
