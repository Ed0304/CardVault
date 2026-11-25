import dns from "node:dns";
import http from "node:http";
import https from "node:https";
import net from "node:net";
import type { Readable } from "node:stream";
import zlib from "node:zlib";
import { config } from "../lib/config.js";
import { AppError } from "../lib/errors.js";
import { isPublicAddress } from "../lib/networkPolicy.js";
import { extractPage } from "../lib/pageExtraction.js";
import { createRateLimiter } from "../lib/rateLimit.js";
import { MAX_SOURCE_TEXT_LENGTH } from "../schemas/cards.schemas.js";

/**
 * Fetches a public web page and turns it into a card's source layer (URL Ingestion spec).
 *
 * Server-side request forgery protection (REQ-URL-002 to REQ-URL-004):
 * - Only http and https, only ports 80 and 443, no credentials in the URL.
 * - The address is checked inside the socket's own DNS lookup, so the address that is checked is
 *   the address that is connected to. A hostname that resolves to a public address when checked
 *   and a private one when connecting (DNS rebinding) cannot slip through. If any resolved
 *   address is not public, the request is refused. IP literals are checked before connecting,
 *   because Node does not call the lookup for them.
 * - Every redirect target is validated the same way, and at most 3 are followed.
 * - No connection pooling (each request opens its own socket) and no proxy.
 *
 * Request controls (REQ-URL-005): one deadline for all redirects and the body, a byte limit on
 * both the transferred and the decompressed body (so a compressed "bomb" is stopped), and a
 * User-Agent naming CardVault. Logs carry error classes only, never the URL or page content.
 */

const USER_AGENT = "CardVault/1.0 (+https://github.com/Ed0304/CardVault; knowledge-card ingestion)";
const ALLOWED_PORTS = new Set(["", "80", "443"]);
const HTML_TYPES = new Set(["text/html", "application/xhtml+xml"]);
const REDIRECT_STATUSES = new Set([301, 302, 303, 307, 308]);
/** Less readable text than this is treated as "nothing to save". */
const MIN_TEXT_CHARS = 50;

/**
 * The address check in use. Tests replace it so a local test server can be fetched; production
 * code never changes it.
 */
export const ingestionPolicy = {
  isAllowedAddress: isPublicAddress,
  /** `port` is URL.port: "" for the scheme's default. */
  isAllowedPort: (port: string) => ALLOWED_PORTS.has(port),
};

export const urlIngestRateLimiter = createRateLimiter({
  windowMs: 60 * 60 * 1000,
  limit: () => config.urlIngestion.hourlyLimit,
});

export interface IngestedPage {
  sourceText: string;
  /** The URL the user submitted (normalised). */
  sourceUrl: string;
  sourceTitle: string | null;
  sourceMeta: {
    siteName: string | null;
    author: string | null;
    publishedAt: string | null;
    canonicalUrl: string | null;
    /** Where the content was actually read from, after redirects. */
    finalUrl: string;
    fetchedAt: string;
    /** True when the text was cut to the card limit. */
    truncated: boolean;
  };
}

const ssrfBlocked = () =>
  new AppError(422, "SSRF_BLOCKED", "This address points to a private or reserved network, so CardVault won't fetch it.");

/** Parses and checks a URL. `status` is 400 for the submitted URL and 422 for a redirect target. */
function validateUrl(raw: string, status: 400 | 422): URL {
  const redirect = status === 422;
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new AppError(status, redirect ? "REDIRECT_NOT_ALLOWED" : "INVALID_URL", redirect
      ? "The page redirected to an invalid address."
      : "That doesn't look like a web address. Check it and try again.");
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new AppError(status, redirect ? "REDIRECT_NOT_ALLOWED" : "INVALID_SCHEME", redirect
      ? "The page redirected to an address that isn't http or https."
      : "Only http and https web pages can be saved.");
  }
  if (url.username || url.password) {
    throw new AppError(status, redirect ? "REDIRECT_NOT_ALLOWED" : "INVALID_URL",
      "Web addresses with a username or password aren't supported.");
  }
  if (!ingestionPolicy.isAllowedPort(url.port)) {
    throw new AppError(status, redirect ? "REDIRECT_NOT_ALLOWED" : "UNSUPPORTED_PORT",
      "Only web pages on the standard ports (80 and 443) can be saved.");
  }
  if (!url.hostname) {
    throw new AppError(status, redirect ? "REDIRECT_NOT_ALLOWED" : "INVALID_URL", "The address has no host name.");
  }
  url.hash = "";
  return url;
}

