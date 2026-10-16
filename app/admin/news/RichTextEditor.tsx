'use client';

import { Editor } from '@tiptap/react';
import { Bold, Italic } from 'lucide-react';

interface FormattingToolbarProps {
  editor: Editor | null;
}

export default function RichTextEditor({ editor }: FormattingToolbarProps) {
  if (!editor) {
    return (
      <div className="flex gap-2 p-3 bg-gray-50 rounded-lg border border-gray-200">
        <div className="h-10 w-10 bg-gray-300 rounded animate-pulse" />
        <div className="h-10 w-10 bg-gray-300 rounded animate-pulse" />
      </div>
    );
  }

  const handleBold = () => {
    editor.chain().focus().toggleBold().run();
  };

  const handleItalic = () => {
    editor.chain().focus().toggleItalic().run();
  };

  const canBold = editor.can().chain().focus().toggleBold().run();
  const canItalic = editor.can().chain().focus().toggleItalic().run();
  const isBold = editor.isActive('bold');
  const isItalic = editor.isActive('italic');

  return (
    <div className="flex gap-2 p-3 bg-white border border-gray-200 rounded-lg">
      <button
        type="button"
        onClick={handleBold}
        disabled={!canBold}
        aria-label="Bold"
        aria-pressed={isBold}
        className={`p-2 rounded border transition-colors ${
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
        className={`p-2 rounded border transition-colors ${
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
