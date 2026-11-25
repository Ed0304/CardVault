import { Readability } from "@mozilla/readability";
import { JSDOM, VirtualConsole } from "jsdom";

/**
 * Turns a fetched HTML page into plain text and source metadata (REQ-URL-006).
 *
 * The page is untrusted. jsdom parses it with scripts disabled and no subresource loading (its
 * defaults, which this module does not change), so nothing on the page runs or is fetched.
 * Readability finds the main article. The result is plain text only: no HTML is kept, control
 * characters are removed, and every metadata field is length-limited.
 */

export interface ExtractedPage {
  text: string;
  title: string | null;
  author: string | null;
  publishedAt: string | null;
  siteName: string | null;
  canonicalUrl: string | null;
}

/** Readability's text is used when it has at least this much; otherwise the whole page body. */
const MIN_ARTICLE_CHARS = 200;

const BLOCK_TAGS = new Set([
  "ADDRESS", "ARTICLE", "ASIDE", "BLOCKQUOTE", "DD", "DETAILS", "DIV", "DL", "DT", "FIGCAPTION",
  "FIGURE", "FOOTER", "H1", "H2", "H3", "H4", "H5", "H6", "HEADER", "HR", "LI", "MAIN", "OL", "P",
  "PRE", "SECTION", "SUMMARY", "TABLE", "TR", "UL",
]);
const SKIPPED_TAGS = new Set([
  "BUTTON", "CANVAS", "EMBED", "IFRAME", "INPUT", "NOSCRIPT", "OBJECT", "SCRIPT", "SELECT", "STYLE",
  "SVG", "TEMPLATE", "TEXTAREA",
]);
/** Page furniture removed when falling back to the whole body. */
const FALLBACK_REMOVED = "script, style, noscript, template, svg, nav, header, footer, aside, form, iframe";

// Control characters other than tab and newline; PostgreSQL also rejects U+0000 in text.
const CONTROL_CHARS = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g;

export function cleanText(value: string): string {
  return value.replace(CONTROL_CHARS, "");
}

/** Collapses whitespace in a metadata value and limits its length; empty becomes null. */
function cleanField(value: string | null | undefined, max: number): string | null {
  if (!value) return null;
  const cleaned = cleanText(value).replace(/\s+/g, " ").trim();
  if (!cleaned) return null;
  return cleaned.length > max ? `${cleaned.slice(0, max - 1).trimEnd()}…` : cleaned;
}

function walk(node: Node, out: string[]): void {
  for (const child of Array.from(node.childNodes)) {
    if (child.nodeType === 3) {
      out.push((child.textContent ?? "").replace(/\s+/g, " "));
      continue;
    }
    if (child.nodeType !== 1) continue;
    const tag = (child as Element).tagName.toUpperCase();
    if (SKIPPED_TAGS.has(tag)) continue;
    if (tag === "BR") {
      out.push("\n");
      continue;
    }
    const block = BLOCK_TAGS.has(tag);
    if (block) out.push("\n\n");
    if (tag === "LI") out.push("- ");
    walk(child, out);
    if (block) out.push("\n\n");
  }
}

/** Plain text with paragraph breaks kept. */
function toPlainText(root: Node): string {
  const out: string[] = [];
  walk(root, out);
  return cleanText(out.join(""))
    .replace(/[ \t]*\n[ \t]*/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/[ \t]{2,}/g, " ")
    .trim();
}

function metaContent(document: Document, selector: string): string | null {
  return document.querySelector(selector)?.getAttribute("content") ?? null;
}

function httpUrlOrNull(value: string | null | undefined, base: string): string | null {
  if (!value) return null;
  try {
    const url = new URL(value, base);
    return (url.protocol === "http:" || url.protocol === "https:") && url.href.length <= 2048 ? url.href : null;
  } catch {
    return null;
  }
}

function isoDateOrNull(value: string | null | undefined): string | null {
  if (!value) return null;
  const time = Date.parse(value);
  return Number.isNaN(time) ? null : new Date(time).toISOString();
}

export function extractPage(html: string, pageUrl: string): ExtractedPage {
  // A silent virtual console: page CSS and markup errors are not logged.
  const dom = new JSDOM(html, { url: pageUrl, virtualConsole: new VirtualConsole() });
  try {
    const { document } = dom.window;

    // Readability changes the document it reads, so it gets a copy; metadata comes from the original.
    const article = new Readability(document.cloneNode(true) as Document).parse();

    let text = "";
    if (article?.content) {
      const container = document.createElement("div");
      container.innerHTML = article.content;
      text = toPlainText(container);
    }
    if (text.length < MIN_ARTICLE_CHARS && document.body) {
      const body = document.body.cloneNode(true) as HTMLElement;
      for (const el of Array.from(body.querySelectorAll(FALLBACK_REMOVED))) el.remove();
      const fallback = toPlainText(body);
      if (fallback.length > text.length) text = fallback;
    }

    return {
      text,
      title: cleanField(article?.title || metaContent(document, 'meta[property="og:title"]') || document.title, 300),
      author: cleanField(article?.byline || metaContent(document, 'meta[name="author"]'), 200),
      publishedAt: isoDateOrNull(
        article?.publishedTime || metaContent(document, 'meta[property="article:published_time"]'),
      ),
      siteName: cleanField(article?.siteName || metaContent(document, 'meta[property="og:site_name"]'), 200),
      canonicalUrl: httpUrlOrNull(document.querySelector('link[rel="canonical"]')?.getAttribute("href"), pageUrl),
    };
  } finally {
    dom.window.close();
  }
}