/** DNS lookup that refuses to hand the socket any address that is not allowed. */
const guardedLookup: net.LookupFunction = (hostname, options, callback) => {
  dns.lookup(hostname, { all: true, verbatim: true }, (err, addresses) => {
    if (err) return callback(err, "", 4);
    if (addresses.length === 0 || addresses.some((a) => !ingestionPolicy.isAllowedAddress(a.address))) {
      return callback(ssrfBlocked() as unknown as NodeJS.ErrnoException, "", 4);
    }
    if (options.all) return (callback as unknown as (e: null, a: dns.LookupAddress[]) => void)(null, addresses);
    const first = addresses[0]!;
    return callback(null, first.address, first.family);
  });
};

type Hop =
  | { kind: "redirect"; location: string }
  | { kind: "page"; body: Buffer; contentType: string };

function mediaType(contentType: string): string {
  return contentType.split(";")[0]!.trim().toLowerCase();
}

function decoderFor(encoding: string | undefined): zlib.Gunzip | zlib.Inflate | zlib.BrotliDecompress | null {
  switch ((encoding ?? "identity").trim().toLowerCase()) {
    case "gzip":
    case "x-gzip":
      return zlib.createGunzip();
    case "deflate":
      return zlib.createInflate();
    case "br":
      return zlib.createBrotliDecompress();
    case "identity":
    case "":
      return null;
    default:
      throw new AppError(422, "FETCH_FAILED", "The page used an encoding CardVault can't read.");
  }
}

/** Reads the body, stopping as soon as either the transferred or the decoded size is too big. */
function readLimited(res: http.IncomingMessage, maxBytes: number): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const tooLarge = () =>
      new AppError(422, "RESPONSE_TOO_LARGE", "This page is too large to save (the limit is 5 MB).");
    let decoder: ReturnType<typeof decoderFor>;
    try {
      decoder = decoderFor(res.headers["content-encoding"]);
    } catch (err) {
      res.destroy();
      return reject(err);
    }

    let transferred = 0;
    let decoded = 0;
    const chunks: Buffer[] = [];
    const fail = (err: unknown) => {
      res.destroy();
      decoder?.destroy();
      reject(err);
    };

    res.on("data", (chunk: Buffer) => {
      transferred += chunk.length;
      if (transferred > maxBytes) fail(tooLarge());
    });
    res.on("error", fail);

    const output: Readable = decoder ? res.pipe(decoder) : res;
    output.on("data", (chunk: Buffer) => {
      decoded += chunk.length;
      if (decoded > maxBytes) return fail(tooLarge());
      chunks.push(chunk);
    });
    output.on("error", (err) =>
      fail(err instanceof AppError ? err : new AppError(422, "FETCH_FAILED", "The page's content couldn't be decoded.")),
    );
    output.on("end", () => resolve(Buffer.concat(chunks)));
  });
}

function fetchOnce(url: URL, signal: AbortSignal): Promise<Hop> {
  const host = url.hostname.replace(/^\[|\]$/g, "");
  if (net.isIP(host) && !ingestionPolicy.isAllowedAddress(host)) return Promise.reject(ssrfBlocked());

  const isHttps = url.protocol === "https:";
  const client = isHttps ? https : http;
  return new Promise<Hop>((resolve, reject) => {
    const req = client.request(
      {
        protocol: url.protocol,
        hostname: host,
        port: url.port || (isHttps ? 443 : 80),
        path: `${url.pathname}${url.search}`,
        method: "GET",
        agent: false,
        lookup: guardedLookup,
        signal,
        headers: {
          "user-agent": USER_AGENT,
          accept: "text/html,application/xhtml+xml;q=0.9,*/*;q=0.1",
          "accept-encoding": "gzip, deflate, br",
          "accept-language": "en;q=0.9, *;q=0.5",
        },
      },
      (res) => {
        const status = res.statusCode ?? 0;
        if (REDIRECT_STATUSES.has(status) && res.headers.location) {
          res.resume();
          return resolve({ kind: "redirect", location: res.headers.location });
        }
        if (status !== 200) {
          res.resume();
          return reject(new AppError(422, "FETCH_FAILED", `The page couldn't be saved: it answered with HTTP ${status}.`));
        }
        const contentType = res.headers["content-type"] ?? "";
        if (!HTML_TYPES.has(mediaType(contentType))) {
          res.destroy();
          return reject(
            new AppError(422, "UNSUPPORTED_CONTENT_TYPE", "Only HTML web pages can be saved. This address is a file or another kind of content."),
          );
        }
        const declared = Number(res.headers["content-length"]);
        if (Number.isFinite(declared) && declared > config.urlIngestion.maxBytes) {
          res.destroy();
          return reject(new AppError(422, "RESPONSE_TOO_LARGE", "This page is too large to save (the limit is 5 MB)."));
        }
        readLimited(res, config.urlIngestion.maxBytes).then(
          (body) => resolve({ kind: "page", body, contentType }),
          reject,
        );
      },
    );
    req.on("error", reject);
    req.end();
  });
}

