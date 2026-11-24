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

/** Publishing, the Community Catalog and saving independent copies, against a real database. */
const users = createUserTracker();

// A marker unique to this run, so listing and search assertions ignore other test data.
const RUN = `run${Date.now().toString(36)}`;

/** The only fields a public card may carry. Anything else is a leak. */
const PUBLIC_SUMMARY_KEYS = [
  "aiKeywords",
  "aiSubjects",
  "aiSummary",
  "author",
  "hasSourceText",
  "id",
  "publishedAt",
  "sourceTitle",
  "sourceUrl",
];
const PUBLIC_DETAIL_KEYS = [...PUBLIC_SUMMARY_KEYS, "sourceText", "viewer"].sort();

interface CardSpec {
  text?: string;
  title?: string;
  url?: string;
  notes?: string;
  summary?: string;
  subjects?: string[];
  keywords?: string[];
}

/** Creates a card with notes and catalog metadata, the way an owner would fill it in. */
async function newCard(session: Session, spec: CardSpec = {}): Promise<string> {
  const created = await as(session).post("/api/cards", {
    sourceText: spec.text ?? `Original text ${RUN} ${crypto.randomUUID()}`,
    sourceTitle: spec.title ?? `Card ${RUN}`,
    sourceUrl: spec.url,
  });
  expect(created.status).toBe(201);
  const id = created.body.data.id as string;
  if (spec.notes) {
    expect((await as(session).patch(`/api/cards/${id}/notes`, { notes: spec.notes })).status).toBe(200);
  }
  if (spec.summary || spec.subjects || spec.keywords) {
    const res = await as(session).patch(`/api/cards/${id}/ai-metadata`, {
      aiSummary: spec.summary ?? null,
      aiSubjects: spec.subjects ?? [],
      aiKeywords: spec.keywords ?? [],
    });
    expect(res.status).toBe(200);
  }
  return id;
}

async function publish(session: Session, id: string, shareSourceText = false) {
  const res = await as(session).patch(`/api/cards/${id}/visibility`, { visibility: "PUBLIC", shareSourceText });
  expect(res.status).toBe(200);
  return res.body.data;
}

async function unpublish(session: Session, id: string) {
  const res = await as(session).patch(`/api/cards/${id}/visibility`, { visibility: "PRIVATE" });
  expect(res.status).toBe(200);
  return res.body.data;
}

async function save(session: Session, id: string) {
  return as(session).post(`/api/community/cards/${id}/save`);
}

/** Every public card id in this run's community listing. */
async function communityIds(session: Session, q = RUN): Promise<string[]> {
  const res = await as(session).get(`/api/community/cards?pageSize=50&q=${encodeURIComponent(q)}`);
  expect(res.status).toBe(200);
  return (res.body.data.items as { id: string }[]).map((item) => item.id);
}

