'use client';

import { useEditor, Editor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import { useEffect, useRef } from 'react';

interface UseArticleEditorProps {
  value: string | null | undefined;
  excerpt: string | null | undefined;
  onChange: (value: string | null) => void;
}

export function useArticleEditor({
  value,
  excerpt,
  onChange,
}: UseArticleEditorProps) {
  const editorRef = useRef<Editor | null>(null);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        history: { depth: 100 },
        bold: { HTMLAttributes: { class: 'font-bold' } },
        italic: { HTMLAttributes: { class: 'italic' } },
        codeBlock: false,
        code: false,
        blockquote: false,
        horizontalRule: false,
        heading: false,
        listItem: false,
        bulletList: false,
        orderedList: false,
      }),
    ],
    content: parseInitialContent(value, excerpt),
    onUpdate: ({ editor: ed }: any) => {
      const json = ed.getJSON();
      onChange(JSON.stringify(json));
    },
    editorProps: {
      attributes: {
        class: 'focus:outline-none w-full',
      },
      clipboardParser: (sliced: any, _event: any) => {
        const text = sliced?.textContent || '';
        if (!text.trim()) return null;
        const parser = DOMParser.prototype.parseFromString.call(
          new DOMParser(),
          `<p>${text.replace(/\n/g, '</p><p>')}</p>`,
          'text/html'
        );
        return parser.querySelector('body') || sliced;
      },
    },
  } as any);

  useEffect(() => {
    editorRef.current = editor;
  }, [editor]);

  // Sync editor content when value or excerpt props change
  useEffect(() => {
    if (!editor) return;

    const newContent = parseInitialContent(value, excerpt);
    const currentContent = editor.getJSON();

    if (JSON.stringify(newContent) !== JSON.stringify(currentContent)) {
      editor.commands.setContent(newContent);
    }
  }, [value, excerpt, editor]);

  return editor;
}

function parseInitialContent(
  value: string | null | undefined,
  excerpt: string | null | undefined
): any {
  // Priority 1: Rich JSON content (structured, don't re-split)
  if (value) {
    try {
      const parsed = JSON.parse(value);
      if (parsed?.type === 'doc' && Array.isArray(parsed.content)) {
        return parsed;
      }
    } catch {}

    // Fallback: Plain text in value field (legacy, use /\n+/ split)
    const paragraphs = value
      .split(/\n+/)
      .filter(Boolean)
      .map((text) => ({
        type: 'paragraph',
        content: text.trim()
          ? [{ type: 'text', text: text.trim() }]
          : [],
      }));

    if (paragraphs.length > 0) {
      return {
        type: 'doc',
        content: paragraphs,
      };
    }
  }

  // Priority 2: Excerpt fallback (legacy plain text, use /\n+/ split)
  if (excerpt) {
    const paragraphs = excerpt
      .split(/\n+/)
      .filter(Boolean)
      .map((text) => ({
        type: 'paragraph',
        content: text.trim()
          ? [{ type: 'text', text: text.trim() }]
          : [],
      }));

    if (paragraphs.length > 0) {
      return {
        type: 'doc',
        content: paragraphs,
      };
    }
  }

  // Priority 3: Empty document
  return { type: 'doc', content: [{ type: 'paragraph' }] };
}