/** Decodes the body using the charset from the header or a <meta> tag, defaulting to UTF-8. */
function decodeHtml(body: Buffer, contentType: string): string {
  let charset = /charset\s*=\s*"?([\w.:-]+)/i.exec(contentType)?.[1];
  if (!charset) {
    const head = body.subarray(0, 4096).toString("latin1");
    charset = /<meta[^>]+charset\s*=\s*["']?([\w.:-]+)/i.exec(head)?.[1];
  }
  try {
    return new TextDecoder(charset ?? "utf-8").decode(body);
  } catch {
    return new TextDecoder("utf-8").decode(body);
  }
}

function truncateText(text: string): { text: string; truncated: boolean } {
  if (text.length <= MAX_SOURCE_TEXT_LENGTH) return { text, truncated: false };
  const cut = text.slice(0, MAX_SOURCE_TEXT_LENGTH - 1);
  const boundary = cut.search(/\s\S*$/);
  return { text: `${(boundary > MAX_SOURCE_TEXT_LENGTH * 0.9 ? cut.slice(0, boundary) : cut).trimEnd()}…`, truncated: true };
}

function describeNetworkError(err: unknown): string {
  const code = (err as { code?: unknown } | null)?.code;
  return typeof code === "string" ? code : err instanceof Error ? err.name : "unknown";
}

export async function ingestUrl(rawUrl: string): Promise<IngestedPage> {
  const submitted = validateUrl(rawUrl.trim(), 400);
  const { timeoutMs, maxRedirects } = config.urlIngestion;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    let current = submitted;
    let page: Extract<Hop, { kind: "page" }> | undefined;
    for (let redirects = 0; !page; ) {
      const hop = await fetchOnce(current, controller.signal);
      if (hop.kind === "page") {
        page = hop;
        break;
      }
      if (redirects === maxRedirects) {
        throw new AppError(422, "TOO_MANY_REDIRECTS", "The page redirected too many times.");
      }
      redirects += 1;
      current = validateUrl(new URL(hop.location, current).href, 422);
    }

    const html = decodeHtml(page.body, page.contentType);
    const extracted = extractPage(html, current.href);
    if (extracted.text.replace(/\s/g, "").length < MIN_TEXT_CHARS) {
      throw new AppError(
        422,
        "EXTRACTION_FAILED",
        "CardVault couldn't find readable text on this page. It may need JavaScript to show its content; try pasting the text instead.",
      );
    }
    const { text, truncated } = truncateText(extracted.text);

    return {
      sourceText: text,
      sourceUrl: submitted.href,
      sourceTitle: extracted.title,
      sourceMeta: {
        siteName: extracted.siteName,
        author: extracted.author,
        publishedAt: extracted.publishedAt,
        canonicalUrl: extracted.canonicalUrl,
        finalUrl: current.href,
        fetchedAt: new Date().toISOString(),
        truncated,
      },
    };
  } catch (err) {
    if (err instanceof AppError) throw err;
    if (controller.signal.aborted) {
      throw new AppError(422, "FETCH_TIMEOUT", "The page took too long to respond. Try again, or paste the text instead.");
    }
    console.warn(`[url-ingest] fetch failed: ${describeNetworkError(err)}`);
    throw new AppError(422, "FETCH_FAILED", "The page couldn't be reached. Check the address and try again.");
  } finally {
    clearTimeout(timer);
  }
}
