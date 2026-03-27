/**
 * Markdown conversion utilities for TTS and Immersive Reader.
 *
 * - stripMarkdown: removes markdown syntax for speech-friendly plain text
 * - markdownToHtml: converts markdown to simple HTML for Immersive Reader
 */

/**
 * Strip markdown syntax to produce clean plain text for TTS.
 * Removes headers, bold/italic, links, images, code blocks, list markers, etc.
 */
export function stripMarkdown(text: string): string {
  let s = text;
  // Remove code blocks
  s = s.replace(/```[\s\S]*?```/g, "");
  // Remove inline code
  s = s.replace(/`([^`]+)`/g, "$1");
  // Remove images ![alt](url)
  s = s.replace(/!\[([^\]]*)\]\([^)]+\)/g, "$1");
  // Convert links [text](url) → text
  s = s.replace(/\[([^\]]+)\]\([^)]+\)/g, "$1");
  // Remove heading markers
  s = s.replace(/^#{1,6}\s+/gm, "");
  // Remove bold/italic markers
  s = s.replace(/\*{1,3}([^*]+)\*{1,3}/g, "$1");
  s = s.replace(/_{1,3}([^_]+)_{1,3}/g, "$1");
  // Remove strikethrough
  s = s.replace(/~~([^~]+)~~/g, "$1");
  // Remove blockquote markers
  s = s.replace(/^>\s?/gm, "");
  // Remove horizontal rules
  s = s.replace(/^[-*_]{3,}\s*$/gm, "");
  // Remove unordered list markers
  s = s.replace(/^\s*[-*+]\s+/gm, "");
  // Remove ordered list markers
  s = s.replace(/^\s*\d+\.\s+/gm, "");
  // Remove HTML tags
  s = s.replace(/<[^>]+>/g, "");
  // Collapse whitespace
  s = s.replace(/\n{3,}/g, "\n\n");
  s = s.replace(/ {2,}/g, " ");
  return s.trim();
}

/**
 * Convert markdown to simple HTML for Immersive Reader.
 * Produces clean semantic HTML that the IR SDK renders properly.
 */
export function markdownToHtml(text: string): string {
  let s = text;

  // Escape HTML entities in the source text first
  s = s.replace(/&/g, "&amp;");
  // Don't escape < and > yet — we'll produce HTML tags

  // Code blocks → <pre>
  s = s.replace(/```(?:\w*)\n([\s\S]*?)```/g, "<pre>$1</pre>");
  // Inline code → <code>
  s = s.replace(/`([^`]+)`/g, "<code>$1</code>");
  // Images → alt text
  s = s.replace(/!\[([^\]]*)\]\([^)]+\)/g, "<em>$1</em>");
  // Links → <a>
  s = s.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>');
  // Headings → <h1>-<h6>
  s = s.replace(/^######\s+(.+)$/gm, "<h6>$1</h6>");
  s = s.replace(/^#####\s+(.+)$/gm, "<h5>$1</h5>");
  s = s.replace(/^####\s+(.+)$/gm, "<h4>$1</h4>");
  s = s.replace(/^###\s+(.+)$/gm, "<h3>$1</h3>");
  s = s.replace(/^##\s+(.+)$/gm, "<h2>$1</h2>");
  s = s.replace(/^#\s+(.+)$/gm, "<h1>$1</h1>");
  // Bold → <strong>
  s = s.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
  s = s.replace(/__([^_]+)__/g, "<strong>$1</strong>");
  // Italic → <em>
  s = s.replace(/\*([^*]+)\*/g, "<em>$1</em>");
  s = s.replace(/_([^_]+)_/g, "<em>$1</em>");
  // Strikethrough → <del>
  s = s.replace(/~~([^~]+)~~/g, "<del>$1</del>");
  // Blockquotes → <blockquote>
  s = s.replace(/^>\s?(.+)$/gm, "<blockquote>$1</blockquote>");
  // Horizontal rules
  s = s.replace(/^[-*_]{3,}\s*$/gm, "<hr>");
  // Unordered list items → <li>
  s = s.replace(/^\s*[-*+]\s+(.+)$/gm, "<li>$1</li>");
  // Ordered list items → <li>
  s = s.replace(/^\s*\d+\.\s+(.+)$/gm, "<li>$1</li>");
  // Wrap consecutive <li> in <ul>
  s = s.replace(/((?:<li>.*<\/li>\n?)+)/g, "<ul>$1</ul>");
  // Paragraphs: wrap remaining text lines
  s = s.replace(/^(?!<[a-z])((?!\s*$).+)$/gm, "<p>$1</p>");
  // Clean up empty paragraphs
  s = s.replace(/<p>\s*<\/p>/g, "");

  return s.trim();
}