describeIntegration("Community Catalog (real database)", () => {
  let alice: Session;
  let bob: Session;

  beforeAll(async () => {
    assertTestDatabase();
    alice = await users.signUp("comalice");
    bob = await users.signUp("combob");
  });

  afterAll(async () => {
    await users.cleanUp();
  });

  describe("authentication", () => {
    it("rejects community and publishing routes without a session", async () => {
      const id = crypto.randomUUID();
      const responses = await Promise.all([
        request(app).get("/api/community/cards"),
        request(app).get(`/api/community/cards/${id}`),
        request(app).post(`/api/community/cards/${id}/save`),
        request(app).patch(`/api/cards/${id}/visibility`).send({ visibility: "PRIVATE" }),
      ]);
      for (const res of responses) expect(res.status).toBe(401);
    });

    it("does not show a published card to a visitor without a session", async () => {
      const id = await newCard(alice);
      await publish(alice, id);
      const res = await request(app).get(`/api/community/cards/${id}`);
      expect(res.status).toBe(401);
      expect(res.body.data).toBeNull();
    });
  });

  describe("publishing", () => {
    it("creates cards as private, with nothing shared", async () => {
      const id = await newCard(alice);
      const card = (await as(alice).get(`/api/cards/${id}`)).body.data;
      expect(card).toMatchObject({ visibility: "PRIVATE", publishedAt: null, shareSourceText: false, savedFrom: null });
    });

    it("requires an explicit source-text choice and a valid visibility", async () => {
      const id = await newCard(alice);
      for (const body of [{}, { visibility: "PUBLIC" }, { visibility: "SHARED" }, { visibility: "PUBLIC", shareSourceText: "yes" }]) {
        const res = await as(alice).patch(`/api/cards/${id}/visibility`, body);
        expect(res.status).toBe(400);
        expect(res.body.error.code).toBe("VALIDATION_ERROR");
      }
      expect((await as(alice).get(`/api/cards/${id}`)).body.data.visibility).toBe("PRIVATE");
    });

    it("publishes, changes the text choice without moving the date, and unpublishes", async () => {
      const id = await newCard(alice);

      const published = await publish(alice, id, false);
      expect(published).toMatchObject({ visibility: "PUBLIC", shareSourceText: false });
      expect(published.publishedAt).toEqual(expect.any(String));

      const changed = await publish(alice, id, true);
      expect(changed.shareSourceText).toBe(true);
      expect(changed.publishedAt).toBe(published.publishedAt);

      const unpublished = await unpublish(alice, id);
      expect(unpublished).toMatchObject({ visibility: "PRIVATE", publishedAt: null, shareSourceText: false });

      const db = await pool.query(
        "SELECT visibility, published_at, share_source_text FROM knowledge_cards WHERE id = $1",
        [id],
      );
      expect(db.rows[0]).toEqual({ visibility: "PRIVATE", published_at: null, share_source_text: false });
    });

    it("lets the owner view and edit a published card as usual", async () => {
      const id = await newCard(alice);
      await publish(alice, id);
      expect((await as(alice).get(`/api/cards/${id}`)).status).toBe(200);
      const edited = await as(alice).patch(`/api/cards/${id}/notes`, { notes: "Still mine" });
      expect(edited.status).toBe(200);
      expect(edited.body.data).toMatchObject({ notes: "Still mine", visibility: "PUBLIC" });
    });

    it("refuses to publish or unpublish another user's card, and hides it with 404", async () => {
      const privateId = await newCard(alice);
      const publicId = await newCard(alice);
      await publish(alice, publicId);

      const publishOther = await as(bob).patch(`/api/cards/${privateId}/visibility`, {
        visibility: "PUBLIC",
        shareSourceText: true,
      });
      expect(publishOther.status).toBe(404);
      expect(publishOther.body.error.code).toBe("CARD_NOT_FOUND");
      const unpublishOther = await as(bob).patch(`/api/cards/${publicId}/visibility`, { visibility: "PRIVATE" });
      expect(unpublishOther.status).toBe(404);

      // Published or not, the vault endpoints stay owner-only.
      expect((await as(bob).get(`/api/cards/${publicId}`)).status).toBe(404);
      expect((await as(bob).patch(`/api/cards/${publicId}/notes`, { notes: "x" })).status).toBe(404);
      expect((await as(bob).delete(`/api/cards/${publicId}`)).status).toBe(404);

      const rows = await pool.query("SELECT id, visibility FROM knowledge_cards WHERE id = ANY($1::uuid[])", [
        [privateId, publicId],
      ]);
      const byId = Object.fromEntries(rows.rows.map((r) => [r.id, r.visibility]));
      expect(byId).toEqual({ [privateId]: "PRIVATE", [publicId]: "PUBLIC" });
    });

    it("returns 404 for unknown and malformed card ids", async () => {
      const body = { visibility: "PUBLIC", shareSourceText: false };
      expect((await as(alice).patch(`/api/cards/${crypto.randomUUID()}/visibility`, body)).status).toBe(404);
      expect((await as(alice).patch("/api/cards/not-a-uuid/visibility", body)).status).toBe(404);
    });
  });

  describe("community listing", () => {
    it("lists published cards only, newest published first", async () => {
      const privateId = await newCard(alice);
      const first = await newCard(alice);
      const second = await newCard(bob);
      await publish(alice, first);
      await publish(bob, second);

      const ids = await communityIds(alice);
      expect(ids).not.toContain(privateId);
      expect(ids.indexOf(second)).toBeGreaterThanOrEqual(0);
      expect(ids.indexOf(second)).toBeLessThan(ids.indexOf(first));
      // Both users see the same catalog, including their own published cards.
      expect(await communityIds(bob)).toEqual(ids);

      await unpublish(alice, first);
      expect(await communityIds(bob)).not.toContain(first);
    });

    it("returns only the approved public fields", async () => {
      const collection = await as(alice).post("/api/collections", { name: `Secret shelf ${RUN}` });
      const tag = await as(alice).post("/api/tags", { name: `secret-tag-${RUN}` });
      const id = await newCard(alice, {
        title: `Field check ${RUN}`,
        notes: "PRIVATE NOTE",
        summary: "A public summary",
        subjects: ["History"],
        keywords: ["archives"],
      });
      await as(alice).patch(`/api/cards/${id}/collection`, { collectionId: collection.body.data.id });
      await as(alice).post(`/api/cards/${id}/tags/${tag.body.data.id}`);
      await publish(alice, id, false);

      const res = await as(bob).get(`/api/community/cards?q=${encodeURIComponent(`Field check ${RUN}`)}`);
      expect(res.status).toBe(200);
      expect(res.body.data.total).toBe(1);
      const item = res.body.data.items[0];
      expect(Object.keys(item).sort()).toEqual(PUBLIC_SUMMARY_KEYS);
      expect(item).toMatchObject({
        id,
        aiSummary: "A public summary",
        aiSubjects: ["History"],
        aiKeywords: ["archives"],
        hasSourceText: false,
        author: { username: "comalice" },
      });
      expect(Object.keys(item.author)).toEqual(["username"]);
      const raw = JSON.stringify(res.body);
      for (const secret of ["PRIVATE NOTE", "Secret shelf", "secret-tag", "@integration.test", alice.userId]) {
        expect(raw).not.toContain(secret);
      }
    });

    it("searches public fields, and source text only where it is shared", async () => {
      const word = `zebra${RUN}`;
      const inTitle = await newCard(alice, { title: `About ${word}` });
      const inKeyword = await newCard(alice, { keywords: [`${word}-keyword`] });
      const inSharedText = await newCard(alice, { text: `Shared text mentions ${word}` });
      const inHiddenText = await newCard(alice, { text: `Hidden text mentions ${word}` });
      const privateMatch = await newCard(alice, { title: `Private ${word}` });
      await publish(alice, inTitle);
      await publish(alice, inKeyword);
      await publish(alice, inSharedText, true);
      await publish(alice, inHiddenText, false);

      const ids = await communityIds(bob, word.toUpperCase());
      expect(ids.sort()).toEqual([inTitle, inKeyword, inSharedText].sort());
      expect(ids).not.toContain(inHiddenText);
      expect(ids).not.toContain(privateMatch);
    });

    it("treats LIKE wildcards in the search literally", async () => {
      const res = await as(bob).get(`/api/community/cards?q=${encodeURIComponent(`%_${RUN}`)}`);
      expect(res.status).toBe(200);
      expect(res.body.data.total).toBe(0);
    });

    it("paginates with a total and validates paging", async () => {
      const marker = `page${RUN}`;
      for (let i = 0; i < 3; i += 1) await publish(alice, await newCard(alice, { title: `${marker} ${i}` }));

      const first = (await as(bob).get(`/api/community/cards?q=${marker}&pageSize=2`)).body.data;
      const second = (await as(bob).get(`/api/community/cards?q=${marker}&pageSize=2&page=2`)).body.data;
      expect(first).toMatchObject({ total: 3, page: 1, pageSize: 2 });
      expect(first.items).toHaveLength(2);
      expect(second.items).toHaveLength(1);
      expect(new Set([...first.items, ...second.items].map((c: { id: string }) => c.id)).size).toBe(3);

      for (const bad of ["page=0", "pageSize=51", "pageSize=abc", `q=${"x".repeat(501)}`]) {
        expect((await as(bob).get(`/api/community/cards?${bad}`)).status).toBe(400);
      }
    });
  });

  describe("public card detail", () => {
    it("shows a published card with approved fields and no private data", async () => {
      const id = await newCard(alice, {
        text: "The hidden original text",
        url: "https://example.com/article",
        notes: "PRIVATE NOTE",
        summary: "Public summary",
      });
      await publish(alice, id, false);

      const res = await as(bob).get(`/api/community/cards/${id}`);
      expect(res.status).toBe(200);
      expect(Object.keys(res.body.data).sort()).toEqual(PUBLIC_DETAIL_KEYS);
      expect(res.body.data).toMatchObject({
        id,
        sourceUrl: "https://example.com/article",
        aiSummary: "Public summary",
        sourceText: null,
        hasSourceText: false,
        author: { username: "comalice" },
        viewer: { isOwner: false, savedCardId: null },
      });
      const raw = JSON.stringify(res.body);
      expect(raw).not.toContain("hidden original text");
      expect(raw).not.toContain("PRIVATE NOTE");
    });

    it("includes the source text only when the owner shares it", async () => {
      const id = await newCard(alice, { text: "Text the owner chose to share" });
      await publish(alice, id, true);
      const res = await as(bob).get(`/api/community/cards/${id}`);
      expect(res.body.data).toMatchObject({ sourceText: "Text the owner chose to share", hasSourceText: true });
    });

    it("tells the owner the card is theirs", async () => {
      const id = await newCard(alice);
      await publish(alice, id);
      expect((await as(alice).get(`/api/community/cards/${id}`)).body.data.viewer).toEqual({
        isOwner: true,
        savedCardId: null,
      });
    });

    it("returns the same 404 for private, unpublished, unknown and malformed ids", async () => {
      const privateId = await newCard(alice);
      const unpublishedId = await newCard(alice);
      await publish(alice, unpublishedId);
      await unpublish(alice, unpublishedId);

      for (const id of [privateId, unpublishedId, crypto.randomUUID(), "not-a-uuid"]) {
        const res = await as(bob).get(`/api/community/cards/${id}`);
        expect(res.status).toBe(404);
        expect(res.body.error.code).toBe("CARD_NOT_FOUND");
      }
      // Not even the owner can reach a private card through the public endpoint.
      expect((await as(alice).get(`/api/community/cards/${privateId}`)).status).toBe(404);
    });
  });

  describe("saving to my vault", () => {
    it("creates an independent private copy with provenance and no private data", async () => {
      const tag = await as(alice).post("/api/tags", { name: `alice-only-${RUN}` });
      const collection = await as(alice).post("/api/collections", { name: `Alice only ${RUN}` });
      const originalId = await newCard(alice, {
        title: "Worth keeping",
        url: "https://example.com/keep",
        text: "Shared original text",
        notes: "Alice's private note",
        summary: "Alice's summary",
        subjects: ["Libraries"],
        keywords: ["catalog", "cards"],
      });
      await as(alice).post(`/api/cards/${originalId}/tags/${tag.body.data.id}`);
      await as(alice).patch(`/api/cards/${originalId}/collection`, { collectionId: collection.body.data.id });
      await pool.query("UPDATE knowledge_cards SET ai_catalog_status = 'COMPLETE' WHERE id = $1", [originalId]);
      await publish(alice, originalId, true);

      const res = await save(bob, originalId);
      expect(res.status).toBe(201);
      const copy = res.body.data;
      expect(copy.id).not.toBe(originalId);
      expect(copy).toMatchObject({
        sourceTitle: "Worth keeping",
        sourceUrl: "https://example.com/keep",
        sourceText: "Shared original text",
        aiSummary: "Alice's summary",
        aiSubjects: ["Libraries"],
        aiKeywords: ["catalog", "cards"],
        notes: null,
        collection: null,
        tags: [],
        visibility: "PRIVATE",
        publishedAt: null,
        shareSourceText: false,
        aiCatalogStatus: "NOT_AVAILABLE",
        aiEmbeddingStatus: "NOT_AVAILABLE",
        savedFrom: { cardId: originalId, authorUsername: "comalice", originalAvailable: true },
      });

      const db = await pool.query(
        "SELECT user_id, saved_from_card_id, saved_from_author, source_meta FROM knowledge_cards WHERE id = $1",
        [copy.id],
      );
      expect(db.rows[0]).toEqual({
        user_id: bob.userId,
        saved_from_card_id: originalId,
        saved_from_author: "comalice",
        source_meta: null,
      });
      const copiedTags = await pool.query("SELECT 1 FROM card_tags WHERE card_id = $1", [copy.id]);
      expect(copiedTags.rowCount).toBe(0);

      // The copy is in Bob's vault, through the existing endpoints, and only there.
      const bobVault = (await as(bob).get("/api/cards?pageSize=50")).body.data.items as { id: string; savedFrom: unknown }[];
      expect(bobVault.find((c) => c.id === copy.id)?.savedFrom).toMatchObject({ cardId: originalId });
      expect((await as(alice).get(`/api/cards/${copy.id}`)).status).toBe(404);
      // The public detail now points Bob at his copy.
      expect((await as(bob).get(`/api/community/cards/${originalId}`)).body.data.viewer.savedCardId).toBe(copy.id);
    });

    it("copies no source text when the author did not share it", async () => {
      const originalId = await newCard(alice, { text: "Not for copying" });
      await publish(alice, originalId, false);
      const copy = (await save(bob, originalId)).body.data;
      expect(copy.sourceText).toBe("");
      const db = await pool.query("SELECT source_text FROM knowledge_cards WHERE id = $1", [copy.id]);
      expect(db.rows[0].source_text).toBe("");
    });

    it("rejects saving a private, unpublished, unknown or malformed card with 404", async () => {
      const privateId = await newCard(alice);
      const unpublishedId = await newCard(alice);
      await publish(alice, unpublishedId);
      await unpublish(alice, unpublishedId);

      for (const id of [privateId, unpublishedId, crypto.randomUUID(), "not-a-uuid"]) {
        const res = await save(bob, id);
        expect(res.status).toBe(404);
        expect(res.body.error.code).toBe("CARD_NOT_FOUND");
      }
      const copies = await pool.query("SELECT 1 FROM knowledge_cards WHERE user_id = $1 AND saved_from_card_id = ANY($2::uuid[])", [
        bob.userId,
        [privateId, unpublishedId],
      ]);
      expect(copies.rowCount).toBe(0);
    });

    it("rejects saving your own card", async () => {
      const id = await newCard(alice);
      await publish(alice, id);
      const res = await save(alice, id);
      expect(res.status).toBe(409);
      expect(res.body.error.code).toBe("CANNOT_SAVE_OWN_CARD");
    });

    it("prevents duplicate saves, including simultaneous ones, and allows saving again after deleting the copy", async () => {
      const originalId = await newCard(alice);
      await publish(alice, originalId);
      const saver = await users.signUp("comsaver");

      const results = await Promise.all([save(saver, originalId), save(saver, originalId)]);
      expect(results.map((r) => r.status).sort()).toEqual([201, 409]);
      const conflict = results.find((r) => r.status === 409)!;
      expect(conflict.body.error.code).toBe("CARD_ALREADY_SAVED");

      const again = await save(saver, originalId);
      expect(again.status).toBe(409);
      expect(again.body.error.code).toBe("CARD_ALREADY_SAVED");
      const count = await pool.query("SELECT count(*)::int AS n FROM knowledge_cards WHERE user_id = $1", [saver.userId]);
      expect(count.rows[0].n).toBe(1);

      const copyId = results.find((r) => r.status === 201)!.body.data.id;
      expect((await as(saver).delete(`/api/cards/${copyId}`)).status).toBe(200);
      expect((await save(saver, originalId)).status).toBe(201);
    });

    it("refuses to publish a saved copy", async () => {
      const originalId = await newCard(alice);
      await publish(alice, originalId);
      const copy = (await save(bob, originalId)).body.data;
      const res = await as(bob).patch(`/api/cards/${copy.id}/visibility`, { visibility: "PUBLIC", shareSourceText: false });
      expect(res.status).toBe(409);
      expect(res.body.error.code).toBe("SAVED_COPY_NOT_PUBLISHABLE");
      expect((await as(bob).get(`/api/cards/${copy.id}`)).body.data.visibility).toBe("PRIVATE");
    });
  });

  describe("independence of saved copies", () => {
    let originalId: string;
    let copyId: string;

    beforeAll(async () => {
      originalId = await newCard(alice, {
        title: "Independent original",
        text: "Original words",
        summary: "First summary",
        subjects: ["Before"],
      });
      await publish(alice, originalId, true);
      copyId = (await save(bob, originalId)).body.data.id;
    });

    it("does not change the copy when the original is edited", async () => {
      await as(alice).patch(`/api/cards/${originalId}/ai-metadata`, { aiSummary: "Changed summary", aiSubjects: ["After"] });
      await as(alice).patch(`/api/cards/${originalId}/notes`, { notes: "Alice's later note" });

      const copy = (await as(bob).get(`/api/cards/${copyId}`)).body.data;
      expect(copy).toMatchObject({ aiSummary: "First summary", aiSubjects: ["Before"], notes: null });
    });

    it("lets the new owner edit the copy without changing the original", async () => {
      const edited = await as(bob).patch(`/api/cards/${copyId}/ai-metadata`, { aiSummary: "Bob's summary" });
      expect(edited.status).toBe(200);
      expect((await as(bob).patch(`/api/cards/${copyId}/notes`, { notes: "Bob's note" })).status).toBe(200);

      const original = (await as(alice).get(`/api/cards/${originalId}`)).body.data;
      expect(original.aiSummary).toBe("Changed summary");
      expect(original.notes).toBe("Alice's later note");
    });

    it("does not let the original owner edit or delete the copy", async () => {
      expect((await as(alice).patch(`/api/cards/${copyId}/notes`, { notes: "x" })).status).toBe(404);
      expect((await as(alice).patch(`/api/cards/${copyId}/ai-metadata`, { aiSummary: "x" })).status).toBe(404);
      expect((await as(alice).patch(`/api/cards/${copyId}/visibility`, { visibility: "PRIVATE" })).status).toBe(404);
      expect((await as(alice).delete(`/api/cards/${copyId}`)).status).toBe(404);
      expect((await as(bob).get(`/api/cards/${copyId}`)).body.data.aiSummary).toBe("Bob's summary");
    });

    it("keeps the copy and its attribution when the original is unpublished", async () => {
      await unpublish(alice, originalId);
      const copy = await as(bob).get(`/api/cards/${copyId}`);
      expect(copy.status).toBe(200);
      expect(copy.body.data.savedFrom).toEqual({
        cardId: originalId,
        authorUsername: "comalice",
        originalAvailable: false,
      });
    });

    it("keeps the copy and its attribution when the original is deleted", async () => {
      expect((await as(alice).delete(`/api/cards/${originalId}`)).status).toBe(200);
      const copy = await as(bob).get(`/api/cards/${copyId}`);
      expect(copy.status).toBe(200);
      expect(copy.body.data).toMatchObject({
        sourceText: "Original words",
        savedFrom: { cardId: originalId, authorUsername: "comalice", originalAvailable: false },
      });
    });
  });
});
