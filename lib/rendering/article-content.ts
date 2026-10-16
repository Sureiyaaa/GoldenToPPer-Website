/**
 * Shared renderer for article content (rich and plain text)
 * Used by both admin preview and public article pages
 */

import React from 'react';

export type TiptapDoc = {
  type: 'doc';
  content: TiptapNode[];
};

export type TiptapNode =
  | { type: 'paragraph'; content?: TiptapContent[] }
  | { type: 'text'; text: string; marks?: TiptapMark[] }
  | { type: 'hardBreak' };

export type TiptapContent = TiptapNode;

export type TiptapMark =
  | { type: 'bold' }
  | { type: 'italic' };

/**
 * Parse article content from storage (rich JSON or plain text)
 * Returns normalized TiptapDoc
 */
export function parseArticleContent(
  content: string | TiptapDoc | null | undefined
): TiptapDoc {
  if (!content) {
    return { type: 'doc', content: [{ type: 'paragraph', content: [] }] };
  }

  // Already parsed object
  if (typeof content === 'object' && content.type === 'doc') {
    return normalizeDoc(content);
  }

  // JSON string
  if (typeof content === 'string') {
    try {
      const parsed = JSON.parse(content);
      if (parsed?.type === 'doc') {
        return normalizeDoc(parsed);
      }
    } catch {
      // Fall through to plain text parsing
    }

    // Plain text fallback (legacy behavior: split on any newline)
    const paragraphs = content
      .split(/\n+/)
      .filter(Boolean)
      .map((text) => ({
        type: 'paragraph' as const,
        content: text.trim()
          ? [{ type: 'text' as const, text: text.trim() }]
          : [],
      }));

    return {
      type: 'doc',
      content: paragraphs.length > 0 ? paragraphs : [{ type: 'paragraph' }],
    };
  }

  return { type: 'doc', content: [{ type: 'paragraph' }] };
}

/**
 * Normalize and validate Tiptap document
 * Ensures structure matches expected schema
 */
function normalizeDoc(doc: any): TiptapDoc {
  if (!doc || typeof doc !== 'object' || doc.type !== 'doc') {
    return { type: 'doc', content: [{ type: 'paragraph' }] };
  }

  const content = Array.isArray(doc.content)
    ? doc.content.filter((node: any) => node?.type === 'paragraph')
    : [];

  return {
    type: 'doc',
    content: content.length > 0 ? content : [{ type: 'paragraph' }],
  };
}

/**
 * Render Tiptap document as React elements
 * Used by both admin preview and public article pages
 */
export function renderArticleContent(
  content: string | TiptapDoc | null | undefined
): React.ReactNode {
  const doc = parseArticleContent(content);

  return doc.content.map((node, blockIdx) => {
    if (node.type === 'paragraph') {
      return React.createElement(
        'p',
        {
          key: blockIdx,
          className: 'mb-6',
        },
        node.content && node.content.length > 0
          ? renderContentNodes(node.content)
          : ' ' // Non-breaking space for empty paragraph
      );
    }
    return null;
  });
}

/**
 * Render content nodes (text with optional marks)
 */
function renderContentNodes(nodes: TiptapContent[]): React.ReactNode {
  return nodes.map((node, idx) => {
    if (node.type === 'text') {
      const marks = node.marks || [];
      const isBold = marks.some(m => m.type === 'bold');
      const isItalic = marks.some(m => m.type === 'italic');

      const className = `${isBold ? 'font-bold' : ''} ${isItalic ? 'italic' : ''}`.trim();

      if (!className) {
        return node.text;
      }

      // Determine element type based on marks
      let elementType: 'strong' | 'em' | 'span' = 'span';
      if (isBold && !isItalic) {
        elementType = 'strong';
      } else if (isItalic && !isBold) {
        elementType = 'em';
      }

      return React.createElement(
        elementType,
        { key: idx, className },
        node.text
      );
    }

    if (node.type === 'hardBreak') {
      return React.createElement('br', { key: idx });
    }

    return null;
  });
}

/**
 * Extract plain text from article content (for metadata, cards, etc.)
 */
export function extractPlainText(
  content: string | TiptapDoc | null | undefined
): string {
  const doc = parseArticleContent(content);

  return doc.content
    .map((node) => {
      if (node.type === 'paragraph' && node.content) {
        return node.content
          .map((child) => {
            if (child.type === 'text') return child.text;
            if (child.type === 'hardBreak') return '\n';
            return '';
          })
          .join('');
      }
      return '';
    })
    .join('\n\n')
    .trim();
}

/**
 * Validate article content structure
 * Returns error message if invalid, null if valid
 */
export function validateArticleContent(content: any): string | null {
  if (!content) return null; // Empty/null is allowed

  let doc: TiptapDoc;
  try {
    doc = parseArticleContent(content);
  } catch (err) {
    return 'Invalid article content format';
  }

  // Check that document has content
  if (!doc.content || doc.content.length === 0) {
    return 'Article content must not be empty';
  }

  // Check that at least one paragraph has text
  const hasText = doc.content.some((node) => {
    if (node.type !== 'paragraph') return false;
    return (
      node.content &&
      node.content.some((child) => child.type === 'text' && child.text?.trim())
    );
  });

  if (!hasText) {
    return 'Article must contain at least 10 characters of text';
  }

  return null;
}
