import { afterAll, afterEach, beforeAll, describe, expect, it } from "@jest/globals";
import http from "node:http";
import type { AddressInfo } from "node:net";
import zlib from "node:zlib";
import request from "supertest";
import { config } from "../src/lib/config.js";
import { isPublicAddress } from "../src/lib/networkPolicy.js";
import { ingestionPolicy, urlIngestRateLimiter } from "../src/services/urlIngestionService.js";
import {
  app,
  as,
  assertTestDatabase,
  createUserTracker,
  describeIntegration,
  pool,
  type Session,
} from "./helpers/integration.js";

/**
 * URL ingestion against a real database and a local web server.
 *
 * SSRF tests run with the production address and port policy and make no connections. Fetch
 * tests allow exactly 127.0.0.1 and the test server's port, so the local server can be read; every
 * other address is still judged by the production policy.
 */
const users = createUserTracker();
const strictPolicy = { ...ingestionPolicy };
const ingestionConfig = config.urlIngestion as { -readonly [K in keyof typeof config.urlIngestion]: number };
const originalConfig = { ...config.urlIngestion };

const words = (n: number) => Array.from({ length: n }, (_, i) => `word${i % 97}`).join(" ");
const ARTICLE = `<!doctype html><html lang="en"><head>
  <meta charset="utf-8"><title>Card Catalogs | The Library Blog</title>
  <meta property="og:site_name" content="The Library Blog">
  <meta name="author" content="Ada Librarian">
  <meta property="article:published_time" content="2026-10-31T09:00:00Z">
  <link rel="canonical" href="/articles/card-catalogs">
  <style>.x{color:red}</style>
  <script>window.__evil = "SCRIPT TEXT MUST NOT APPEAR"</script>
</head><body>
  <nav>Home | About | NAVIGATION TEXT</nav>
  <article>
    <h1>The Card Catalog</h1>
    <p>Card catalogs organised library collections for more than a century. Each drawer held
    cards sorted by author, title and subject, so readers could find a book without help.</p>
    <p>Librarians used <b>subject headings</b> to group related works.\u0000 They followed shared
    rules, which made catalogs consistent between libraries.</p>
    <ul><li>Author cards</li><li>Title cards</li><li>Subject cards</li></ul>
    <p>${words(60)}</p>
    <img src="http://169.254.169.254/should-not-load.png" onerror="window.__evil2=1">
  </article>
</body></html>`;

let port = 0;
let lastUserAgent: string | undefined;
let requestCount = 0;

