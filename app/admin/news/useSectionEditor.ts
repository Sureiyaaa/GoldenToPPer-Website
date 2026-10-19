'use client';

import { Editor } from '@tiptap/core';
import StarterKit from '@tiptap/starter-kit';
import { useEffect, useRef, useState } from 'react';
import { parseArticleContent } from '@/lib/rendering/article-content';

interface UseSectionEditorProps {
  sectionId: string;
  content: Record<string, any> | null | undefined;
  onChange: (content: Record<string, any>, sectionId: string) => void;
  editorsRegistry: React.MutableRefObject<Map<string, Editor>>;
}

/**
 * Hook for managing Tiptap editors for article sections
 * Each editor instance is stored in an article-scoped registry (editorsRegistry)
 * Editors persist across section switches, reorders, layout changes
 * Editors are destroyed only when article changes or on unmount
 */
export function useSectionEditor({
  sectionId,
  content,
  onChange,
  editorsRegistry,
}: UseSectionEditorProps) {
  const onChangeRef = useRef(onChange);
  const isSyncingRef = useRef(false);
  const [, setActiveEditor] = useState<Editor | null>(null);
  const registeredEditor = editorsRegistry.current.get(sectionId);

  // Update callback ref without recreating editor
  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  // Get or create editor for this section
  useEffect(() => {
    if (!sectionId) return;

    const editorsMap = editorsRegistry.current;

    // Create editor if it doesn't exist
    if (!editorsMap.has(sectionId)) {
      const editor = new Editor({
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
        content: parseInitialSectionContent(content),
        editorProps: {
          attributes: {
            class: 'prose prose-sm max-w-none text-base md:text-[17px] text-gray-700 leading-[1.85] focus:outline-none w-full',
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
      });
      editorsMap.set(sectionId, editor);
    }

    // Sync content when it changes externally (but preserve undo history)
    const editor = editorsMap.get(sectionId)!;
    // Subscribe to both lazily created editors and fresh editors after Reset.
    const handleUpdate = () => {
      if (!isSyncingRef.current) onChangeRef.current(editor.getJSON(), sectionId);
    };
    editor.on('update', handleUpdate);
    setActiveEditor(editor);
    const newContent = parseInitialSectionContent(content);
    const currentContent = editor.getJSON();

    if (JSON.stringify(newContent) !== JSON.stringify(currentContent)) {
      isSyncingRef.current = true;
      editor.commands.setContent(newContent);
      isSyncingRef.current = false;
    }
    return () => { editor.off('update', handleUpdate); };
  }, [sectionId, content, editorsRegistry, registeredEditor]);

  return editorsRegistry.current.get(sectionId) || null;
}

/**
 * Clean up editor for a removed section
 * Call this when a section is deleted to free resources
 */
export function cleanupSectionEditor(
  sectionId: string,
  editorsRegistry: React.MutableRefObject<Map<string, Editor>>
) {
  const editor = editorsRegistry.current.get(sectionId);
  if (editor) {
    editor.destroy();
    editorsRegistry.current.delete(sectionId);
  }
}

/**
 * Reset all editors to saved state
 * Destroys old editors and creates fresh instances with saved content
 * Clears undo history, making discarded edits unrecoverable
 */
export function resetAllSectionEditors(
  editorsRegistry: React.MutableRefObject<Map<string, Editor>>,
  sections: Array<{ id: string; body: any }>
) {
  // Destroy old editors
  editorsRegistry.current.forEach((editor) => {
    editor.destroy();
  });
  editorsRegistry.current.clear();

  // Recreate editors with saved content (fresh history)
  sections.forEach(({ id, body }) => {
    const editor = new Editor({
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
      content: parseInitialSectionContent(body),
      editorProps: {
        attributes: {
          class: 'prose prose-sm max-w-none text-base md:text-[17px] text-gray-700 leading-[1.85] focus:outline-none w-full',
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
    });
    editorsRegistry.current.set(id, editor);
  });
}

/**
 * Clean up all editors (e.g., on article change or unmount)
 * Destroys all instances and clears registry
 */
export function cleanupAllSectionEditors(
  editorsRegistry: React.MutableRefObject<Map<string, Editor>>
) {
  editorsRegistry.current.forEach((editor) => {
    editor.destroy();
  });
  editorsRegistry.current.clear();
}

function parseInitialSectionContent(
  content: Record<string, any> | null | undefined
): any {
  // If content is already a valid Tiptap doc, use it
  if (content && typeof content === 'object' && content.type === 'doc') {
    return content;
  }

  // Empty document
  return { type: 'doc', content: [{ type: 'paragraph' }] };
}
