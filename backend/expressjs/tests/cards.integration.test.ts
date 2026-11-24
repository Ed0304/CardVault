import { afterAll, beforeAll, describe, expect, it } from "@jest/globals";
import request from "supertest";
import {
  app,
  as,
  assertTestDatabase,
  createUserTracker,
  describeIntegration,
  pool,
  type Session,
} from "./helpers/integration.js";

/** Card API against a real PostgreSQL database (see tests/helpers/integration.ts). */
const users = createUserTracker();
const signUp = users.signUp;

describeIntegration("Card API (real database)", () => {
  let alice: Session;
  let bob: Session;

  beforeAll(async () => {
    assertTestDatabase();
    alice = await signUp("alice");
    bob = await signUp("bob");
  });

  afterAll(async () => {
    await users.cleanUp();
  });

  describe("authentication", () => {
    it("rejects every card route without a session", async () => {
      const id = crypto.randomUUID();
      const responses = await Promise.all([
        request(app).get("/api/cards"),
        request(app).post("/api/cards").send({ sourceText: "x" }),
        request(app).get(`/api/cards/${id}`),
        request(app).patch(`/api/cards/${id}/notes`).send({ notes: "x" }),
        request(app).patch(`/api/cards/${id}/ai-metadata`).send({ aiSummary: "x" }),
        request(app).delete(`/api/cards/${id}`),
      ]);
      for (const res of responses) expect(res.status).toBe(401);
    });
  });

  describe("create", () => {
    it("creates a card from text with a derived title and NOT_AVAILABLE statuses", async () => {
      const res = await as(alice).post("/api/cards", {
        sourceText: "\n  Library card catalogs  \nThey were invented in the 18th century.",
        sourceUrl: "https://example.com/catalogs",
      });
      expect(res.status).toBe(201);
      const card = res.body.data;
      expect(card.sourceTitle).toBe("Library card catalogs");
      expect(card.sourceUrl).toBe("https://example.com/catalogs");
      expect(card.sourceText).toContain("18th century");
      expect(card.aiCatalogStatus).toBe("NOT_AVAILABLE");
      expect(card.aiEmbeddingStatus).toBe("NOT_AVAILABLE");
      expect(card.aiSubjects).toEqual([]);
      expect(card.aiKeywords).toEqual([]);
      expect(card.notes).toBeNull();
      expect(card.collection).toBeNull();
      expect(card.tags).toEqual([]);
    });

    it("keeps an explicit title", async () => {
      const res = await as(alice).post("/api/cards", {
        sourceText: "First line\nSecond line",
        sourceTitle: "My own title",
      });
      expect(res.status).toBe(201);
      expect(res.body.data.sourceTitle).toBe("My own title");
    });

    it("accepts text far larger than the 10 KB app-wide body limit", async () => {
      const res = await as(alice).post("/api/cards", { sourceText: "a".repeat(60_000) });
      expect(res.status).toBe(201);
      expect(res.body.data.sourceText).toHaveLength(60_000);
    });

    it.each([
      ["missing text", {}],
      ["whitespace-only text", { sourceText: "   \n  " }],
      ["text over 100,000 characters", { sourceText: "a".repeat(100_001) }],
      ["a javascript: source URL", { sourceText: "x", sourceUrl: "javascript:alert(1)" }],
      ["a malformed source URL", { sourceText: "x", sourceUrl: "not a url" }],
    ])("rejects %s with 400", async (_label, body) => {
      const res = await as(alice).post("/api/cards", body);
      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe("VALIDATION_ERROR");
    });
  });

  describe("list", () => {
    let pager: Session;

    beforeAll(async () => {
      pager = await signUp("pager");
      for (let i = 1; i <= 23; i++) {
        const res = await as(pager).post("/api/cards", { sourceText: `Card number ${i}` });
        expect(res.status).toBe(201);
      }
    });

    it("returns 20 cards by default, newest first, with the total", async () => {
      const res = await as(pager).get("/api/cards");
      expect(res.status).toBe(200);
      const { items, total, page, pageSize } = res.body.data;
      expect(total).toBe(23);
      expect(page).toBe(1);
      expect(pageSize).toBe(20);
      expect(items).toHaveLength(20);
      for (let i = 1; i < items.length; i++) {
        expect(items[i - 1].createdAt >= items[i].createdAt).toBe(true);
      }
      expect(items[0].sourceTitle).toBe("Card number 23");
    });

    it("pages without repeating or skipping cards", async () => {
      const first = (await as(pager).get("/api/cards?page=1&pageSize=10")).body.data;
      const second = (await as(pager).get("/api/cards?page=2&pageSize=10")).body.data;
      const third = (await as(pager).get("/api/cards?page=3&pageSize=10")).body.data;
      const ids = [...first.items, ...second.items, ...third.items].map((c: { id: string }) => c.id);
      expect(ids).toHaveLength(23);
      expect(new Set(ids).size).toBe(23);
      expect(first.total).toBe(23);
      expect(third.total).toBe(23);
    });

    it("returns an empty page with the real total beyond the last page", async () => {
      const res = await as(pager).get("/api/cards?page=99");
      expect(res.status).toBe(200);
      expect(res.body.data.items).toEqual([]);
      expect(res.body.data.total).toBe(23);
    });

    it("returns an empty list, not an error, for a user with no cards", async () => {
      const empty = await signUp("empty");
      const res = await as(empty).get("/api/cards");
      expect(res.status).toBe(200);
      expect(res.body.data).toEqual({ items: [], total: 0, page: 1, pageSize: 20 });
    });

    it.each([
      ["page=0", "page=0"],
      ["pageSize=51", "pageSize=51"],
      ["pageSize=abc", "pageSize=abc"],
      ["a malformed collectionId", "collectionId=nope"],
    ])("rejects %s with 400", async (_label, qs) => {
      const res = await as(pager).get(`/api/cards?${qs}`);
      expect(res.status).toBe(400);
    });

    it("filters by collection and tag before paging and counting", async () => {
      const cards = (await as(pager).get("/api/cards?pageSize=3")).body.data.items as { id: string }[];
      const [c1, c2, c3] = cards.map((c) => c.id);

      // Collection and tag endpoints come in the next milestone; set the links directly.
      const collection = await pool.query<{ id: string }>(
        "INSERT INTO collections (user_id, name) VALUES ($1, 'Reading') RETURNING id",
        [pager.userId],
      );
      const tag = await pool.query<{ id: string }>(
        "INSERT INTO tags (user_id, name) VALUES ($1, 'history') RETURNING id",
        [pager.userId],
      );
      const collectionId = collection.rows[0]!.id;
      const tagId = tag.rows[0]!.id;
      await pool.query("UPDATE knowledge_cards SET collection_id = $1 WHERE id = ANY($2::uuid[])", [
        collectionId,
        [c1, c2],
      ]);
      await pool.query("INSERT INTO card_tags (card_id, tag_id) VALUES ($1, $2), ($3, $2)", [c2, tagId, c3]);

      const byCollection = (await as(pager).get(`/api/cards?collectionId=${collectionId}&pageSize=1`)).body.data;
      expect(byCollection.total).toBe(2);
      expect(byCollection.items).toHaveLength(1);
      expect(byCollection.items[0].collection).toEqual({ id: collectionId, name: "Reading" });

      const byTag = (await as(pager).get(`/api/cards?tagId=${tagId}`)).body.data;
      expect(byTag.total).toBe(2);
      expect(byTag.items.map((c: { id: string }) => c.id).sort()).toEqual([c2, c3].sort());
      expect(byTag.items[0].tags).toEqual([{ id: tagId, name: "history" }]);

      const both = (await as(pager).get(`/api/cards?collectionId=${collectionId}&tagId=${tagId}`)).body.data;
      expect(both.total).toBe(1);
      expect(both.items[0].id).toBe(c2);

      // Another user filtering by this user's collection or tag sees nothing.
      const foreign = (await as(bob).get(`/api/cards?collectionId=${collectionId}`)).body.data;
      expect(foreign.total).toBe(0);
      const foreignTag = (await as(bob).get(`/api/cards?tagId=${tagId}`)).body.data;
      expect(foreignTag.total).toBe(0);
    });
  });

  describe("detail, edits and ownership", () => {
    let cardId: string;

    beforeAll(async () => {
      const res = await as(alice).post("/api/cards", { sourceText: "Ownership test\nOriginal body" });
      cardId = res.body.data.id;
    });

    it("returns the owner's card", async () => {
      const res = await as(alice).get(`/api/cards/${cardId}`);
      expect(res.status).toBe(200);
      expect(res.body.data.id).toBe(cardId);
    });

    it("hides the card from another user with 404 on every route", async () => {
      expect((await as(bob).get(`/api/cards/${cardId}`)).status).toBe(404);
      expect((await as(bob).patch(`/api/cards/${cardId}/notes`, { notes: "hijack" })).status).toBe(404);
      expect((await as(bob).patch(`/api/cards/${cardId}/ai-metadata`, { aiSummary: "hijack" })).status).toBe(404);
      expect((await as(bob).delete(`/api/cards/${cardId}`)).status).toBe(404);

      const list = (await as(bob).get("/api/cards")).body.data;
      expect(list.items.map((c: { id: string }) => c.id)).not.toContain(cardId);

      const still = (await as(alice).get(`/api/cards/${cardId}`)).body.data;
      expect(still.notes).toBeNull();
      expect(still.aiSummary).toBeNull();
    });

    it("returns 404 for unknown and malformed ids", async () => {
      expect((await as(alice).get(`/api/cards/${crypto.randomUUID()}`)).status).toBe(404);
      expect((await as(alice).get("/api/cards/not-a-uuid")).status).toBe(404);
    });

    it("updates notes without touching the source or AI layers", async () => {
      const res = await as(alice).patch(`/api/cards/${cardId}/notes`, { notes: "My note" });
      expect(res.status).toBe(200);
      expect(res.body.data.notes).toBe("My note");
      expect(res.body.data.sourceText).toBe("Ownership test\nOriginal body");
      expect(res.body.data.aiCatalogStatus).toBe("NOT_AVAILABLE");

      const cleared = await as(alice).patch(`/api/cards/${cardId}/notes`, { notes: "   " });
      expect(cleared.body.data.notes).toBeNull();
    });

    it("updates AI metadata without touching the source, notes or statuses", async () => {
      await as(alice).patch(`/api/cards/${cardId}/notes`, { notes: "Keep me" });
      const res = await as(alice).patch(`/api/cards/${cardId}/ai-metadata`, {
        aiSummary: "A test card.",
        aiSubjects: ["Testing"],
        aiKeywords: ["ownership", "isolation"],
      });
      expect(res.status).toBe(200);
      const card = res.body.data;
      expect(card.aiSummary).toBe("A test card.");
      expect(card.aiSubjects).toEqual(["Testing"]);
      expect(card.aiKeywords).toEqual(["ownership", "isolation"]);
      expect(card.notes).toBe("Keep me");
      expect(card.sourceText).toBe("Ownership test\nOriginal body");
      expect(card.aiCatalogStatus).toBe("NOT_AVAILABLE");
      expect(card.aiEmbeddingStatus).toBe("NOT_AVAILABLE");

      const partial = await as(alice).patch(`/api/cards/${cardId}/ai-metadata`, { aiSubjects: [] });
      expect(partial.body.data.aiSubjects).toEqual([]);
      expect(partial.body.data.aiSummary).toBe("A test card.");
    });

    it("rejects invalid edits with 400", async () => {
      expect((await as(alice).patch(`/api/cards/${cardId}/ai-metadata`, {})).status).toBe(400);
      expect(
        (await as(alice).patch(`/api/cards/${cardId}/ai-metadata`, { aiSubjects: ["a", "b", "c", "d", "e", "f"] }))
          .status,
      ).toBe(400);
      expect((await as(alice).patch(`/api/cards/${cardId}/notes`, {})).status).toBe(400);
    });

    it("ignores attempts to change the source through edit routes", async () => {
      await as(alice).patch(`/api/cards/${cardId}/notes`, { notes: "n", sourceText: "changed" });
      await as(alice).patch(`/api/cards/${cardId}/ai-metadata`, { aiSummary: "s", sourceText: "changed" });
      const card = (await as(alice).get(`/api/cards/${cardId}`)).body.data;
      expect(card.sourceText).toBe("Ownership test\nOriginal body");
    });

    it("deletes the card permanently, including its tag links", async () => {
      const tag = await pool.query<{ id: string }>(
        "INSERT INTO tags (user_id, name) VALUES ($1, 'doomed') RETURNING id",
        [alice.userId],
      );
      await pool.query("INSERT INTO card_tags (card_id, tag_id) VALUES ($1, $2)", [cardId, tag.rows[0]!.id]);

      expect((await as(alice).delete(`/api/cards/${cardId}`)).status).toBe(200);
      expect((await as(alice).get(`/api/cards/${cardId}`)).status).toBe(404);
      expect((await as(alice).delete(`/api/cards/${cardId}`)).status).toBe(404);

      const links = await pool.query("SELECT 1 FROM card_tags WHERE card_id = $1", [cardId]);
      expect(links.rowCount).toBe(0);
    });
  });
});