const server = http.createServer((req, res) => {
  requestCount += 1;
  lastUserAgent = req.headers["user-agent"];
  const html = (body: string, headers: http.OutgoingHttpHeaders = {}) => {
    res.writeHead(200, { "content-type": "text/html; charset=utf-8", ...headers });
    res.end(body);
  };
  const url = new URL(req.url ?? "/", "http://test");
  const path = url.pathname;

  if (path === "/article") return html(ARTICLE);
  if (path === "/redirect") {
    res.writeHead(302, { location: "/article" });
    return res.end();
  }
  if (path.startsWith("/chain/")) {
    const n = Number(path.split("/")[2]);
    res.writeHead(301, { location: n > 1 ? `/chain/${n - 1}` : "/article" });
    return res.end();
  }
  if (path === "/to-metadata") {
    res.writeHead(302, { location: "http://169.254.169.254/latest/meta-data/" });
    return res.end();
  }
  if (path === "/to-ftp") {
    res.writeHead(302, { location: "ftp://example.com/file" });
    return res.end();
  }
  if (path === "/pdf") {
    res.writeHead(200, { "content-type": "application/pdf" });
    return res.end("%PDF-1.7");
  }
  if (path === "/no-type") {
    res.writeHead(200);
    return res.end(ARTICLE);
  }
  if (path === "/missing") {
    res.writeHead(404, { "content-type": "text/html" });
    return res.end("<p>Not found</p>");
  }
  if (path === "/empty") return html("<html><body><div id=app></div><script>render()</script></body></html>");
  if (path === "/big") {
    res.writeHead(200, { "content-type": "text/html" });
    res.write(`<p>${"x".repeat(15_000)}</p>`);
    return res.end(`<p>${"y".repeat(15_000)}</p>`);
  }
  if (path === "/big-declared") {
    const body = `<p>${"x".repeat(30_000)}</p>`;
    res.writeHead(200, { "content-type": "text/html", "content-length": Buffer.byteLength(body) });
    return res.end(body);
  }
  if (path === "/bomb") {
    const body = zlib.gzipSync(Buffer.alloc(2_000_000, 0x20));
    res.writeHead(200, { "content-type": "text/html", "content-encoding": "gzip", "content-length": body.length });
    return res.end(body);
  }
  if (path === "/gzip") {
    const body = zlib.gzipSync(Buffer.from(ARTICLE));
    res.writeHead(200, { "content-type": "text/html; charset=utf-8", "content-encoding": "gzip" });
    return res.end(body);
  }
  if (path === "/latin1") {
    const body = Buffer.from(
      `<html><head><title>Caf\u00e9 culture</title></head><body><article><p>Le caf\u00e9 et la biblioth\u00e8que. ${words(40)}</p></article></body></html>`,
      "latin1",
    );
    res.writeHead(200, { "content-type": "text/html; charset=iso-8859-1" });
    return res.end(body);
  }
  if (path === "/huge-text") return html(`<html><body><article><p>${words(25_000)}</p></article></body></html>`);
  if (path === "/slow") {
    setTimeout(() => html(ARTICLE), 2_000);
    return;
  }
  if (path === "/slow-body") {
    res.writeHead(200, { "content-type": "text/html" });
    res.write("<html><body><p>");
    setTimeout(() => res.end(`${words(60)}</p></body></html>`), 2_000);
    return;
  }
  res.writeHead(404);
  res.end();
});

const local = (path: string) => `http://127.0.0.1:${port}${path}`;
const fromUrl = (session: Session, url: unknown) => as(session).post("/api/cards/from-url", { url });

function allowTestServer() {
  ingestionPolicy.isAllowedAddress = (address) => address === "127.0.0.1" || isPublicAddress(address);
  ingestionPolicy.isAllowedPort = (p) => p === String(port) || strictPolicy.isAllowedPort(p);
}

