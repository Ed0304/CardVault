/**
 * Starter topics for the welcome onboarding and Settings (REQ-DISC-004).
 *
 * This is a starting point, not the taxonomy: interests are stored as free-text labels, the
 * onboarding also offers the subject headings most used in the Community Catalog, and users can
 * type their own. A starter topic only adds related search terms, so "Games and Pokémon" also
 * matches cards whose subject headings say "Video games" or "Pokemon". Any other interest is
 * matched by its own words.
 */
export interface StarterTopic {
  label: string;
  description: string;
  /** Words and phrases that count as this topic in card metadata. Matched as whole words. */
  terms: string[];
}

export const STARTER_TOPICS: readonly StarterTopic[] = [
  {
    label: "Technology",
    description: "Computing, software, the internet and engineering",
    terms: ["technology", "computing", "computer", "software", "programming", "internet", "engineering", "artificial intelligence"],
  },
  {
    label: "Cybersecurity",
    description: "Security, privacy, cryptography and how systems are attacked and defended",
    terms: ["cybersecurity", "computer security", "information security", "security", "hacking", "malware", "cryptography", "privacy"],
  },
  {
    label: "Science",
    description: "Physics, biology, astronomy and the natural sciences",
    terms: ["science", "physics", "chemistry", "biology", "astronomy", "mathematics", "paleontology", "geology", "ecology"],
  },
  {
    label: "History",
    description: "Past events, people, places and archaeology",
    terms: ["history", "historical", "archaeology", "ancient", "medieval", "war"],
  },
  {
    label: "Games and Pokémon",
    description: "Video games, tabletop games, game design and Pokémon",
    terms: ["game", "video game", "gaming", "pokemon", "nintendo", "board game", "game design"],
  },
  {
    label: "Art and Culture",
    description: "Visual art, design, film, architecture and culture",
    terms: ["art", "culture", "painting", "design", "architecture", "film", "photography", "pop culture"],
  },
  {
    label: "Internet Memes",
    description: "Memes, viral moments and internet culture",
    terms: ["meme", "internet culture", "viral", "social media", "internet slang"],
  },
  {
    label: "Horror and Folklore",
    description: "Myths, legends, folklore and horror fiction",
    terms: ["horror", "folklore", "mythology", "myth", "legend", "urban legend", "ghost", "cryptid", "supernatural"],
  },
  {
    label: "Music",
    description: "Musicians, albums, genres and music history",
    terms: ["music", "musician", "album", "song", "band", "singer", "hip hop"],
  },
  {
    label: "Literature",
    description: "Books, authors, poetry and fiction",
    terms: ["literature", "novel", "poetry", "poem", "book", "fiction", "writer"],
  },
  {
    label: "Education",
    description: "Learning, teaching and study skills",
    terms: ["education", "learning", "teaching", "school", "study", "university"],
  },
  {
    label: "Nature and Animals",
    description: "Wildlife, plants, ecosystems and the environment",
    terms: ["nature", "animal", "wildlife", "plant", "environment", "biodiversity"],
  },
  {
    label: "Anime and Manga",
    description: "Japanese animation, comics and pop culture",
    terms: ["anime", "manga", "japanese pop culture", "japan"],
  },
  {
    label: "Philosophy",
    description: "Ideas, ethics, logic and schools of thought",
    terms: ["philosophy", "ethics", "logic", "philosopher"],
  },
  {
    label: "Health and Medicine",
    description: "The body, medicine, nutrition and wellbeing",
    terms: ["health", "medicine", "medical", "anatomy", "nutrition", "disease"],
  },
  {
    label: "Business and Economics",
    description: "Companies, markets, money and work",
    terms: ["business", "economics", "finance", "marketing", "company", "economy"],
  },
] as const;

/** Lowercase, without accents, punctuation as spaces: "Pokémon!" -> "pokemon". */
export function normalizeTopic(text: string): string {
  return text
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
}

const STARTER_BY_LABEL = new Map(STARTER_TOPICS.map((topic) => [normalizeTopic(topic.label), topic]));

/** The normalized terms an interest matches: a starter topic's terms, or the interest's own words. */
export function termsForInterest(label: string): string[] {
  const key = normalizeTopic(label);
  const starter = STARTER_BY_LABEL.get(key);
  const terms = starter ? [key, ...starter.terms.map(normalizeTopic)] : [key];
  return [...new Set(terms.filter(Boolean))];
}

/**
 * Connecting words that carry no topic of their own. They are ignored when a multi-word term is
 * matched regardless of word order, so "Internet history" and "History of the Internet" agree.
 */
const CONNECTING_WORDS = new Set([
  "a", "an", "and", "as", "at", "by", "for", "from", "in", "into", "of", "on", "or", "the", "to", "vs", "with",
]);

/**
 * The words of a normalized multi-word term that must all be present for a match in any order,
 * without connecting words and repeats: "history of the internet" -> ["history", "internet"].
 * Returns [] for single-word terms, which only match as whole words.
 */
export function significantWords(term: string): string[] {
  const words = term.split(" ").filter(Boolean);
  if (words.length < 2) return [];
  return [...new Set(words.filter((word) => !CONNECTING_WORDS.has(word)))];
}

export function isStarterTopic(label: string): boolean {
  return STARTER_BY_LABEL.has(normalizeTopic(label));
}
