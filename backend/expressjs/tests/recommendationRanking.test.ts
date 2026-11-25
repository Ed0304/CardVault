import { describe, expect, it } from "@jest/globals";
import {
  rankRecommendations,
  type RankingCandidate,
  type RankingProfile,
} from "../src/services/recommendationRanking.js";
import { termsForInterest } from "../src/services/topicCatalog.js";

/** Pure ranking rules for "Recommended for today" (REQ-DISC-008 to REQ-DISC-011). */

function card(id: string, fields: Partial<RankingCandidate> = {}): RankingCandidate {
  return { id, title: `Card ${id}`, subjects: [], keywords: [], related: [], summary: null, ...fields };
}

function profile(fields: Partial<RankingProfile> = {}): RankingProfile {
  return { interests: [], surpriseMe: false, priority: "BALANCED", vault: [], ...fields };
}

const seed = "user:2026-11-07";

describe("rankRecommendations", () => {
  it("returns nothing for an empty catalog", () => {
    expect(rankRecommendations([], profile({ interests: ["Science"] }), { seed })).toEqual([]);
    expect(rankRecommendations([], profile({ surpriseMe: true }), { seed })).toEqual([]);
  });

  it("puts cards matching an interest first, with a reason naming the interest", () => {
    const result = rankRecommendations(
      [
        card("a", { subjects: ["Baking"] }),
        card("b", { subjects: ["Computer security", "Malware"] }),
        card("c", { subjects: ["Gardening"] }),
      ],
      profile({ interests: ["Cybersecurity"] }),
      { seed },
    );
    expect(result[0]).toEqual({
      id: "b",
      reason: { kind: "INTEREST", text: "Based on your interest in Cybersecurity.", topics: ["Cybersecurity"] },
    });
  });

  it("matches starter topics through related terms, ignoring accents and plurals", () => {
    expect(termsForInterest("Games and Pokémon")).toEqual(expect.arrayContaining(["pokemon", "video game"]));
    const result = rankRecommendations(
      [card("x", { subjects: ["Pokémon species"] }), card("y", { keywords: ["Video games"] }), card("z")],
      profile({ interests: ["Games and Pokémon"] }),
      { seed },
    );
    const interestIds = result.filter((r) => r.reason.kind === "INTEREST").map((r) => r.id);
    expect(interestIds.sort()).toEqual(["x", "y"]);
  });

  it("does not match a term inside another word", () => {
    // "art" must not match "Martial arts" or "Smartphones".
    const result = rankRecommendations(
      [card("m", { subjects: ["Smartphones"] }), card("p", { subjects: ["Painting"] })],
      profile({ interests: ["Art and Culture"] }),
      { seed },
    );
    expect(result.find((r) => r.id === "m")?.reason.kind).not.toBe("INTEREST");
    expect(result.find((r) => r.id === "p")?.reason.kind).toBe("INTEREST");
  });

  it("explains a card that joins two of the user's topics", () => {
    const result = rankRecommendations(
      [card("h", { subjects: ["Music history"] }), card("s", { subjects: ["Music"] })],
      profile({ interests: ["History", "Music"] }),
      { seed },
    );
    expect(result[0]).toMatchObject({
      id: "h",
      reason: { kind: "BRIDGE", text: "Connects two topics you follow: History and Music.", topics: ["History", "Music"] },
    });
  });

  it("links a card to the user's own vault card that shares its headings", () => {
    const result = rankRecommendations(
      [card("v", { subjects: ["Typography"], keywords: ["Letterpress"] }), card("n", { subjects: ["Knitting"] })],
      profile({
        interests: ["Astronomy"],
        vault: [{ id: "mine", title: "Movable type", subjects: ["Typography"], keywords: [] }],
      }),
      { seed },
    );
    expect(result[0]).toEqual({
      id: "v",
      reason: {
        kind: "VAULT",
        text: "Shares “Typography” with “Movable type” in your vault.",
        topics: ["Typography"],
        vaultCard: { id: "mine", title: "Movable type" },
      },
    });
  });

  it("offers a neighbouring topic as discovery, not only the favourite topic", () => {
    const result = rankRecommendations(
      [
        card("p1", { subjects: ["Pokémon", "Folklore"] }),
        card("p2", { subjects: ["Pokémon"] }),
        card("f", { subjects: ["Folklore", "Kitsune"] }),
        card("far", { subjects: ["Accounting"] }),
      ],
      profile({ interests: ["Games and Pokémon"] }),
      { seed, limit: 3 },
    );
    const adjacent = result.find((r) => r.reason.kind === "ADJACENT");
    expect(adjacent).toEqual({
      id: "f",
      reason: {
        kind: "ADJACENT",
        text: "Close to your interest in Games and Pokémon: both touch on Folklore.",
        topics: ["Games and Pokémon", "Folklore"],
      },
    });
  });

  it("gives every pick a specific reason and recommends variety with Surprise me only", () => {
    const candidates = ["Botany", "Jazz", "Chess", "Volcanoes", "Origami", "Botany", "Rome", "Comets"].map((s, i) =>
      card(`c${i}`, { subjects: [s] }),
    );
    const result = rankRecommendations(candidates, profile({ surpriseMe: true }), { seed });
    expect(result).toHaveLength(6);
    for (const r of result) {
      expect(r.reason.kind).toBe("EXPLORE");
      expect(r.reason.text).toMatch(/^Explore something new: \S/);
    }
    // One card per subject while there are enough subjects to go round.
    const subjects = result.map((r) => r.reason.topics[0]);
    expect(new Set(subjects).size).toBe(6);
  });

  it("keeps a discovery slot even when many cards match the interest", () => {
    const matching = Array.from({ length: 10 }, (_, i) => card(`s${i}`, { subjects: [`Physics ${i}`, "Science"] }));
    const result = rankRecommendations([...matching, card("other", { subjects: ["Pottery"] })], profile({ interests: ["Science"] }), {
      seed,
    });
    expect(result).toHaveLength(6);
    expect(result.map((r) => r.id)).toContain("other");
    expect(result.filter((r) => r.reason.kind === "INTEREST")).toHaveLength(5);
  });

  it("is stable for the same seed and changes the discovery picks with the seed", () => {
    const candidates = Array.from({ length: 30 }, (_, i) => card(`e${i}`, { subjects: [`Subject ${i}`] }));
    const p = profile({ surpriseMe: true });
    expect(rankRecommendations(candidates, p, { seed })).toEqual(rankRecommendations(candidates, p, { seed }));
    const days = new Set(
      ["2026-11-01", "2026-11-02", "2026-11-03", "2026-11-04"].map((d) =>
        rankRecommendations(candidates, p, { seed: `user:${d}` }).map((r) => r.id).join(","),
      ),
    );
    expect(days.size).toBeGreaterThan(1);
  });

  it("lets the priority setting decide between interests and the vault", () => {
    const candidates = [
      card("int", { subjects: ["Computer security"] }),
      card("vlt", { subjects: ["Typography"], keywords: ["Printing"] }),
    ];
    const vault = [{ id: "mine", title: "Type", subjects: ["Typography"], keywords: ["Printing"] }];
    const interestsFirst = rankRecommendations(candidates, profile({ interests: ["Cybersecurity"], vault, priority: "INTERESTS" }), { seed });
    const vaultFirst = rankRecommendations(candidates, profile({ interests: ["Cybersecurity"], vault, priority: "VAULT" }), { seed });
    expect(interestsFirst[0]?.id).toBe("int");
    expect(vaultFirst[0]?.id).toBe("vlt");
  });

  it("never returns more than the limit or a card twice", () => {
    const candidates = Array.from({ length: 12 }, (_, i) => card(`d${i}`, { subjects: ["Science"] }));
    const result = rankRecommendations(candidates, profile({ interests: ["Science"], surpriseMe: true }), { seed, limit: 4 });
    expect(result).toHaveLength(4);
    expect(new Set(result.map((r) => r.id)).size).toBe(4);
  });
});
