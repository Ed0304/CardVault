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

/** Collections, tags and card organisation against a real PostgreSQL database. */
const users = createUserTracker();

async function newCard(session: Session, text: string): Promise<string> {
  const res = await as(session).post("/api/cards", { sourceText: text });
  expect(res.status).toBe(201);
  return res.body.data.id;
}

async function newCollection(session: Session, name: string): Promise<string> {
  const res = await as(session).post("/api/collections", { name });
  expect(res.status).toBe(201);
  return res.body.data.id;
}

async function newTag(session: Session, name: string): Promise<string> {
  const res = await as(session).post("/api/tags", { name });
  expect(res.status).toBe(201);
  return res.body.data.id;
}

describeIntegration("Collections and tags (real database)", () => {
  let alice: Session;
  let bob: Session;

  beforeAll(async () => {
    assertTestDatabase();
    alice = await users.signUp("orgalice");
    bob = await users.signUp("orgbob");
  });

  afterAll(async () => {
    await users.cleanUp();
  });

  describe("authentication", () => {
    it("rejects every collection, tag and organisation route without a session", async () => {
      const id = crypto.randomUUID();
      const responses = await Promise.all([
        request(app).get("/api/collections"),
        request(app).post("/api/collections").send({ name: "x" }),
        request(app).patch(`/api/collections/${id}`).send({ name: "x" }),
        request(app).delete(`/api/collections/${id}`),
        request(app).get("/api/tags"),
        request(app).post("/api/tags").send({ name: "x" }),
        request(app).delete(`/api/tags/${id}`),
        request(app).patch(`/api/cards/${id}/collection`).send({ collectionId: null }),
        request(app).post(`/api/cards/${id}/tags/${id}`),
        request(app).delete(`/api/cards/${id}/tags/${id}`),
      ]);
      for (const res of responses) expect(res.status).toBe(401);
    });
  });

  describe("collections", () => {
    it("creates and lists collections alphabetically with card counts", async () => {
      const user = await users.signUp("colllist");
      expect((await as(user).get("/api/collections")).body.data).toEqual([]);

      const created = await as(user).post("/api/collections", { name: "  Reading list  " });
      expect(created.status).toBe(201);
      expect(created.body.data).toMatchObject({ name: "Reading list", cardCount: 0 });
      await newCollection(user, "archive");

      const list = await as(user).get("/api/collections");
      expect(list.status).toBe(200);
      expect(list.body.data.map((c: { name: string }) => c.name)).toEqual(["archive", "Reading list"]);
    });

    it.each([
      ["a missing name", {}],
      ["an empty name", { name: "   " }],
      ["a name over 100 characters", { name: "x".repeat(101) }],
    ])("rejects %s with 400", async (_label, body) => {
      const res = await as(alice).post("/api/collections", body);
      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe("VALIDATION_ERROR");
    });

    it("rejects a duplicate name for the same user with 409, but allows it for another user", async () => {
      await newCollection(alice, "Duplicates");
      const again = await as(alice).post("/api/collections", { name: "Duplicates" });
      expect(again.status).toBe(409);
      expect(again.body.error.code).toBe("COLLECTION_NAME_TAKEN");
      expect((await as(bob).post("/api/collections", { name: "Duplicates" })).status).toBe(201);
    });

    it("renames a collection, and rejects renaming onto an existing name", async () => {
      const id = await newCollection(alice, "Old name");
      await newCollection(alice, "Taken name");

      const renamed = await as(alice).patch(`/api/collections/${id}`, { name: "New name" });
      expect(renamed.status).toBe(200);
      expect(renamed.body.data).toMatchObject({ id, name: "New name" });

      const clash = await as(alice).patch(`/api/collections/${id}`, { name: "Taken name" });
      expect(clash.status).toBe(409);
      expect((await as(alice).patch(`/api/collections/${id}`, { name: "" })).status).toBe(400);
    });

    it("deletes a collection and keeps its cards, now uncollected", async () => {
      const id = await newCollection(alice, "Short-lived");
      const cardId = await newCard(alice, "Card in a doomed collection");
      expect((await as(alice).patch(`/api/cards/${cardId}/collection`, { collectionId: id })).status).toBe(200);

      expect((await as(alice).delete(`/api/collections/${id}`)).status).toBe(200);
      expect((await as(alice).delete(`/api/collections/${id}`)).status).toBe(404);

      const card = (await as(alice).get(`/api/cards/${cardId}`)).body.data;
      expect(card.collection).toBeNull();
      const db = await pool.query("SELECT collection_id FROM knowledge_cards WHERE id = $1", [cardId]);
      expect(db.rows[0].collection_id).toBeNull();
    });

    it("returns 404 for unknown and malformed collection ids", async () => {
      expect((await as(alice).patch(`/api/collections/${crypto.randomUUID()}`, { name: "x" })).status).toBe(404);
      expect((await as(alice).delete("/api/collections/not-a-uuid")).status).toBe(404);
    });
  });

  describe("assigning cards to collections", () => {
    it("assigns, moves and removes a card's collection", async () => {
      const first = await newCollection(alice, "First");
      const second = await newCollection(alice, "Second");
      const cardId = await newCard(alice, "Card to organise");

      const assigned = await as(alice).patch(`/api/cards/${cardId}/collection`, { collectionId: first });
      expect(assigned.status).toBe(200);
      expect(assigned.body.data.collection).toEqual({ id: first, name: "First" });

      const moved = await as(alice).patch(`/api/cards/${cardId}/collection`, { collectionId: second });
      expect(moved.body.data.collection).toEqual({ id: second, name: "Second" });

      const counts = (await as(alice).get("/api/collections")).body.data as { id: string; cardCount: number }[];
      expect(counts.find((c) => c.id === first)?.cardCount).toBe(0);
      expect(counts.find((c) => c.id === second)?.cardCount).toBe(1);

      const removed = await as(alice).patch(`/api/cards/${cardId}/collection`, { collectionId: null });
      expect(removed.status).toBe(200);
      expect(removed.body.data.collection).toBeNull();
    });

    it("rejects invalid assignment bodies with 400", async () => {
      const cardId = await newCard(alice, "Card for bad bodies");
      expect((await as(alice).patch(`/api/cards/${cardId}/collection`, {})).status).toBe(400);
      expect((await as(alice).patch(`/api/cards/${cardId}/collection`, { collectionId: "nope" })).status).toBe(400);
    });

    it("returns 404 for an unknown collection or card", async () => {
      const cardId = await newCard(alice, "Card for unknown collection");
      const unknownCollection = await as(alice).patch(`/api/cards/${cardId}/collection`, {
        collectionId: crypto.randomUUID(),
      });
      expect(unknownCollection.status).toBe(404);
      expect(unknownCollection.body.error.code).toBe("COLLECTION_NOT_FOUND");

      const collectionId = await newCollection(alice, "Real collection");
      const unknownCard = await as(alice).patch(`/api/cards/${crypto.randomUUID()}/collection`, { collectionId });
      expect(unknownCard.status).toBe(404);
      expect(unknownCard.body.error.code).toBe("CARD_NOT_FOUND");
    });
  });

  describe("tags", () => {
    it("creates, lists and deletes tags", async () => {
      const user = await users.signUp("taglist");
      expect((await as(user).get("/api/tags")).body.data).toEqual([]);

      const created = await as(user).post("/api/tags", { name: " history " });
      expect(created.status).toBe(201);
      expect(created.body.data).toMatchObject({ name: "history", cardCount: 0 });
      await newTag(user, "Art");

      const list = (await as(user).get("/api/tags")).body.data;
      expect(list.map((t: { name: string }) => t.name)).toEqual(["Art", "history"]);

      expect((await as(user).delete(`/api/tags/${created.body.data.id}`)).status).toBe(200);
      expect((await as(user).delete(`/api/tags/${created.body.data.id}`)).status).toBe(404);
      expect((await as(user).get("/api/tags")).body.data).toHaveLength(1);
    });

    it("rejects invalid and duplicate tag names", async () => {
      expect((await as(alice).post("/api/tags", {})).status).toBe(400);
      expect((await as(alice).post("/api/tags", { name: "" })).status).toBe(400);
      expect((await as(alice).post("/api/tags", { name: "x".repeat(101) })).status).toBe(400);

      await newTag(alice, "unique-tag");
      const again = await as(alice).post("/api/tags", { name: "unique-tag" });
      expect(again.status).toBe(409);
      expect(again.body.error.code).toBe("TAG_NAME_TAKEN");
    });

    it("adds and removes tags on a card, idempotently", async () => {
      const cardId = await newCard(alice, "Card to tag");
      const science = await newTag(alice, "science");
      const maths = await newTag(alice, "maths");

      const added = await as(alice).post(`/api/cards/${cardId}/tags/${science}`);
      expect(added.status).toBe(200);
      expect(added.body.data.tags).toEqual([{ id: science, name: "science" }]);

      const twice = await as(alice).post(`/api/cards/${cardId}/tags/${science}`);
      expect(twice.status).toBe(200);
      expect(twice.body.data.tags).toHaveLength(1);

      await as(alice).post(`/api/cards/${cardId}/tags/${maths}`);
      const both = (await as(alice).get(`/api/cards/${cardId}`)).body.data;
      expect(both.tags.map((t: { name: string }) => t.name)).toEqual(["maths", "science"]);

      const tags = (await as(alice).get("/api/tags")).body.data as { id: string; cardCount: number }[];
      expect(tags.find((t) => t.id === science)?.cardCount).toBe(1);

      const removed = await as(alice).delete(`/api/cards/${cardId}/tags/${science}`);
      expect(removed.status).toBe(200);
      expect(removed.body.data.tags).toEqual([{ id: maths, name: "maths" }]);
      expect((await as(alice).delete(`/api/cards/${cardId}/tags/${science}`)).status).toBe(200);
    });

    it("deleting a tag removes it from every card without touching the cards", async () => {
      const tagId = await newTag(alice, "temporary");
      const cardA = await newCard(alice, "Tagged A");
      const cardB = await newCard(alice, "Tagged B");
      await as(alice).post(`/api/cards/${cardA}/tags/${tagId}`);
      await as(alice).post(`/api/cards/${cardB}/tags/${tagId}`);

      expect((await as(alice).delete(`/api/tags/${tagId}`)).status).toBe(200);

      for (const id of [cardA, cardB]) {
        const card = await as(alice).get(`/api/cards/${id}`);
        expect(card.status).toBe(200);
        expect(card.body.data.tags).toEqual([]);
      }
      const links = await pool.query("SELECT 1 FROM card_tags WHERE tag_id = $1", [tagId]);
      expect(links.rowCount).toBe(0);
    });

    it("returns 404 for unknown and malformed tag or card ids", async () => {
      const cardId = await newCard(alice, "Card for unknown tag");
      const unknownTag = await as(alice).post(`/api/cards/${cardId}/tags/${crypto.randomUUID()}`);
      expect(unknownTag.status).toBe(404);
      expect(unknownTag.body.error.code).toBe("TAG_NOT_FOUND");
      expect((await as(alice).post(`/api/cards/${cardId}/tags/not-a-uuid`)).status).toBe(404);

      const tagId = await newTag(alice, "orphan-check");
      const unknownCard = await as(alice).post(`/api/cards/${crypto.randomUUID()}/tags/${tagId}`);
      expect(unknownCard.status).toBe(404);
      expect(unknownCard.body.error.code).toBe("CARD_NOT_FOUND");
      expect((await as(alice).delete("/api/tags/not-a-uuid")).status).toBe(404);
    });
  });

  describe("cross-user isolation", () => {
    let aliceCard: string;
    let aliceCollection: string;
    let aliceTag: string;
    let bobCard: string;
    let bobCollection: string;
    let bobTag: string;

    beforeAll(async () => {
      aliceCard = await newCard(alice, "Alice's private card");
      aliceCollection = await newCollection(alice, "Alice private");
      aliceTag = await newTag(alice, "alice-private");
      await as(alice).patch(`/api/cards/${aliceCard}/collection`, { collectionId: aliceCollection });
      await as(alice).post(`/api/cards/${aliceCard}/tags/${aliceTag}`);

      bobCard = await newCard(bob, "Bob's card");
      bobCollection = await newCollection(bob, "Bob private");
      bobTag = await newTag(bob, "bob-private");
    });

    it("never lists another user's collections or tags", async () => {
      const collections = (await as(bob).get("/api/collections")).body.data as { id: string }[];
      const tags = (await as(bob).get("/api/tags")).body.data as { id: string }[];
      expect(collections.map((c) => c.id)).not.toContain(aliceCollection);
      expect(tags.map((t) => t.id)).not.toContain(aliceTag);
    });

    it("hides another user's collections and tags with 404 on rename and delete", async () => {
      expect((await as(bob).patch(`/api/collections/${aliceCollection}`, { name: "hijack" })).status).toBe(404);
      expect((await as(bob).delete(`/api/collections/${aliceCollection}`)).status).toBe(404);
      expect((await as(bob).delete(`/api/tags/${aliceTag}`)).status).toBe(404);

      const stillThere = (await as(alice).get("/api/collections")).body.data as { id: string; name: string }[];
      expect(stillThere.find((c) => c.id === aliceCollection)?.name).toBe("Alice private");
      expect(((await as(alice).get("/api/tags")).body.data as { id: string }[]).map((t) => t.id)).toContain(aliceTag);
    });

    it("refuses to put a card in another user's collection", async () => {
      const res = await as(bob).patch(`/api/cards/${bobCard}/collection`, { collectionId: aliceCollection });
      expect(res.status).toBe(404);
      expect(res.body.error.code).toBe("COLLECTION_NOT_FOUND");
      const db = await pool.query("SELECT collection_id FROM knowledge_cards WHERE id = $1", [bobCard]);
      expect(db.rows[0].collection_id).toBeNull();
    });

    it("refuses to change another user's card, even with the caller's own collection or tag", async () => {
      const intoBobs = await as(bob).patch(`/api/cards/${aliceCard}/collection`, { collectionId: bobCollection });
      expect(intoBobs.status).toBe(404);
      expect(intoBobs.body.error.code).toBe("CARD_NOT_FOUND");
      const out = await as(bob).patch(`/api/cards/${aliceCard}/collection`, { collectionId: null });
      expect(out.status).toBe(404);

      expect((await as(bob).post(`/api/cards/${aliceCard}/tags/${bobTag}`)).status).toBe(404);
      expect((await as(bob).delete(`/api/cards/${aliceCard}/tags/${aliceTag}`)).status).toBe(404);

      const card = (await as(alice).get(`/api/cards/${aliceCard}`)).body.data;
      expect(card.collection).toEqual({ id: aliceCollection, name: "Alice private" });
      expect(card.tags).toEqual([{ id: aliceTag, name: "alice-private" }]);
    });

    it("refuses to put another user's tag on a card", async () => {
      const res = await as(bob).post(`/api/cards/${bobCard}/tags/${aliceTag}`);
      expect(res.status).toBe(404);
      expect(res.body.error.code).toBe("TAG_NOT_FOUND");
      const links = await pool.query("SELECT 1 FROM card_tags WHERE card_id = $1", [bobCard]);
      expect(links.rowCount).toBe(0);
    });

    it("counts only the owner's cards in collection and tag counts", async () => {
      const collections = (await as(alice).get("/api/collections")).body.data as { id: string; cardCount: number }[];
      expect(collections.find((c) => c.id === aliceCollection)?.cardCount).toBe(1);
      const tags = (await as(alice).get("/api/tags")).body.data as { id: string; cardCount: number }[];
      expect(tags.find((t) => t.id === aliceTag)?.cardCount).toBe(1);
    });
  });

  describe("card list filters use the new endpoints end to end", () => {
    it("filters by a collection and a tag created through the API", async () => {
      const user = await users.signUp("orgfilter");
      const collectionId = await newCollection(user, "Filtered");
      const tagId = await newTag(user, "filtered");
      const inBoth = await newCard(user, "In both");
      const onlyCollection = await newCard(user, "Only collection");
      await newCard(user, "Neither");

      await as(user).patch(`/api/cards/${inBoth}/collection`, { collectionId });
      await as(user).patch(`/api/cards/${onlyCollection}/collection`, { collectionId });
      await as(user).post(`/api/cards/${inBoth}/tags/${tagId}`);

      expect((await as(user).get(`/api/cards?collectionId=${collectionId}`)).body.data.total).toBe(2);
      const byTag = (await as(user).get(`/api/cards?tagId=${tagId}`)).body.data;
      expect(byTag.total).toBe(1);
      expect(byTag.items[0].id).toBe(inBoth);
    });
  });
});
