/**
 * Content detection utilities for the ScraperKast audit engine.
 *
 * Pure functions — no side effects, safe to import in route handlers.
 */

// ─── Types ─────────────────────────────────────────────────────────────────────

export interface ContentMetadata {
  characterCount:   number;
  wordCount:        number;
  imageCount:       number;
  /** Plain text, max 10 000 characters. */
  plaintext:        string;
  hasTitle:         boolean;
  hasMainContent:   boolean;
  hasLastParagraph: boolean;
}

// ─── Internal helpers ──────────────────────────────────────────────────────────

/** Strip all HTML tags from a string. */
function stripTags(s: string): string {
  return s.replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
}

/** Decode the most common HTML entities. */
function decodeEntities(s: string): string {
  return s
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#039;|&apos;/gi, "'")
    .replace(/&nbsp;/gi, ' ');
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Heuristically determine whether the HTML represents a full article
 * rather than a truncated / paywalled snippet.
 */
export function detectFullArticle(html: string): boolean {
  if (html.length < 2_000) return false;

  const hasTitle       = /<h1[\s>]|<title[\s>]/i.test(html);
  const paragraphCount = (html.match(/<p[\s>]/gi) ?? []).length;
  if (!hasTitle || paragraphCount < 3) return false;

  // Look for conclusion / footer signals in the final 1 000 characters.
  const tail = html.slice(-1_000);
  const conclusionMarkers = [
    /conclusion/i, /summary/i, /in\s+closing/i,
    /subscribe/i,  /read\s+more/i, /<footer[\s>]/i,
  ];
  return conclusionMarkers.some(m => m.test(tail));
}

/**
 * Extract metadata from raw HTML: word count, image count, plaintext, etc.
 */
export function extractContentMetadata(html: string): ContentMetadata {
  // Strip scripts and styles before processing.
  const cleaned = html
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, ' ')
    .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, ' ');

  const rawText    = decodeEntities(
    cleaned.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim(),
  );
  const wordCount  = rawText.length > 0 ? rawText.split(/\s+/).length : 0;
  const imageCount = (html.match(/<img[\s>]/gi) ?? []).length;

  return {
    characterCount:   html.length,
    wordCount,
    imageCount,
    plaintext:        rawText.slice(0, 10_000),
    hasTitle:         /<h1[\s>]|<title[\s>]/i.test(html),
    hasMainContent:   rawText.length > 500,
    hasLastParagraph: /<\/p>\s*<\/[^>]+>\s*$/i.test(html.slice(-500)),
  };
}

/**
 * Convert HTML to Markdown.
 *
 * Best-effort conversion — handles the most common structural elements.
 * Not a full-fidelity HTML→Markdown parser.
 */
export function htmlToMarkdown(html: string): string {
  const md = html
    // Remove scripts and styles
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '')
    // Headers
    .replace(/<h1[^>]*>([\s\S]*?)<\/h1>/gi, (_, t) => `# ${stripTags(t)}\n\n`)
    .replace(/<h2[^>]*>([\s\S]*?)<\/h2>/gi, (_, t) => `## ${stripTags(t)}\n\n`)
    .replace(/<h3[^>]*>([\s\S]*?)<\/h3>/gi, (_, t) => `### ${stripTags(t)}\n\n`)
    .replace(/<h4[^>]*>([\s\S]*?)<\/h4>/gi, (_, t) => `#### ${stripTags(t)}\n\n`)
    .replace(/<h5[^>]*>([\s\S]*?)<\/h5>/gi, (_, t) => `##### ${stripTags(t)}\n\n`)
    .replace(/<h6[^>]*>([\s\S]*?)<\/h6>/gi, (_, t) => `###### ${stripTags(t)}\n\n`)
    // Anchors — must come before generic tag stripping
    .replace(/<a[^>]*href="([^"]*)"[^>]*>([\s\S]*?)<\/a>/gi,
      (_, href, text) => `[${stripTags(text)}](${href})`)
    // Inline formatting
    .replace(/<(?:strong|b)[^>]*>([\s\S]*?)<\/(?:strong|b)>/gi,
      (_, t) => `**${stripTags(t)}**`)
    .replace(/<(?:em|i)[^>]*>([\s\S]*?)<\/(?:em|i)>/gi,
      (_, t) => `*${stripTags(t)}*`)
    .replace(/<code[^>]*>([\s\S]*?)<\/code>/gi,
      (_, t) => '`' + stripTags(t) + '`')
    // Block elements → paragraph breaks
    .replace(/<\/p>/gi, '\n\n')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(?:div|section|article|header|footer|aside|nav|main)>/gi, '\n')
    // List items
    .replace(/<li[^>]*>([\s\S]*?)<\/li>/gi, (_, t) => `- ${stripTags(t).trim()}\n`)
    // Horizontal rules
    .replace(/<hr[^>]*\/?>/gi, '\n---\n\n')
    // Strip remaining tags
    .replace(/<[^>]+>/g, '')
    // HTML entities
    .replace(/&amp;/gi, '&').replace(/&lt;/gi, '<').replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"').replace(/&nbsp;/gi, ' ')
    // Collapse excess blank lines
    .replace(/\n{3,}/g, '\n\n')
    .trim();

  return md;
}