describeIntegration("URL ingestion (real database, local web server)", () => {
  let alice: Session;

  beforeAll(async () => {
    assertTestDatabase();
    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
    port = (server.address() as AddressInfo).port;
    alice = await users.signUp("urlalice");
  });

  afterEach(() => {
    Object.assign(ingestionPolicy, strictPolicy);
    Object.assign(ingestionConfig, originalConfig);
    urlIngestRateLimiter.reset();
  });

  afterAll(async () => {
    server.closeAllConnections();
    await new Promise<void>((resolve) => server.close(() => resolve()));
    await users.cleanUp();
  });

  it("requires a session", async () => {
    const res = await request(app).post("/api/cards/from-url").send({ url: "https://example.com" });
    expect(res.status).toBe(401);
  });

  describe("input validation (400)", () => {
    it.each([
      ["a missing url", undefined, "VALIDATION_ERROR"],
      ["an empty url", "  ", "VALIDATION_ERROR"],
      ["text that is not a URL", "not a url", "INVALID_URL"],
      ["ftp", "ftp://example.com/file", "INVALID_SCHEME"],
      ["file", "file:///etc/passwd", "INVALID_SCHEME"],
      ["javascript", "javascript:alert(1)", "INVALID_SCHEME"],
      ["data", "data:text/html,<p>hi</p>", "INVALID_SCHEME"],
      ["credentials in the URL", "https://user:pass@example.com/", "INVALID_URL"],
      ["a non-standard port", "http://example.com:22/", "UNSUPPORTED_PORT"],
      ["a URL over 2048 characters", `https://example.com/${"a".repeat(2050)}`, "VALIDATION_ERROR"],
    ])("rejects %s", async (_label, url, code) => {
      const res = await fromUrl(alice, url);
      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe(code);
    });
  });

  describe("SSRF protection (production policy, no connections made)", () => {
    it.each([
      ["IPv4 loopback", "http://127.0.0.1/"],
      ["decimal loopback", "http://2130706433/"],
      ["IPv6 loopback", "http://[::1]/"],
      ["IPv4-mapped loopback", "http://[::ffff:127.0.0.1]/"],
      ["cloud metadata", "http://169.254.169.254/latest/meta-data/"],
      ["private 10/8", "http://10.0.0.1/"],
      ["private 192.168/16", "https://192.168.1.1/"],
      ["unspecified", "http://0.0.0.0/"],
      ["Railway private network (IPv6 unique-local)", "http://[fd12:4454:c5c1:1:c000:bd:63d3:68ca]/"],
      ["a hostname that resolves to loopback", "http://localhost/"],
    ])("blocks %s with 422 SSRF_BLOCKED", async (_label, url) => {
      const res = await fromUrl(alice, url);
      expect(res.status).toBe(422);
      expect(res.body.error.code).toBe("SSRF_BLOCKED");
    });

    it("does not connect to the local server under the production policy", async () => {
      const before = requestCount;
      ingestionPolicy.isAllowedPort = (p) => p === String(port);
      expect((await fromUrl(alice, local("/article"))).body.error.code).toBe("SSRF_BLOCKED");
      expect(requestCount).toBe(before);
    });
  });

  describe("fetching and extraction", () => {
    it("creates a private card with clean text and source metadata", async () => {
      allowTestServer();
      const res = await fromUrl(alice, local("/article#section"));
      expect(res.status).toBe(201);
      const card = res.body.data;

      expect(card).toMatchObject({
        sourceTitle: expect.stringContaining("Card Catalog"),
        sourceUrl: local("/article"),
        visibility: "PRIVATE",
        aiCatalogStatus: "NOT_AVAILABLE",
        aiEmbeddingStatus: "NOT_AVAILABLE",
        notes: null,
      });
      expect(card.sourceText).toContain("Card catalogs organised library collections");
      expect(card.sourceText).toContain("- Subject cards");
      expect(card.sourceText).toMatch(/century\. Each drawer/);
      expect(card.sourceText).toContain("\n\n");
      for (const leaked of ["SCRIPT TEXT", "NAVIGATION TEXT", "<p>", "<b>", ".x{color", "\u0000"]) {
        expect(card.sourceText).not.toContain(leaked);
      }
      expect(card.sourceMeta).toMatchObject({
        siteName: "The Library Blog",
        author: "Ada Librarian",
        publishedAt: "2026-10-31T09:00:00.000Z",
        canonicalUrl: local("/articles/card-catalogs"),
        finalUrl: local("/article"),
        truncated: false,
      });
      expect(card.sourceMeta.fetchedAt).toEqual(expect.any(String));
      expect(lastUserAgent).toMatch(/^CardVault\/1\.0/);

      const row = await pool.query("SELECT user_id, source_meta FROM knowledge_cards WHERE id = $1", [card.id]);
      expect(row.rows[0].user_id).toBe(alice.userId);
      expect(row.rows[0].source_meta.finalUrl).toBe(local("/article"));
    });

    it("follows up to 3 redirects and keeps the submitted URL", async () => {
      allowTestServer();
      const one = await fromUrl(alice, local("/redirect"));
      expect(one.status).toBe(201);
      expect(one.body.data.sourceUrl).toBe(local("/redirect"));
      expect(one.body.data.sourceMeta.finalUrl).toBe(local("/article"));
      expect((await fromUrl(alice, local("/chain/2"))).status).toBe(201);
    });

    it("rejects a fourth redirect", async () => {
      allowTestServer();
      const res = await fromUrl(alice, local("/chain/4"));
      expect(res.status).toBe(422);
      expect(res.body.error.code).toBe("TOO_MANY_REDIRECTS");
    });

    it.each([
      ["a literal private address", "/to-metadata", "SSRF_BLOCKED"],
      ["a non-http scheme", "/to-ftp", "REDIRECT_NOT_ALLOWED"],
    ])("re-validates a redirect to %s", async (_label, path, code) => {
      allowTestServer();
      const res = await fromUrl(alice, local(path));
      expect(res.status).toBe(422);
      expect(res.body.error.code).toBe(code);
    });

    it.each([
      ["a PDF", "/pdf", "UNSUPPORTED_CONTENT_TYPE"],
      ["a response without a content type", "/no-type", "UNSUPPORTED_CONTENT_TYPE"],
      ["a 404", "/missing", "FETCH_FAILED"],
      ["a page without readable text", "/empty", "EXTRACTION_FAILED"],
    ])("rejects %s with 422", async (_label, path, code) => {
      allowTestServer();
      const before = await pool.query("SELECT count(*)::int AS n FROM knowledge_cards WHERE user_id = $1", [alice.userId]);
      const res = await fromUrl(alice, local(path));
      expect(res.status).toBe(422);
      expect(res.body.error.code).toBe(code);
      const after = await pool.query("SELECT count(*)::int AS n FROM knowledge_cards WHERE user_id = $1", [alice.userId]);
      expect(after.rows[0].n).toBe(before.rows[0].n);
    });

    it.each([
      ["a streamed body", "/big"],
      ["a declared length", "/big-declared"],
      ["a compressed bomb", "/bomb"],
    ])("rejects a response over the size limit (%s)", async (_label, path) => {
      allowTestServer();
      ingestionConfig.maxBytes = 20_000;
      const res = await fromUrl(alice, local(path));
      expect(res.status).toBe(422);
      expect(res.body.error.code).toBe("RESPONSE_TOO_LARGE");
    });

    it.each([
      ["before the headers", "/slow"],
      ["during the body", "/slow-body"],
    ])("times out a slow page (%s)", async (_label, path) => {
      allowTestServer();
      ingestionConfig.timeoutMs = 300;
      const started = Date.now();
      const res = await fromUrl(alice, local(path));
      expect(res.status).toBe(422);
      expect(res.body.error.code).toBe("FETCH_TIMEOUT");
      expect(Date.now() - started).toBeLessThan(1_500);
    });

    it("reports an unreachable host", async () => {
      const res = await fromUrl(alice, "https://cardvault-test.invalid/");
      expect(res.status).toBe(422);
      expect(res.body.error.code).toBe("FETCH_FAILED");
    });

    it("decodes gzip and non-UTF-8 pages", async () => {
      allowTestServer();
      const gz = await fromUrl(alice, local("/gzip"));
      expect(gz.status).toBe(201);
      expect(gz.body.data.sourceText).toContain("Card catalogs organised");

      const latin = await fromUrl(alice, local("/latin1"));
      expect(latin.status).toBe(201);
      expect(latin.body.data.sourceTitle).toBe("Café culture");
      expect(latin.body.data.sourceText).toContain("Le café et la bibliothèque");
    });

    it("cuts very long pages to the card limit and records it", async () => {
      allowTestServer();
      const res = await fromUrl(alice, local("/huge-text"));
      expect(res.status).toBe(201);
      expect(res.body.data.sourceText.length).toBeLessThanOrEqual(100_000);
      expect(res.body.data.sourceText.endsWith("…")).toBe(true);
      expect(res.body.data.sourceMeta.truncated).toBe(true);
    });

    it("limits pages fetched per user per hour", async () => {
      allowTestServer();
      ingestionConfig.hourlyLimit = 1;
      expect((await fromUrl(alice, local("/article"))).status).toBe(201);
      const limited = await fromUrl(alice, local("/article"));
      expect(limited.status).toBe(429);
      expect(limited.body.error.code).toBe("URL_RATE_LIMITED");
      expect(Number(limited.headers["retry-after"])).toBeGreaterThan(0);
    });

    it("ignores source metadata sent by a client on the text endpoint", async () => {
      const res = await as(alice).post("/api/cards", {
        sourceText: "Typed by hand",
        sourceMeta: { finalUrl: "https://forged.example" },
      });
      expect(res.status).toBe(201);
      expect(res.body.data.sourceMeta).toBeNull();
    });
  });
});
