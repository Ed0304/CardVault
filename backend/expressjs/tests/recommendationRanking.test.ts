import { describe, expect, it } from "@jest/globals";
import {
  MIN_PLURAL_STEM_LENGTH,
  rankRecommendations,
  type RankingCandidate,
  type RankingProfile,
} from "../src/services/recommendationRanking.js";
import { significantWords, termsForInterest } from "../src/services/topicCatalog.js";

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

  describe("plural matching (regression)", () => {
    const kindOf = (result: ReturnType<typeof rankRecommendations>, id: string) =>
      result.find((r) => r.id === id)?.reason.kind;

    it("does not read a short word plus 's' as its plural", () => {
      // Starter terms "art" (Art and Culture) and "war" (History) used to match these.
      const result = rankRecommendations(
        [card("martial", { subjects: ["Martial arts"] }), card("film", { title: "Star Wars", subjects: ["Space opera"] })],
        profile({ interests: ["Art and Culture", "History"] }),
        { seed },
      );
      expect(kindOf(result, "martial")).not.toBe("INTEREST");
      expect(kindOf(result, "film")).not.toBe("INTEREST");
    });

    it("does not let a short word plus 's' match in an any-order interest either", () => {
      const result = rankRecommendations(
        [card("m", { subjects: ["History of martial arts"] }), card("a", { subjects: ["History of art"] })],
        profile({ interests: ["Art history"] }),
        { seed },
      );
      expect(kindOf(result, "m")).not.toBe("INTEREST");
      expect(kindOf(result, "a")).toBe("INTEREST");
    });

    it("still matches plurals of longer words", () => {
      const result = rankRecommendations(
        [
          card("g", { keywords: ["Video games"] }),
          card("m", { subjects: ["Greek myths"] }),
          card("c", { subjects: ["Matches"] }),
        ],
        profile({ interests: ["Video game", "Greek myth", "Match"] }),
        { seed },
      );
      for (const id of ["g", "m", "c"]) expect(kindOf(result, id)).toBe("INTEREST");
    });

    it("matches short words exactly, singular or written plural", () => {
      // Short words match as written: "art" matches "Art", and "arts" matches "Arts", but one
      // does not stand in for the other. This is the accepted cost of the rule above.
      expect(MIN_PLURAL_STEM_LENGTH).toBe(4);
      const result = rankRecommendations(
        [card("art", { subjects: ["Art"] }), card("arts", { subjects: ["Arts"] }), card("x", { subjects: ["Pottery"] })],
        profile({ interests: ["Arts"] }),
        { seed },
      );
      expect(kindOf(result, "arts")).toBe("INTEREST");
      expect(kindOf(result, "art")).not.toBe("INTEREST");
    });
  });

  describe("word order in multi-word interests", () => {
    const kindOf = (result: ReturnType<typeof rankRecommendations>, id: string) =>
      result.find((r) => r.id === id)?.reason.kind;

    it("matches the same words in reversed order, ignoring connecting words", () => {
      const result = rankRecommendations(
        [card("rev", { subjects: ["History of the Internet"] }), card("other", { subjects: ["Pottery"] })],
        profile({ interests: ["Internet history"] }),
        { seed },
      );
      expect(result[0]).toEqual({
        id: "rev",
        reason: { kind: "INTEREST", text: "Based on your interest in Internet history.", topics: ["Internet history"] },
      });
    });

    it("matches in any order in titles, keywords and related concepts too", () => {
      const result = rankRecommendations(
        [
          card("t", { title: "A history of the internet" }),
          card("k", { keywords: ["history, internet"] }),
          card("r", { related: ["History of the Internet"] }),
        ],
        profile({ interests: ["Internet history"] }),
        { seed },
      );
      for (const id of ["t", "k", "r"]) expect(kindOf(result, id)).toBe("INTEREST");
    });

    it("still matches the exact phrase, including in descriptions", () => {
      const result = rankRecommendations(
        [
          card("exact", { subjects: ["Internet history"] }),
          card("desc", { summary: "A short tour of internet history for beginners." }),
        ],
        profile({ interests: ["Internet history"] }),
        { seed },
      );
      expect(kindOf(result, "exact")).toBe("INTEREST");
      expect(kindOf(result, "desc")).toBe("INTEREST");
    });

    it("does not match scattered words in a description", () => {
      const result = rankRecommendations(
        [card("scattered", { subjects: ["Pottery"], summary: "Its history goes back centuries; today it is sold on the internet." })],
        profile({ interests: ["Internet history"] }),
        { seed },
      );
      expect(kindOf(result, "scattered")).not.toBe("INTEREST");
    });

    it("does not match unrelated phrases that share one word", () => {
      const result = rankRecommendations(
        [
          card("cooking", { subjects: ["Science of cooking"] }),
          card("net", { subjects: ["History of the Internet"] }),
        ],
        profile({ interests: ["Computer science", "Political history"] }),
        { seed },
      );
      expect(kindOf(result, "cooking")).not.toBe("INTEREST");
      expect(kindOf(result, "net")).not.toBe("INTEREST");
    });

    it("does not match on generic connecting words", () => {
      // "History of art" and "History of the Internet" share only "history" and "of".
      const result = rankRecommendations(
        [card("net", { subjects: ["History of the Internet"] }), card("sci", { subjects: ["Science of the Moon"] })],
        profile({ interests: ["History of art", "Science and society"] }),
        { seed },
      );
      expect(kindOf(result, "net")).not.toBe("INTEREST");
      expect(kindOf(result, "sci")).not.toBe("INTEREST");
    });

    it("normalizes the words it compares", () => {
      expect(significantWords("history of the internet")).toEqual(["history", "internet"]);
      expect(significantWords("history of history")).toEqual(["history"]);
      expect(significantWords("the beatles")).toEqual(["beatles"]);
      expect(significantWords("cybersecurity")).toEqual([]);
      expect(significantWords("to and from")).toEqual([]);
      // Punctuation and a plural on the card's word: "Sci-Fi Film" matches the keyword
      // "Films, sci‑fi" (with a non-breaking hyphen). Accents: "magique realisme" matches
      // "Réalisme magique". All significant words must be present: "Sci-fi" alone does not
      // match "Sci-Fi Film".
      const result = rankRecommendations(
        [
          card("f", { keywords: ["Films, sci‑fi"] }),
          card("g", { keywords: ["Réalisme magique"] }),
          card("h", { keywords: ["Sci-fi"] }),
        ],
        profile({ interests: ["Sci-Fi Film", "magique realisme"] }),
        { seed },
      );
      expect(kindOf(result, "f")).toBe("INTEREST");
      expect(kindOf(result, "g")).toBe("INTEREST");
      expect(kindOf(result, "h")).not.toBe("INTEREST");
    });
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

  describe("catalog relationships and heading specificity", () => {
    const vaultCard = (fields: Partial<RankingProfile["vault"][number]>) => ({
      id: "mine",
      title: "Dark matter",
      subjects: [],
      keywords: [],
      ...fields,
    });

    it("recommends a card that a vault card lists as a related concept", () => {
      const result = rankRecommendations(
        [card("lens", { title: "Gravitational lensing", subjects: ["Astrophysics"] }), card("other", { subjects: ["Pottery"] })],
        profile({ interests: ["Knitting"], vault: [vaultCard({ related: ["Gravitational lensing"] })] }),
        { seed },
      );
      expect(result[0]).toEqual({
        id: "lens",
        reason: {
          kind: "VAULT",
          text: "“Dark matter” in your vault lists this as a related concept.",
          topics: [],
          vaultCard: { id: "mine", title: "Dark matter" },
        },
      });
    });

    it("recommends a card that lists a vault card as a related concept", () => {
      const result = rankRecommendations(
        [card("rot", { title: "Galaxy rotation curves", related: ["Dark Matter"] }), card("other", { subjects: ["Pottery"] })],
        profile({ interests: ["Knitting"], vault: [vaultCard({})] }),
        { seed },
      );
      expect(result[0]?.id).toBe("rot");
      expect(result[0]?.reason.text).toBe("Lists “Dark matter”, a card in your vault, as a related concept.");
    });

    it("ranks an explicit related-concept link above a single shared heading", () => {
      const result = rankRecommendations(
        [
          card("shared", { subjects: ["Cosmology"] }),
          card("linked", { title: "Gravitational lensing", subjects: ["Optics"] }),
        ],
        profile({
          interests: ["Knitting"],
          vault: [vaultCard({ subjects: ["Cosmology"], related: ["Gravitational lensing"] })],
        }),
        { seed },
      );
      expect(result.map((r) => r.id).slice(0, 2)).toEqual(["linked", "shared"]);
      expect(result[1]?.reason.text).toBe("Shares “Cosmology” with “Dark matter” in your vault.");
    });

    it("does not link to the vault through a heading that most cards carry", () => {
      const candidates = Array.from({ length: 20 }, (_, i) => card(`s${i}`, { subjects: ["Science", `Topic ${i}`] }));
      const result = rankRecommendations(
        candidates,
        profile({ interests: ["Knitting"], vault: [vaultCard({ subjects: ["Science"] })] }),
        { seed },
      );
      expect(result.filter((r) => r.reason.kind === "VAULT")).toEqual([]);
    });

    it("finds nearby topics through specific headings, not broad ones", () => {
      const fillers = Array.from({ length: 10 }, (_, i) => card(`f${i}`, { subjects: ["Science", `Filler ${i}`] }));
      const result = rankRecommendations(
        [
          card("match", { subjects: ["Astronomy", "Science", "Navigation"] }),
          card("nav", { subjects: ["Navigation", "Clocks"] }),
          card("broad", { subjects: ["Science", "Pottery"] }),
          ...fillers,
        ],
        profile({ interests: ["Astronomy"] }),
        { seed },
      );
      expect(result.find((r) => r.id === "nav")?.reason).toEqual({
        kind: "ADJACENT",
        text: "Close to your interest in Astronomy: both touch on Navigation.",
        topics: ["Astronomy", "Navigation"],
      });
      for (const r of result.filter((x) => x.reason.kind === "ADJACENT")) {
        expect(r.reason.topics).not.toContain("Science");
      }
      expect(result.find((r) => r.id === "broad")?.reason.kind ?? "EXPLORE").toBe("EXPLORE");
    });
  });

  it("never returns more than the limit or a card twice", () => {
    const candidates = Array.from({ length: 12 }, (_, i) => card(`d${i}`, { subjects: ["Science"] }));
    const result = rankRecommendations(candidates, profile({ interests: ["Science"], surpriseMe: true }), { seed, limit: 4 });
    expect(result).toHaveLength(4);
    expect(new Set(result.map((r) => r.id)).size).toBe(4);
  });
});
