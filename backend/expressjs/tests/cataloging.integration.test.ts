import { afterAll, afterEach, beforeAll, describe, expect, it } from "@jest/globals";
import http from "node:http";
import type { AddressInfo } from "node:net";
import request from "supertest";
import { config } from "../src/lib/config.js";
import { catalogRateLimiter } from "../src/services/catalogingService.js";
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
 * AI cataloging against a real database and a fake AI service (no provider calls).
 * The fake stands in for FastAPI's POST /catalog and records what Express sends it.
 */
const users = createUserTracker();
const RUN = `cat${Date.now().toString(36)}`;

interface FakeReply {
  status?: number;
  body?: unknown;
  raw?: string;
  delayMs?: number;
}

const received: { authorization: string | undefined; body: Record<string, unknown> }[] = [];
let reply: FakeReply = {};

const goodEntry = (overrides: Record<string, unknown> = {}) => ({
  title: "Card catalog",
  summary: "Card catalogs organised library collections by author, title and subject.",
  facts: [{ label: "Type", value: "Library finding aid" }],
  subjects: ["Library Science", "Information Retrieval"],
  keywords: [`catalog-${RUN}`, "subject headings", "Dewey Decimal Classification"],
  related: [{ name: "Dewey Decimal Classification", relation: "Organising scheme" }],
  model: "muse-ember-1.0",
  truncated: false,
  usage: { input_tokens: 800, output_tokens: 200 },
  ...overrides,
});

const fakeService = http.createServer((req, res) => {
  let data = "";
  req.on("data", (chunk) => (data += chunk));
  req.on("end", () => {
    received.push({ authorization: req.headers.authorization, body: data ? JSON.parse(data) : {} });
    const send = () => {
      res.writeHead(reply.status ?? 200, { "content-type": "application/json" });
      res.end(reply.raw ?? JSON.stringify(reply.body ?? goodEntry()));
    };
    if (reply.delayMs) setTimeout(send, reply.delayMs);
    else send();
  });
});

const configAi = config.ai as { -readonly [K in keyof typeof config.ai]: (typeof config.ai)[K] };
const originalAi = { ...config.ai };

async function newCard(session: Session, text = `Card catalogs ${RUN}`, title = `Catalogs ${RUN}`) {
  const res = await as(session).post("/api/cards", { sourceText: text, sourceTitle: title });
  expect(res.status).toBe(201);
  return res.body.data.id as string;
}

const catalog = (session: Session, id: string) => as(session).post(`/api/cards/${id}/catalog`);

async function dbRow(id: string) {
  const result = await pool.query(
    `SELECT ai_catalog_status, ai_catalog_draft, ai_summary, ai_subjects, ai_keywords
       FROM knowledge_cards WHERE id = $1`,
    [id],
  );
  return result.rows[0];
}

