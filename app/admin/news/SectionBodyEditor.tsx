'use client';

import React, { useEffect, useRef } from 'react';
import { Editor, EditorContent, useEditorState } from '@tiptap/react';
import type { ArticleSection } from '@/app/types/article-sections';
import { extractPlainText, renderArticleContent, type TiptapDoc } from '@/lib/rendering/article-content';
import { ArticleSectionLayout } from '@/app/components/news/ArticleSectionLayout';

export type SectionPreviewTarget = 'heading' | 'image' | 'body';

const BODY_PLACEHOLDER = "Click here to write your section's paragraph...";

interface SectionBodyEditorProps {
  section: ArticleSection;
  editor: Editor | null;
  isEditing: boolean;
  activeTarget: SectionPreviewTarget | null;
  sectionLabel: string;
  onSelectTarget: (target: SectionPreviewTarget) => void;
}

/**
 * Renders an editable section body using Tiptap
 * Only mounts editor when section is selected for editing
 * Provides click-to-edit region for activating editor
 */
export function SectionBodyEditor({
  section,
  editor,
  isEditing,
  activeTarget,
  sectionLabel,
  onSelectTarget,
}: SectionBodyEditorProps) {
  const pendingBodyFocus = useRef(false);
  // Observe the document without inserting placeholder content or changing history.
  const editorIsEmpty = useEditorState({
    editor: isEditing ? editor : null,
    selector: ({ editor: currentEditor }) => isEditing && currentEditor && currentEditor === editor
      ? !currentEditor.state.doc.textContent.trim()
      : null,
  });
  const isBodyEmpty = editorIsEmpty ?? !extractPlainText(section.body as TiptapDoc);

  useEffect(() => {
    if (pendingBodyFocus.current && activeTarget === 'body' && isEditing && editor) {
      pendingBodyFocus.current = false;
      editor.commands.focus(undefined, { scrollIntoView: false });
    }
  }, [activeTarget, isEditing, editor]);

  const selectionClass = (target: SectionPreviewTarget) =>
    `rounded-md outline-none transition-all focus-visible:ring-2 focus-visible:ring-brand-gold ${
      activeTarget === target ? 'ring-2 ring-brand-gold ring-offset-4' : 'hover:ring-2 hover:ring-brand-gold/60 hover:ring-offset-4'
    }`;

  // Render section heading if enabled
  const heading = section.headingEnabled && section.heading?.trim() ? (
    <h2 className="news-article-section-heading font-serif text-2xl md:text-3xl font-normal text-brand-blue leading-[1.2]">
      <button
        type="button"
        data-news-target="heading"
        aria-label={`Edit heading for ${sectionLabel}`}
        aria-pressed={activeTarget === 'heading'}
        onClick={(event) => { event.stopPropagation(); onSelectTarget('heading'); }}
        className={`block w-full text-left ${selectionClass('heading')}`}
      >
        {section.heading}
      </button>
    </h2>
  ) : null;

  // Render section image if present
  const sectionImage = section.image ? (
    <button
      type="button"
      data-news-target="image"
      aria-label={`Edit image for ${sectionLabel}`}
      aria-pressed={activeTarget === 'image'}
      onClick={(event) => { event.stopPropagation(); onSelectTarget('image'); }}
      className={`relative block w-full overflow-hidden ${selectionClass('image')}`}
    >
      <img
        src={section.image}
        alt="Section content"
        className="w-full h-auto object-contain"
      />
    </button>
  ) : null;

  // Editor and click-to-edit surface
  const editorSurface = (
    <div
      data-news-target="body"
      role={isEditing ? 'group' : 'button'}
      tabIndex={isEditing ? undefined : 0}
      aria-label={`Edit body for ${sectionLabel}`}
      aria-description={isBodyEmpty ? BODY_PLACEHOLDER : undefined}
      data-empty={isBodyEmpty ? 'true' : undefined}
      style={isBodyEmpty ? { '--news-body-placeholder': JSON.stringify(BODY_PLACEHOLDER) } as React.CSSProperties : undefined}
      className={`news-article-body news-section-body-editor max-w-none text-gray-700 relative ${
        isBodyEmpty ? 'cursor-text hover:ring-2 hover:ring-brand-gold/60 hover:ring-offset-4' : ''
      } ${
        activeTarget === 'body' ? 'ring-2 ring-brand-gold ring-offset-4 rounded-md bg-white' : 'rounded-md outline-none focus-visible:ring-2 focus-visible:ring-brand-gold'
      }`}
      onClick={(event) => {
        event.stopPropagation();
        if (!isEditing || !editor) pendingBodyFocus.current = true;
        onSelectTarget('body');
      }}
      onKeyDown={(event) => {
        if (event.target !== event.currentTarget || isEditing) return;
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          pendingBodyFocus.current = true;
          onSelectTarget('body');
        }
      }}
    >
      {isEditing && editor ? (
        // Actual Tiptap editor
        <EditorContent editor={editor} />
      ) : (
        // Read-only preview
        <div className="news-section-body-preview cursor-pointer hover:text-brand-gold transition-colors">
          {renderArticleContent(section.body as TiptapDoc)}
        </div>
      )}
    </div>
  );

  return (
    <ArticleSectionLayout
      layout={section.layout}
      heading={heading}
      body={editorSurface}
      image={sectionImage}
    />
  );
}
