import { afterAll, beforeAll, describe, expect, it } from "@jest/globals";
import {
  as,
  assertTestDatabase,
  createUserTracker,
  describeIntegration,
  pool,
  type Session,
} from "./helpers/integration.js";

/**
 * Structured catalog entries (REQ-AI-017, REQ-CAT-015): catalog title, facts and related concepts,
 * as edited by the owner, linked to other cards, searched, published and copied.
 */
const users = createUserTracker();
const RUN = `ent${Date.now().toString(36)}`;

async function newCard(session: Session, title: string, text = `Source text ${RUN} ${crypto.randomUUID()}`) {
  const res = await as(session).post("/api/cards", { sourceText: text, sourceTitle: title });
  expect(res.status).toBe(201);
  return res.body.data.id as string;
}

const edit = (session: Session, id: string, body: object) => as(session).patch(`/api/cards/${id}/ai-metadata`, body);

describeIntegration("Structured catalog entries (real database)", () => {
  let alice: Session;
  let bob: Session;

  beforeAll(async () => {
    assertTestDatabase();
    alice = await users.signUp("entalice");
    bob = await users.signUp("entbob");
  });

  afterAll(async () => {
    await users.cleanUp();
  });

  describe("catalog title", () => {
    it("is separate from the source title, editable, and clears back to the source title", async () => {
      const id = await newCard(alice, `Marie Curie - Example Encyclopedia ${RUN}`);
      const fresh = (await as(alice).get(`/api/cards/${id}`)).body.data;
      expect(fresh).toMatchObject({ catalogTitle: null, aiFacts: [], aiRelated: [] });

      const titled = await edit(alice, id, { catalogTitle: "  Marie Curie  " });
      expect(titled.status).toBe(200);
      expect(titled.body.data).toMatchObject({
        catalogTitle: "Marie Curie",
        sourceTitle: `Marie Curie - Example Encyclopedia ${RUN}`,
      });

      const cleared = await edit(alice, id, { catalogTitle: "" });
      expect(cleared.body.data.catalogTitle).toBeNull();

      const list = (await as(alice).get("/api/cards?pageSize=50")).body.data.items as { id: string; catalogTitle: unknown }[];
      expect(list.find((c) => c.id === id)).toHaveProperty("catalogTitle", null);
    });
  });

  describe("owner edits", () => {
    it("saves facts and related concepts, and changes only the fields sent", async () => {
      const id = await newCard(alice, `Edit target ${RUN}`);
      await edit(alice, id, { aiSummary: "Kept.", aiSubjects: ["Kept heading"] });
      const res = await edit(alice, id, {
        aiFacts: [{ label: " Author ", value: " Jane Doe " }],
        aiRelated: [{ name: "Some Work", relation: "Sequel" }],
      });
      expect(res.status).toBe(200);
      expect(res.body.data).toMatchObject({
        aiSummary: "Kept.",
        aiSubjects: ["Kept heading"],
        aiFacts: [{ label: "Author", value: "Jane Doe" }],
        aiRelated: [{ name: "Some Work", relation: "Sequel", cardId: null }],
      });
      // Empty lists clear them.
      const cleared = await edit(alice, id, { aiFacts: [], aiRelated: [] });
      expect(cleared.body.data).toMatchObject({ aiFacts: [], aiRelated: [] });
    });

    it("stores only label/value and name/relation, dropping other keys", async () => {
      const id = await newCard(alice, `Strip keys ${RUN}`);
      await edit(alice, id, {
        aiFacts: [{ label: "Type", value: "Thing", extra: "<b>x</b>" }],
        aiRelated: [{ name: "Other", relation: "Part of", cardId: crypto.randomUUID() }],
      });
      const row = await pool.query("SELECT ai_facts, ai_related FROM knowledge_cards WHERE id = $1", [id]);
      expect(row.rows[0]).toEqual({
        ai_facts: [{ label: "Type", value: "Thing" }],
        ai_related: [{ name: "Other", relation: "Part of" }],
      });
    });

    it.each([
      ["nine facts", { aiFacts: Array.from({ length: 9 }, (_, i) => ({ label: `L${i}`, value: "v" })) }],
      ["a fact without a label", { aiFacts: [{ label: "", value: "v" }] }],
      ["an overlong fact value", { aiFacts: [{ label: "L", value: "v".repeat(201) }] }],
      ["nine related concepts", { aiRelated: Array.from({ length: 9 }, (_, i) => ({ name: `N${i}`, relation: "r" })) }],
      ["a related concept without a relation", { aiRelated: [{ name: "N", relation: " " }] }],
      ["an overlong title", { catalogTitle: "t".repeat(201) }],
      ["an empty body", {}],
    ])("rejects %s with 400", async (_label, body) => {
      const id = await newCard(alice, `Invalid ${RUN}`);
      const res = await edit(alice, id, body);
      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe("VALIDATION_ERROR");
    });

    it("refuses another user's card", async () => {
      const id = await newCard(alice, `Not Bob's ${RUN}`);
      expect((await edit(bob, id, { catalogTitle: "Hijack" })).status).toBe(404);
      expect((await as(alice).get(`/api/cards/${id}`)).body.data.catalogTitle).toBeNull();
    });
  });

  describe("related-concept links", () => {
    it("links to the owner's own cards by catalog or source title, and nothing else", async () => {
      const byCatalogTitle = await newCard(alice, `Unrelated source title ${RUN}`);
      await edit(alice, byCatalogTitle, { catalogTitle: `Winter Roots ${RUN}` });
      const bySourceTitle = await newCard(alice, `Thomas Hardy ${RUN}`);
      await newCard(bob, `Ceredigion ${RUN}`); // another user's card: never linked
      const subject = await newCard(alice, `The Silent Orchard ${RUN}`);

      const res = await edit(alice, subject, {
        catalogTitle: `The Silent Orchard ${RUN}`,
        aiRelated: [
          { name: `winter roots ${RUN}`, relation: "Sequel" },
          { name: `Thomas Hardy ${RUN}`, relation: "Stylistic comparison" },
          { name: `Ceredigion ${RUN}`, relation: "Setting" },
          { name: `The Silent Orchard ${RUN}`, relation: "Itself" },
          { name: `No such card ${RUN}`, relation: "Mentioned" },
        ],
      });
      expect(res.body.data.aiRelated.map((r: { cardId: string | null }) => r.cardId)).toEqual([
        byCatalogTitle,
        bySourceTitle,
        null,
        null, // a card never links to itself
        null,
      ]);
    });
  });

  describe("search", () => {
    it("finds cards by catalog title, fact values and related-concept names", async () => {
      const id = await newCard(alice, `Search target ${RUN}`);
      await edit(alice, id, {
        catalogTitle: `Quillfeather ${RUN}`,
        aiFacts: [{ label: "Designer", value: `Ostrava${RUN}` }],
        aiRelated: [{ name: `Brimstone${RUN}`, relation: "Successor" }],
      });
      for (const q of [`quillfeather ${RUN}`, `ostrava${RUN}`, `brimstone${RUN}`]) {
        const res = await as(alice).get(`/api/cards?q=${encodeURIComponent(q)}`);
        expect(res.body.data.items.map((c: { id: string }) => c.id)).toEqual([id]);
      }
      expect((await as(bob).get(`/api/cards?q=${encodeURIComponent(`ostrava${RUN}`)}`)).body.data.total).toBe(0);
    });
  });

  describe("public catalog entries", () => {
    let published: string;
    let privateMatch: string;
    let publicMatch: string;

    beforeAll(async () => {
      privateMatch = await newCard(alice, `Private Neighbour ${RUN}`);
      publicMatch = await newCard(bob, `Public Neighbour ${RUN}`);
      await as(bob).patch(`/api/cards/${publicMatch}/visibility`, { visibility: "PUBLIC", shareSourceText: false });

      published = await newCard(alice, `Published - Example Site ${RUN}`, "SECRET SOURCE TEXT that is not shared");
      await as(alice).patch(`/api/cards/${published}/notes`, { notes: "PRIVATE NOTE" });
      await edit(alice, published, {
        catalogTitle: `Published ${RUN}`,
        aiSummary: "An original catalog description.",
        aiFacts: [{ label: "Type", value: "Example" }],
        aiRelated: [
          { name: `Private Neighbour ${RUN}`, relation: "Sibling" },
          { name: `Public Neighbour ${RUN}`, relation: "Sibling" },
        ],
      });
      await as(alice).patch(`/api/cards/${published}/visibility`, { visibility: "PUBLIC", shareSourceText: false });
    });

    it("shows the catalog entry but not the unshared source text, notes or draft", async () => {
      const res = await as(bob).get(`/api/community/cards/${published}`);
      expect(res.status).toBe(200);
      expect(res.body.data).toMatchObject({
        catalogTitle: `Published ${RUN}`,
        sourceTitle: `Published - Example Site ${RUN}`,
        aiSummary: "An original catalog description.",
        aiFacts: [{ label: "Type", value: "Example" }],
        sourceText: null,
      });
      const raw = JSON.stringify(res.body);
      for (const secret of ["SECRET SOURCE TEXT", "PRIVATE NOTE", "aiCatalogDraft", alice.userId]) {
        expect(raw).not.toContain(secret);
      }
    });

    it("links related concepts to published cards only", async () => {
      const related = (await as(bob).get(`/api/community/cards/${published}`)).body.data.aiRelated;
      expect(related).toEqual([
        { name: `Private Neighbour ${RUN}`, relation: "Sibling", cardId: null },
        { name: `Public Neighbour ${RUN}`, relation: "Sibling", cardId: publicMatch },
      ]);
      // The owner's own view links their private card.
      const own = (await as(alice).get(`/api/cards/${published}`)).body.data.aiRelated;
      expect(own[0].cardId).toBe(privateMatch);
    });

    it("lists and searches the catalog title publicly", async () => {
      const res = await as(bob).get(`/api/community/cards?q=${encodeURIComponent(`Published ${RUN}`)}`);
      expect(res.body.data.items.map((c: { id: string }) => c.id)).toContain(published);
      expect(res.body.data.items.find((c: { id: string }) => c.id === published).catalogTitle).toBe(`Published ${RUN}`);
      const byFact = await as(bob).get(`/api/community/cards?q=${encodeURIComponent("Example")}&pageSize=50`);
      expect(byFact.body.data.items.map((c: { id: string }) => c.id)).toContain(published);
    });

    it("copies the catalog entry into a saved copy", async () => {
      const copy = (await as(bob).post(`/api/community/cards/${published}/save`)).body.data;
      expect(copy).toMatchObject({
        catalogTitle: `Published ${RUN}`,
        aiFacts: [{ label: "Type", value: "Example" }],
        notes: null,
        sourceText: "",
      });
      expect(copy.aiRelated.map((r: { name: string }) => r.name)).toEqual([
        `Private Neighbour ${RUN}`,
        `Public Neighbour ${RUN}`,
      ]);
      // In Bob's vault, links point only at Bob's own cards.
      expect(copy.aiRelated[1].cardId).toBe(publicMatch);
      expect(copy.aiRelated[0].cardId).toBeNull();
    });
  });

  it("reads drafts made before the structured fields existed", async () => {
    const id = await newCard(alice, `Old draft ${RUN}`);
    await pool.query(
      `UPDATE knowledge_cards SET ai_catalog_status = 'COMPLETE', ai_catalog_draft = $1::jsonb WHERE id = $2`,
      [JSON.stringify({ summary: "Old.", subjects: ["S"], keywords: ["k"], model: "m", truncated: false, generatedAt: "2026-01-01T00:00:00Z" }), id],
    );
    const draft = (await as(alice).get(`/api/cards/${id}`)).body.data.aiCatalogDraft;
    expect(draft).toMatchObject({ catalogTitle: null, summary: "Old.", facts: [], related: [] });
  });
});
