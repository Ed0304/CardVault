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

/**
 * Guest discovery, welcome onboarding and recommendations (Discovery spec), against a real
 * database. Other test files may publish cards at the same time, so assertions look only at
 * cards and topics carrying this run's marker.
 */
const users = createUserTracker();
const RUN = `run${Date.now().toString(36)}`;
// Single-word topics unique to this run.
const TOPIC = `zyx${RUN}`;
const VAULT_TOPIC = `vlt${RUN}`;

const PUBLIC_SUMMARY_KEYS = [
  "aiKeywords",
  "aiSubjects",
  "aiSummary",
  "author",
  "catalogTitle",
  "hasSourceText",
  "id",
  "publishedAt",
  "sourceTitle",
  "sourceUrl",
];
const PUBLIC_DETAIL_KEYS = [...PUBLIC_SUMMARY_KEYS, "aiFacts", "aiRelated", "sourceText", "viewer"].sort();

async function newCard(
  session: Session,
  spec: { title: string; subjects?: string[]; notes?: string; publish?: boolean },
): Promise<string> {
  const created = await as(session).post("/api/cards", {
    sourceText: `Original text ${RUN} ${crypto.randomUUID()}`,
    sourceTitle: spec.title,
  });
  expect(created.status).toBe(201);
  const id = created.body.data.id as string;
  if (spec.notes) expect((await as(session).patch(`/api/cards/${id}/notes`, { notes: spec.notes })).status).toBe(200);
  if (spec.subjects) {
    const res = await as(session).patch(`/api/cards/${id}/ai-metadata`, {
      aiSummary: `A catalog description for ${spec.title}.`,
      aiSubjects: spec.subjects,
      aiKeywords: [],
    });
    expect(res.status).toBe(200);
  }
  if (spec.publish) {
    const res = await as(session).patch(`/api/cards/${id}/visibility`, { visibility: "PUBLIC", shareSourceText: false });
    expect(res.status).toBe(200);
  }
  return id;
}

interface RecommendationItem {
  card: { id: string } & Record<string, unknown>;
  reason: { kind: string; text: string; topics: string[]; vaultCard?: { id: string; title: string } };
}