describeIntegration("AI cataloging (real database, fake AI service)", () => {
  let alice: Session;
  let bob: Session;

  beforeAll(async () => {
    assertTestDatabase();
    await new Promise<void>((resolve) => fakeService.listen(59123, "127.0.0.1", resolve));
    expect((fakeService.address() as AddressInfo).port).toBe(59123);
    alice = await users.signUp("catalice");
    bob = await users.signUp("catbob");
  });

  afterEach(() => {
    reply = {};
    received.length = 0;
    Object.assign(configAi, originalAi);
    catalogRateLimiter.reset();
  });

  afterAll(async () => {
    await new Promise<void>((resolve) => fakeService.close(() => resolve()));
    await users.cleanUp();
  });

  describe("authentication and availability", () => {
    it("rejects AI routes without a session", async () => {
      const id = crypto.randomUUID();
      const responses = await Promise.all([
        request(app).get("/api/ai/status"),
        request(app).post(`/api/cards/${id}/catalog`),
        request(app).delete(`/api/cards/${id}/catalog/draft`),
      ]);
      for (const res of responses) expect(res.status).toBe(401);
      expect(received).toHaveLength(0);
    });

    it("reports availability without revealing configuration", async () => {
      const res = await as(alice).get("/api/ai/status");
      expect(res.status).toBe(200);
      expect(res.body.data).toEqual({ catalog: { available: true } });
      expect(JSON.stringify(res.body)).not.toContain("59123");
      expect(JSON.stringify(res.body)).not.toContain(originalAi.serviceToken as string);
    });

    it("returns 503 and changes nothing when AI cataloging is not configured", async () => {
      const id = await newCard(alice);
      configAi.serviceUrl = null;
      configAi.serviceToken = null;
      expect((await as(alice).get("/api/ai/status")).body.data.catalog.available).toBe(false);

      const res = await catalog(alice, id);
      expect(res.status).toBe(503);
      expect(res.body.error.code).toBe("AI_NOT_AVAILABLE");
      expect(received).toHaveLength(0);
      expect((await dbRow(id)).ai_catalog_status).toBe("NOT_AVAILABLE");
    });
  });

  describe("requesting a catalog", () => {
    it("stores Muse's suggestions as a private draft without changing the card's metadata", async () => {
      const id = await newCard(alice, `Card catalogs used subject headings ${RUN}`, `Catalog history ${RUN}`);
      await as(alice).patch(`/api/cards/${id}/notes`, { notes: "PRIVATE NOTE" });

      const res = await catalog(alice, id);
      expect(res.status).toBe(200);
      const card = res.body.data;
      expect(card.aiCatalogStatus).toBe("COMPLETE");
      expect(card.aiCatalogDraft).toMatchObject({
        catalogTitle: "Card catalog",
        summary: goodEntry().summary,
        facts: [{ label: "Type", value: "Library finding aid" }],
        subjects: ["Library Science", "Information Retrieval"],
        keywords: goodEntry().keywords,
        related: [{ name: "Dewey Decimal Classification", relation: "Organising scheme" }],
        model: "muse-ember-1.0",
        truncated: false,
      });
      expect(card.aiCatalogDraft.generatedAt).toEqual(expect.any(String));
      expect(card.aiCatalogDraft).not.toHaveProperty("usage");
      // Nothing is applied until the owner saves it.
      expect(card).toMatchObject({
        catalogTitle: null,
        aiSummary: null,
        aiFacts: [],
        aiSubjects: [],
        aiKeywords: [],
        aiRelated: [],
      });
      expect(card.aiEmbeddingStatus).toBe("NOT_AVAILABLE");
    });

    it("sends only the title, source text and existing subject headings, with the service token", async () => {
      const earlier = await newCard(alice);
      await as(alice).patch(`/api/cards/${earlier}/ai-metadata`, { aiSubjects: ["Library Science", "Typography"] });
      const id = await newCard(alice, `Body text ${RUN}`, `Title ${RUN}`);
      await as(alice).patch(`/api/cards/${id}/notes`, { notes: "PRIVATE NOTE" });

      expect((await catalog(alice, id)).status).toBe(200);
      expect(received).toHaveLength(1);
      const sent = received[0]!;
      expect(sent.authorization).toBe(`Bearer ${originalAi.serviceToken}`);
      expect(Object.keys(sent.body).sort()).toEqual(["existing_subjects", "text", "title"]);
      expect(sent.body).toMatchObject({ title: `Title ${RUN}`, text: `Body text ${RUN}` });
      expect(sent.body.existing_subjects).toEqual(expect.arrayContaining(["Library Science", "Typography"]));
      expect(JSON.stringify(sent.body)).not.toContain("PRIVATE NOTE");
    });

    it("never sends another user's subject headings", async () => {
      const bobCard = await newCard(bob);
      await as(bob).patch(`/api/cards/${bobCard}/ai-metadata`, { aiSubjects: [`Bob Secret ${RUN}`] });
      const id = await newCard(alice);
      await catalog(alice, id);
      expect(JSON.stringify(received[0]!.body)).not.toContain(`Bob Secret ${RUN}`);
    });

    it("applies the draft only when the owner saves it, with their edits, and then clears it", async () => {
      const id = await newCard(alice);
      await catalog(alice, id);

      const saved = await as(alice).patch(`/api/cards/${id}/ai-metadata`, {
        aiSummary: "Edited by the owner.",
        aiSubjects: ["Library Science"],
        aiKeywords: ["card catalog"],
      });
      expect(saved.status).toBe(200);
      expect(saved.body.data).toMatchObject({
        aiSummary: "Edited by the owner.",
        aiSubjects: ["Library Science"],
        aiKeywords: ["card catalog"],
        aiCatalogDraft: null,
        aiCatalogStatus: "COMPLETE",
      });
      // Fields the owner did not send stay as they were (not taken from the draft).
      expect(saved.body.data).toMatchObject({ catalogTitle: null, aiFacts: [], aiRelated: [] });
    });

    it("never overwrites the owner's existing catalog details", async () => {
      const id = await newCard(alice);
      await as(alice).patch(`/api/cards/${id}/ai-metadata`, {
        aiSummary: "My own summary.",
        aiSubjects: ["Mine"],
        aiKeywords: ["mine"],
      });
      const res = await catalog(alice, id);
      expect(res.status).toBe(200);
      expect(res.body.data).toMatchObject({ aiSummary: "My own summary.", aiSubjects: ["Mine"], aiKeywords: ["mine"] });
      expect(res.body.data.aiCatalogDraft.subjects).toEqual(["Library Science", "Information Retrieval"]);
    });

    it("discards a draft without touching the card's catalog details", async () => {
      const id = await newCard(alice);
      await as(alice).patch(`/api/cards/${id}/ai-metadata`, { aiSummary: "Keep me." });
      await catalog(alice, id);

      const res = await as(alice).delete(`/api/cards/${id}/catalog/draft`);
      expect(res.status).toBe(200);
      expect(res.body.data).toMatchObject({ aiCatalogDraft: null, aiSummary: "Keep me." });
      expect((await dbRow(id)).ai_catalog_draft).toBeNull();
    });

    it("rejects a card without source text with 422 and makes no AI call", async () => {
      const original = await newCard(bob, "Unshared text");
      await as(bob).patch(`/api/cards/${original}/visibility`, { visibility: "PUBLIC", shareSourceText: false });
      const copy = (await as(alice).post(`/api/community/cards/${original}/save`)).body.data;
      expect(copy.sourceText).toBe("");

      const res = await catalog(alice, copy.id);
      expect(res.status).toBe(422);
      expect(res.body.error.code).toBe("NOTHING_TO_CATALOG");
      expect(received).toHaveLength(0);
      expect((await dbRow(copy.id)).ai_catalog_status).toBe("NOT_AVAILABLE");
    });
  });

  describe("structured catalog entries (REQ-AI-017)", () => {
    it("saves a reviewed entry with its title, facts and related concepts, keeping the source title", async () => {
      const id = await newCard(alice, `Body ${RUN}`, `Card catalog - Example Encyclopedia ${RUN}`);
      const draft = (await catalog(alice, id)).body.data.aiCatalogDraft;

      const saved = await as(alice).patch(`/api/cards/${id}/ai-metadata`, {
        catalogTitle: draft.catalogTitle,
        aiSummary: draft.summary,
        aiFacts: draft.facts,
        aiSubjects: draft.subjects,
        // Not the draft's keywords: they carry the marker the search test below looks for.
        aiKeywords: ["card catalog"],
        aiRelated: draft.related,
      });
      expect(saved.status).toBe(200);
      expect(saved.body.data).toMatchObject({
        catalogTitle: "Card catalog",
        sourceTitle: `Card catalog - Example Encyclopedia ${RUN}`,
        aiFacts: [{ label: "Type", value: "Library finding aid" }],
        aiRelated: [{ name: "Dewey Decimal Classification", relation: "Organising scheme", cardId: null }],
        aiCatalogDraft: null,
      });
    });

    it("accepts an AI service response without the structured fields (older service)", async () => {
      const id = await newCard(alice);
      reply = { body: { ...goodEntry(), title: undefined, facts: undefined, related: undefined } };
      const draft = (await catalog(alice, id)).body.data.aiCatalogDraft;
      expect(draft).toMatchObject({ catalogTitle: null, facts: [], related: [] });
    });

    it.each([
      ["too many facts", { facts: Array.from({ length: 9 }, (_, i) => ({ label: `L${i}`, value: "v" })) }],
      ["a fact without a value", { facts: [{ label: "Type", value: "" }] }],
      ["too many related concepts", { related: Array.from({ length: 9 }, (_, i) => ({ name: `N${i}`, relation: "r" })) }],
      ["a related concept with an overlong relation", { related: [{ name: "X", relation: "r".repeat(61) }] }],
      ["an overlong title", { title: "t".repeat(201) }],
      ["facts that are not a list", { facts: "Type: thing" }],
    ])("rejects %s from the AI service and stores nothing", async (_label, override) => {
      const id = await newCard(alice);
      reply = { body: goodEntry(override) };
      const res = await catalog(alice, id);
      expect(res.status).toBe(502);
      expect(res.body.error.code).toBe("AI_CATALOG_FAILED");
      expect(await dbRow(id)).toMatchObject({ ai_catalog_status: "FAILED", ai_catalog_draft: null });
    });

    it("drops unknown keys inside facts and related concepts from the AI service", async () => {
      const id = await newCard(alice);
      reply = {
        body: goodEntry({
          facts: [{ label: "Type", value: "Aid", html: "<script>x</script>" }],
          related: [{ name: "Dewey", relation: "Scheme", url: "javascript:alert(1)" }],
        }),
      };
      const draft = (await catalog(alice, id)).body.data.aiCatalogDraft;
      expect(draft.facts).toEqual([{ label: "Type", value: "Aid" }]);
      expect(draft.related).toEqual([{ name: "Dewey", relation: "Scheme" }]);
    });
  });

  describe("ownership and privacy", () => {
    it("refuses to catalog or discard another user's card, without calling the AI service", async () => {
      const id = await newCard(alice);
      await catalog(alice, id);
      received.length = 0;

      const cat = await catalog(bob, id);
      expect(cat.status).toBe(404);
      expect(cat.body.error.code).toBe("CARD_NOT_FOUND");
      expect((await as(bob).delete(`/api/cards/${id}/catalog/draft`)).status).toBe(404);
      expect(received).toHaveLength(0);
      expect((await dbRow(id)).ai_catalog_draft).not.toBeNull();
    });

    it("returns 404 for unknown and malformed ids", async () => {
      expect((await catalog(alice, crypto.randomUUID())).status).toBe(404);
      expect((await catalog(alice, "not-a-uuid")).status).toBe(404);
      expect((await as(alice).delete("/api/cards/not-a-uuid/catalog/draft")).status).toBe(404);
      expect(received).toHaveLength(0);
    });

    it("keeps drafts off public cards until the owner saves them", async () => {
      const id = await newCard(alice);
      await as(alice).patch(`/api/cards/${id}/visibility`, { visibility: "PUBLIC", shareSourceText: false });
      await catalog(alice, id);

      const publicCard = await as(bob).get(`/api/community/cards/${id}`);
      expect(publicCard.status).toBe(200);
      expect(publicCard.body.data).toMatchObject({ aiSummary: null, aiSubjects: [], aiKeywords: [] });
      expect(JSON.stringify(publicCard.body)).not.toContain(goodEntry().summary);
      expect(JSON.stringify(publicCard.body)).not.toContain("aiCatalogDraft");

      const copy = (await as(bob).post(`/api/community/cards/${id}/save`)).body.data;
      expect(copy.aiCatalogDraft).toBeNull();

      await as(alice).patch(`/api/cards/${id}/ai-metadata`, { aiSummary: "Now public." });
      expect((await as(bob).get(`/api/community/cards/${id}`)).body.data.aiSummary).toBe("Now public.");
    });
  });

  describe("failures", () => {
    it.each([
      ["the provider is busy (503)", { status: 503, body: { error: { code: "PROVIDER_UNAVAILABLE" } } }, 503, "AI_UNAVAILABLE"],
      ["the provider rejected the request (502)", { status: 502, body: { error: { code: "PROVIDER_REJECTED" } } }, 502, "AI_CATALOG_FAILED"],
      ["the service rejected the token (401)", { status: 401, body: {} }, 502, "AI_CATALOG_FAILED"],
      ["the response is not JSON", { raw: "<html>oops</html>" }, 502, "AI_CATALOG_FAILED"],
      ["the summary is missing", { body: goodEntry({ summary: undefined }) }, 502, "AI_CATALOG_FAILED"],
      ["there are too many subjects", { body: goodEntry({ subjects: ["a", "b", "c", "d", "e", "f"] }) }, 502, "AI_CATALOG_FAILED"],
      ["there are no keywords", { body: goodEntry({ keywords: [] }) }, 502, "AI_CATALOG_FAILED"],
      ["a fact is malformed", { body: goodEntry({ facts: [{ label: "Type" }] }) }, 502, "AI_CATALOG_FAILED"],
    ])("marks the catalog FAILED and keeps the card when %s", async (_label, fake, status, code) => {
      const id = await newCard(alice);
      await as(alice).patch(`/api/cards/${id}/ai-metadata`, { aiSummary: "Existing." });
      reply = fake as FakeReply;

      const res = await catalog(alice, id);
      expect(res.status).toBe(status);
      expect(res.body.error.code).toBe(code);
      const row = await dbRow(id);
      expect(row).toMatchObject({ ai_catalog_status: "FAILED", ai_catalog_draft: null, ai_summary: "Existing." });
      expect((await as(alice).get(`/api/cards/${id}`)).status).toBe(200);
    });

    it("keeps an earlier draft when a later request fails", async () => {
      const id = await newCard(alice);
      await catalog(alice, id);
      reply = { status: 503, body: {} };
      expect((await catalog(alice, id)).status).toBe(503);
      expect((await dbRow(id)).ai_catalog_draft).toMatchObject({ summary: goodEntry().summary });
    });

    it("times out a slow AI service and reports it as temporary", async () => {
      const id = await newCard(alice);
      configAi.timeoutMs = 300;
      reply = { delayMs: 1500 };
      const res = await catalog(alice, id);
      expect(res.status).toBe(503);
      expect(res.body.error.code).toBe("AI_UNAVAILABLE");
      expect(res.headers["retry-after"]).toBe("30");
      expect((await dbRow(id)).ai_catalog_status).toBe("FAILED");
    });

    it("reports an unreachable AI service as temporary", async () => {
      const id = await newCard(alice);
      configAi.serviceUrl = "http://127.0.0.1:1";
      const res = await catalog(alice, id);
      expect(res.status).toBe(503);
      expect((await dbRow(id)).ai_catalog_status).toBe("FAILED");
    });

    it("lets the owner retry after a failure", async () => {
      const id = await newCard(alice);
      reply = { status: 502, body: {} };
      expect((await catalog(alice, id)).status).toBe(502);
      reply = {};
      const retry = await catalog(alice, id);
      expect(retry.status).toBe(200);
      expect(retry.body.data.aiCatalogStatus).toBe("COMPLETE");
    });
  });

  describe("concurrency and limits", () => {
    it("allows one request per card at a time", async () => {
      const id = await newCard(alice);
      reply = { delayMs: 400 };
      const [first, second] = await Promise.all([catalog(alice, id), catalog(alice, id)]);
      expect([first.status, second.status].sort()).toEqual([200, 409]);
      expect([first, second].find((r) => r.status === 409)!.body.error.code).toBe("CATALOG_IN_PROGRESS");
      expect(received).toHaveLength(1);
    });

    it("takes over a request that was abandoned (stale PENDING)", async () => {
      const id = await newCard(alice);
      await pool.query(
        `UPDATE knowledge_cards SET ai_catalog_status = 'PENDING', ai_catalog_requested_at = now() - interval '1 hour'
          WHERE id = $1`,
        [id],
      );
      expect((await catalog(alice, id)).status).toBe(200);
    });

    it("limits catalog requests per user per hour with 429 and Retry-After", async () => {
      configAi.catalogHourlyLimit = 2;
      const id = await newCard(alice);
      expect((await catalog(alice, id)).status).toBe(200);
      expect((await catalog(alice, id)).status).toBe(200);
      const limited = await catalog(alice, id);
      expect(limited.status).toBe(429);
      expect(limited.body.error.code).toBe("AI_RATE_LIMITED");
      expect(Number(limited.headers["retry-after"])).toBeGreaterThan(0);
      expect(received).toHaveLength(2);
      // Another user's quota is separate.
      expect((await catalog(bob, await newCard(bob))).status).toBe(200);
    });
  });

  describe("discovery with saved catalog details", () => {
    it("finds the owner's cards by saved subjects and keywords, and only theirs", async () => {
      const id = await newCard(alice, "Plain text with nothing special", `Plain ${RUN}`);
      await catalog(alice, id);
      const draft = (await as(alice).get(`/api/cards/${id}`)).body.data.aiCatalogDraft;

      // A draft is not searchable until it is saved.
      expect((await as(alice).get(`/api/cards?q=${encodeURIComponent(`catalog-${RUN}`)}`)).body.data.total).toBe(0);
      await as(alice).patch(`/api/cards/${id}/ai-metadata`, {
        aiSummary: draft.summary,
        aiSubjects: draft.subjects,
        aiKeywords: draft.keywords,
      });

      const byKeyword = (await as(alice).get(`/api/cards?q=${encodeURIComponent(`CATALOG-${RUN}`)}`)).body.data;
      expect(byKeyword.items.map((c: { id: string }) => c.id)).toEqual([id]);
      expect(byKeyword.total).toBe(1);
      expect((await as(bob).get(`/api/cards?q=${encodeURIComponent(`catalog-${RUN}`)}`)).body.data.total).toBe(0);
    });

    it("searches notes and source text, escapes wildcards, and validates the query", async () => {
      const id = await newCard(alice, `Source mentions zephyr${RUN}`);
      await as(alice).patch(`/api/cards/${id}/notes`, { notes: `note-only-${RUN}` });
      expect((await as(alice).get(`/api/cards?q=zephyr${RUN}`)).body.data.total).toBe(1);
      expect((await as(alice).get(`/api/cards?q=note-only-${RUN}`)).body.data.total).toBe(1);
      expect((await as(alice).get(`/api/cards?q=${encodeURIComponent(`%_${RUN}`)}`)).body.data.total).toBe(0);
      expect((await as(alice).get(`/api/cards?q=${"x".repeat(501)}`)).status).toBe(400);
    });
  });
});
