/**
 * Article content validation helpers
 * Separate from article-content renderer to avoid circular dependencies
 */

export function validateArticleContent(content: any): boolean {
  if (!content) return true; // null/undefined allowed

  let doc: any;
  try {
    if (typeof content === 'string') {
      doc = JSON.parse(content);
    } else {
      doc = content;
    }
  } catch {
    return false; // Invalid JSON
  }

  // Must be a Tiptap document
  if (!doc || typeof doc !== 'object' || doc.type !== 'doc') {
    return false;
  }

  if (!Array.isArray(doc.content) || doc.content.length === 0) {
    return false;
  }

  // At least one paragraph must have text content
  const hasText = doc.content.some((node: any) => {
    if (node.type !== 'paragraph' || !Array.isArray(node.content)) {
      return false;
    }
    return node.content.some(
      (child: any) =>
        child.type === 'text' && typeof child.text === 'string' && child.text.trim().length > 0
    );
  });

  return hasText;
}

/**
 * Extract plain text from Tiptap document JSON
 * Used to derive excerpt from article_content
 */
export function extractPlainTextFromContent(content: string | null | undefined): string {
  if (!content) return '';

  try {
    let doc: any;
    if (typeof content === 'string') {
      doc = JSON.parse(content);
    } else {
      doc = content;
    }

    if (!doc || doc.type !== 'doc' || !Array.isArray(doc.content)) {
      return '';
    }

    return doc.content
      .map((node: any) => {
        if (node.type !== 'paragraph' || !Array.isArray(node.content)) {
          return '';
        }
        return node.content
          .map((child: any) => {
            if (child.type === 'text') return child.text || '';
            if (child.type === 'hardBreak') return '\n';
            return '';
          })
          .join('');
      })
      .join('\n\n')
      .trim();
  } catch {
    return '';
  }
}