async function recommendations(session: Session): Promise<RecommendationItem[]> {
  const res = await as(session).get("/api/recommendations");
  expect(res.status).toBe(200);
  expect(res.body.data.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  return res.body.data.items as RecommendationItem[];
}

describeIntegration("Guest discovery, onboarding and recommendations (real database)", () => {
  let alice: Session;
  let bob: Session;
  let carol: Session;
  let publicId: string;
  let privateId: string;

  beforeAll(async () => {
    assertTestDatabase();
    alice = await users.signUp("discalice");
    bob = await users.signUp("discbob");
    carol = await users.signUp("disccarol");
    publicId = await newCard(alice, { title: `Public ${RUN}`, subjects: [TOPIC], notes: "PRIVATE NOTE", publish: true });
    privateId = await newCard(alice, { title: `Private ${RUN}`, subjects: [TOPIC, `secret${RUN}`] });
  });

  afterAll(async () => {
    await users.cleanUp();
  });

  describe("guest access to the Community Catalog", () => {
    it("lets a guest list and search published cards, and only published ones", async () => {
      const res = await request(app).get(`/api/community/cards?pageSize=50&q=${RUN}`);
      expect(res.status).toBe(200);
      const ids = (res.body.data.items as { id: string }[]).map((item) => item.id);
      expect(ids).toContain(publicId);
      expect(ids).not.toContain(privateId);
      for (const item of res.body.data.items) expect(Object.keys(item).sort()).toEqual(PUBLIC_SUMMARY_KEYS);
    });

    it("lets a guest open a published card, without notes, emails or a viewer", async () => {
      const res = await request(app).get(`/api/community/cards/${publicId}`);
      expect(res.status).toBe(200);
      expect(Object.keys(res.body.data).sort()).toEqual(PUBLIC_DETAIL_KEYS);
      expect(res.body.data.viewer).toBeNull();
      expect(res.body.data.sourceText).toBeNull();
      const raw = JSON.stringify(res.body);
      for (const secret of ["PRIVATE NOTE", "@integration.test", alice.userId]) expect(raw).not.toContain(secret);
    });

    it("gives a guest the same 404 for a private, unknown or malformed card", async () => {
      for (const id of [privateId, crypto.randomUUID(), "not-a-uuid"]) {
        const res = await request(app).get(`/api/community/cards/${id}`);
        expect(res.status).toBe(404);
        expect(res.body.data).toBeNull();
      }
    });

    it("treats an invalid session cookie on a public read as a guest", async () => {
      const res = await request(app).get(`/api/community/cards/${publicId}`).set("Cookie", "cv_token=not.a.token");
      expect(res.status).toBe(200);
      expect(res.body.data.viewer).toBeNull();
    });

    it("still tells a signed-in viewer what they can do", async () => {
      const res = await as(bob).get(`/api/community/cards/${publicId}`);
      expect(res.body.data.viewer).toEqual({ isOwner: false, savedCardId: null });
    });

    it("requires a session to create, save, edit, publish, or read a vault", async () => {
      const responses = await Promise.all([
        request(app).post("/api/cards").send({ sourceText: "x" }),
        request(app).post("/api/cards/from-url").send({ url: "https://example.com" }),
        request(app).get("/api/cards"),
        request(app).get(`/api/cards/${privateId}`),
        request(app).patch(`/api/cards/${publicId}/notes`).send({ notes: "x" }),
        request(app).patch(`/api/cards/${publicId}/ai-metadata`).send({ aiSummary: "x" }),
        request(app).patch(`/api/cards/${publicId}/visibility`).send({ visibility: "PRIVATE" }),
        request(app).post(`/api/community/cards/${publicId}/save`),
        request(app).get("/api/collections"),
        request(app).get("/api/tags"),
        request(app).get("/api/preferences"),
        request(app).put("/api/preferences").send({ surpriseMe: true }),
        request(app).get("/api/preferences/topics"),
        request(app).get("/api/recommendations"),
      ]);
      for (const res of responses) expect(res.status).toBe(401);
      // Nothing was saved or changed by those attempts.
      const card = await as(alice).get(`/api/cards/${publicId}`);
      expect(card.body.data).toMatchObject({ visibility: "PUBLIC", notes: "PRIVATE NOTE" });
    });
  });

  describe("welcome onboarding", () => {
    it("reports a new account as not onboarded, with no preferences and no recommendations", async () => {
      const me = await as(carol).get("/api/auth/me");
      expect(me.body.data.user.onboardingCompleted).toBe(false);
      expect((await as(carol).get("/api/preferences")).body.data).toEqual({ preferences: null });
      const recs = await as(carol).get("/api/recommendations");
      expect(recs.status).toBe(409);
      expect(recs.body.error.code).toBe("ONBOARDING_REQUIRED");
    });

    it("requires at least one interest or Surprise me", async () => {
      for (const body of [{}, { interests: [] }, { interests: [], surpriseMe: false }, { interests: ["   "] }]) {
        const res = await as(carol).put("/api/preferences", body);
        expect(res.status).toBe(400);
        expect(res.body.error.code).toBe("VALIDATION_ERROR");
      }
      expect((await as(carol).get("/api/auth/me")).body.data.user.onboardingCompleted).toBe(false);
    });

    it("rejects too many, too long, or non-text interests and unknown priorities", async () => {
      const bad = [
        { interests: Array.from({ length: 21 }, (_, i) => `Topic ${i}`) },
        { interests: ["x".repeat(61)] },
        { interests: ["<script>"] },
        { interests: [42] },
        { surpriseMe: "yes" },
        { surpriseMe: true, priority: "LOUDEST" },
      ];
      for (const body of bad) expect((await as(carol).put("/api/preferences", body)).status).toBe(400);
    });

    it("accepts Surprise me alone and completes onboarding", async () => {
      const res = await as(carol).put("/api/preferences", { surpriseMe: true });
      expect(res.status).toBe(200);
      expect(res.body.data.preferences).toMatchObject({ interests: [], surpriseMe: true, priority: "BALANCED" });
      expect((await as(carol).get("/api/auth/me")).body.data.user.onboardingCompleted).toBe(true);
    });

    it("keeps preferences across sessions and lets the user edit them later", async () => {
      const first = await as(bob).put("/api/preferences", { interests: [` ${TOPIC} `, TOPIC.toUpperCase(), "Science"] });
      expect(first.status).toBe(200);
      // Trimmed, and kept once regardless of case.
      expect(first.body.data.preferences.interests).toEqual([TOPIC, "Science"]);

      const edited = await as(bob).put("/api/preferences", { interests: [TOPIC], surpriseMe: false, priority: "VAULT" });
      expect(edited.status).toBe(200);
      expect(edited.body.data.preferences).toMatchObject({ interests: [TOPIC], priority: "VAULT" });
      expect(edited.body.data.preferences.onboardedAt).toBe(first.body.data.preferences.onboardedAt);

      // A new login reads the same stored row.
      const stored = await pool.query("SELECT interests, priority FROM recommendation_preferences WHERE user_id = $1", [
        bob.userId,
      ]);
      expect(stored.rows[0]).toEqual({ interests: [TOPIC], priority: "VAULT" });
      expect((await as(bob).get("/api/preferences")).body.data.preferences.interests).toEqual([TOPIC]);
    });

    it("keeps each user's preferences private to them", async () => {
      // Bob has saved preferences above; Alice still sees only her own (none).
      expect((await as(alice).get("/api/preferences")).body.data).toEqual({ preferences: null });
      expect((await as(alice).get("/api/auth/me")).body.data.user.onboardingCompleted).toBe(false);
    });

    it("offers starter topics and public subject headings, never private ones", async () => {
      const res = await as(carol).get("/api/preferences/topics");
      expect(res.status).toBe(200);
      const topics = res.body.data.topics as { label: string; source: string }[];
      expect(topics.map((t) => t.label)).toEqual(expect.arrayContaining(["Cybersecurity", "Games and Pokémon"]));
      for (const t of topics) expect(["STARTER", "CATALOG"]).toContain(t.source);
      expect(topics.map((t) => t.label.toLowerCase())).not.toContain(`secret${RUN}`);
    });
  });

  describe("recommendations", () => {
    let vaultMatchId: string;
    let savedId: string;
    let bobPublicId: string;
    let bobVaultId: string;

    beforeAll(async () => {
      vaultMatchId = await newCard(alice, { title: `Vault match ${RUN}`, subjects: [VAULT_TOPIC], publish: true });
      savedId = await newCard(alice, { title: `Already saved ${RUN}`, subjects: [TOPIC], publish: true });
      bobPublicId = await newCard(bob, { title: `Bob public ${RUN}`, subjects: [TOPIC], publish: true });
      bobVaultId = await newCard(bob, { title: `Bob vault ${RUN}`, subjects: [VAULT_TOPIC] });
      expect((await as(bob).post(`/api/community/cards/${savedId}/save`)).status).toBe(201);
      expect((await as(bob).put("/api/preferences", { interests: [TOPIC] })).status).toBe(200);
    });

    it("recommends published cards matching the user's interest, with the reason", async () => {
      const items = await recommendations(bob);
      const pick = items.find((item) => item.card.id === publicId);
      expect(pick?.reason).toEqual({
        kind: "INTEREST",
        text: `Based on your interest in ${TOPIC}.`,
        topics: [TOPIC],
      });
    });

    it("recommends a card related to one in the user's vault, naming that card", async () => {
      const items = await recommendations(bob);
      const pick = items.find((item) => item.card.id === vaultMatchId);
      expect(pick?.reason).toMatchObject({
        kind: "VAULT",
        vaultCard: { id: bobVaultId, title: `Bob vault ${RUN}` },
      });
      expect(pick?.reason.text).toBe(`Shares “${VAULT_TOPIC}” with “Bob vault ${RUN}” in your vault.`);
    });

    it("never recommends private cards, the user's own cards, or cards already saved", async () => {
      const ids = (await recommendations(bob)).map((item) => item.card.id);
      expect(ids).not.toContain(privateId);
      expect(ids).not.toContain(bobPublicId);
      expect(ids).not.toContain(savedId);
    });

    it("returns only public fields of published cards by other users", async () => {
      for (const session of [bob, carol]) {
        const items = await recommendations(session);
        if (items.length === 0) continue;
        for (const item of items) {
          expect(Object.keys(item.card).sort()).toEqual(PUBLIC_SUMMARY_KEYS);
          expect(item.reason.text.length).toBeGreaterThan(10);
          expect(item.reason.text).not.toMatch(/recommended by ai/i);
        }
        const rows = await pool.query<{ visibility: string; user_id: string }>(
          "SELECT visibility, user_id FROM knowledge_cards WHERE id = ANY($1::uuid[])",
          [items.map((item) => item.card.id)],
        );
        expect(rows.rows).toHaveLength(items.length);
        for (const row of rows.rows) {
          expect(row.visibility).toBe("PUBLIC");
          expect(row.user_id).not.toBe(session.userId);
        }
        const raw = JSON.stringify(items);
        for (const secret of ["PRIVATE NOTE", "@integration.test"]) expect(raw).not.toContain(secret);
      }
    });

    it("never shows one user's vault in another user's recommendations", async () => {
      const raw = JSON.stringify(await recommendations(carol));
      expect(raw).not.toContain(`Bob vault ${RUN}`);
      expect(raw).not.toContain(bobVaultId);
    });

    it("drops a card from recommendations once it is unpublished", async () => {
      expect((await as(alice).patch(`/api/cards/${publicId}/visibility`, { visibility: "PRIVATE" })).status).toBe(200);
      expect((await recommendations(bob)).map((item) => item.card.id)).not.toContain(publicId);
      expect((await request(app).get(`/api/community/cards/${publicId}`)).status).toBe(404);
      expect(
        (await as(alice).patch(`/api/cards/${publicId}/visibility`, { visibility: "PUBLIC", shareSourceText: false })).status,
      ).toBe(200);
    });

    it("follows edited preferences", async () => {
      expect((await as(bob).put("/api/preferences", { interests: ["Astronomy"], surpriseMe: true })).status).toBe(200);
      const items = await recommendations(bob);
      expect(items.find((item) => item.card.id === publicId)?.reason.kind).not.toBe("INTEREST");
    });
  });
});
