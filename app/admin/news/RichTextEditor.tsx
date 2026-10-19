'use client';

import { Editor, useEditorState } from '@tiptap/react';
import { Bold, Italic } from 'lucide-react';

interface FormattingToolbarProps {
  editor: Editor | null;
  sectionEditor?: Editor | null;
  isEditingSection?: boolean;
}

export default function RichTextEditor({
  editor,
  sectionEditor,
  isEditingSection = false,
}: FormattingToolbarProps) {
  // Use section editor if editing a section, otherwise use article editor
  const activeEditor = isEditingSection && sectionEditor ? sectionEditor : editor;
  const formatting = useEditorState({
    editor: activeEditor,
    selector: ({ editor: currentEditor }) => ({
      isBold: currentEditor?.isActive('bold') ?? false,
      isItalic: currentEditor?.isActive('italic') ?? false,
      canBold: currentEditor?.can().chain().focus().toggleBold().run() ?? false,
      canItalic: currentEditor?.can().chain().focus().toggleItalic().run() ?? false,
    }),
  });
  const compactToolbarClass = 'inline-flex items-center gap-2 align-top';
  const buttonClass = isEditingSection
    ? 'inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border transition-colors outline-none focus-visible:ring-2 focus-visible:ring-brand-gold focus-visible:ring-offset-2'
    : 'p-2 rounded border transition-colors';

  if (!activeEditor) {
    return (
      <div className={isEditingSection ? compactToolbarClass : 'flex gap-2 p-3 bg-gray-50 rounded-lg border border-gray-200'}>
        <div className={`${isEditingSection ? 'h-9 w-9' : 'h-10 w-10'} bg-gray-300 rounded animate-pulse`} />
        <div className={`${isEditingSection ? 'h-9 w-9' : 'h-10 w-10'} bg-gray-300 rounded animate-pulse`} />
      </div>
    );
  }

  const handleBold = () => {
    activeEditor.chain().focus().toggleBold().run();
  };

  const handleItalic = () => {
    activeEditor.chain().focus().toggleItalic().run();
  };

  const { canBold, canItalic, isBold, isItalic } = formatting!;

  return (
    <div
      role={isEditingSection ? 'group' : undefined}
      aria-label={isEditingSection ? 'Text formatting' : undefined}
      className={isEditingSection ? compactToolbarClass : 'flex gap-2 p-3 bg-white border border-gray-200 rounded-lg'}
    >
      <button
        type="button"
        onClick={handleBold}
        disabled={!canBold}
        aria-label="Bold"
        aria-pressed={isBold}
        className={`${buttonClass} ${
          isBold
            ? 'bg-brand-blue text-white border-brand-blue'
            : 'bg-white border-gray-200 text-gray-600 hover:text-gray-900 hover:border-brand-gold'
        } disabled:opacity-50 disabled:cursor-not-allowed`}
        title="Bold (Ctrl+B)"
      >
        <Bold size={18} />
      </button>

      <button
        type="button"
        onClick={handleItalic}
        disabled={!canItalic}
        aria-label="Italic"
        aria-pressed={isItalic}
        className={`${buttonClass} ${
          isItalic
            ? 'bg-brand-blue text-white border-brand-blue'
            : 'bg-white border-gray-200 text-gray-600 hover:text-gray-900 hover:border-brand-gold'
        } disabled:opacity-50 disabled:cursor-not-allowed`}
        title="Italic (Ctrl+I)"
      >
        <Italic size={18} />
      </button>
    </div>
  );
}
