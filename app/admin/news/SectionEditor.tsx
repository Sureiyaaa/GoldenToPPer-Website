'use client';

import { useRef, useState } from 'react';
import { GripVertical, Image as ImageIcon, Trash2 } from 'lucide-react';
import type { ArticleSection } from '@/app/types/article-sections';

interface SectionEditorProps {
  section: ArticleSection;
  sectionIds: string[];
  index: number;
  isSelected: boolean;
  disabled: boolean;
  onSelect: () => void;
  onReorder: (sourceId: string, targetId: string) => void;
  onRemove: () => void;
}

// The admin's native drag/drop pattern, restricted to the handle, with
// pointer capture for touch/pen and a keyboard pickup/drop interaction.
export function SectionEditor({
  section, sectionIds, index, isSelected, disabled, onSelect, onReorder, onRemove,
}: SectionEditorProps) {
  const [dragging, setDragging] = useState(false);
  const [dropTarget, setDropTarget] = useState(false);
  const [keyboardTarget, setKeyboardTarget] = useState<string | null>(null);
  const [announcement, setAnnouncement] = useState('');
  const touchTarget = useRef<string | null>(null);
  const label = section.heading?.trim() || `Section ${index + 1}`;

  const finish = (targetId: string | null) => {
    if (targetId && targetId !== section.id) onReorder(section.id, targetId);
    setDragging(false);
    setKeyboardTarget(null);
    touchTarget.current = null;
    setAnnouncement(targetId
      ? `${label} dropped at position ${sectionIds.indexOf(targetId) + 1} of ${sectionIds.length}.`
      : `${label} reordering cancelled.`);
  };

  return (
    <li
      data-section-id={section.id}
      onDragOver={(event) => {
        if (disabled || !event.dataTransfer.types.includes('application/x-news-section')) return;
        event.preventDefault();
        event.dataTransfer.dropEffect = 'move';
        setDropTarget(true);
      }}
      onDragLeave={(event) => {
        if (!(event.relatedTarget instanceof Node) || !event.currentTarget.contains(event.relatedTarget)) setDropTarget(false);
      }}
      onDrop={(event) => {
        event.preventDefault();
        setDropTarget(false);
        const sourceId = event.dataTransfer.getData('application/x-news-section');
        if (!disabled && sectionIds.includes(sourceId)) onReorder(sourceId, section.id);
      }}
      className={`relative rounded-xl border p-3 transition-colors ${
        dragging || dropTarget
          ? 'border-brand-gold bg-brand-gold/10'
          : isSelected
            ? 'border-brand-gold bg-brand-gold/5 ring-1 ring-brand-gold/20'
            : 'border-gray-200 bg-gray-50 hover:border-brand-gold/50'
      }`}
    >
      <button
        type="button"
        onClick={onSelect}
        disabled={disabled}
        aria-label={`Select ${label}`}
        aria-pressed={isSelected}
        className="absolute inset-0 rounded-xl outline-none focus-visible:ring-2 focus-visible:ring-brand-gold focus-visible:ring-offset-2"
      />
      <div className="pointer-events-none relative mb-3 flex items-center gap-2">
        <button
          type="button"
          disabled={disabled}
          draggable={!disabled}
          aria-label={`Reorder ${label}`}
          aria-describedby="news-section-drag-instructions"
          aria-pressed={dragging}
          onBlur={() => { if (keyboardTarget) finish(null); }}
          onClick={(event) => event.stopPropagation()}
          onDragStart={(event) => {
            event.stopPropagation();
            event.dataTransfer.setData('application/x-news-section', section.id);
            event.dataTransfer.effectAllowed = 'move';
            event.dataTransfer.setDragImage(event.currentTarget.closest('li')!, 20, 20);
            setDragging(true);
          }}
          onDragEnd={() => { setDragging(false); setDropTarget(false); }}
          onPointerDown={(event) => {
            event.stopPropagation();
            if (event.pointerType === 'mouse' || disabled) return;
            event.currentTarget.setPointerCapture(event.pointerId);
            touchTarget.current = section.id;
            setDragging(true);
          }}
          onPointerMove={(event) => {
            if (!touchTarget.current) return;
            const card = document.elementFromPoint(event.clientX, event.clientY)?.closest<HTMLElement>('[data-section-id]');
            if (card?.dataset.sectionId && sectionIds.includes(card.dataset.sectionId)) {
              touchTarget.current = card.dataset.sectionId;
              setAnnouncement(`${label}, position ${sectionIds.indexOf(card.dataset.sectionId) + 1} of ${sectionIds.length}.`);
            } else touchTarget.current = section.id;
            const scroller = event.currentTarget.closest('aside');
            if (scroller) {
              const bounds = scroller.getBoundingClientRect();
              if (event.clientY < bounds.top + 60) scroller.scrollBy(0, -24);
              if (event.clientY > bounds.bottom - 60) scroller.scrollBy(0, 24);
            }
          }}
          onPointerUp={(event) => {
            if (!touchTarget.current) return;
            finish(disabled ? null : touchTarget.current);
            event.currentTarget.releasePointerCapture(event.pointerId);
          }}
          onPointerCancel={() => finish(null)}
          onKeyDown={(event) => {
            if (event.key === ' ' || event.key === 'Enter') {
              event.preventDefault();
              if (keyboardTarget) finish(keyboardTarget);
              else {
                setDragging(true);
                setKeyboardTarget(section.id);
                setAnnouncement(`${label} picked up, position ${index + 1} of ${sectionIds.length}.`);
              }
            } else if (keyboardTarget && ['ArrowUp', 'ArrowDown', 'Home', 'End'].includes(event.key)) {
              event.preventDefault();
              const current = sectionIds.indexOf(keyboardTarget);
              const next = event.key === 'Home' ? 0 : event.key === 'End' ? sectionIds.length - 1
                : Math.max(0, Math.min(sectionIds.length - 1, current + (event.key === 'ArrowUp' ? -1 : 1)));
              setKeyboardTarget(sectionIds[next]);
              setAnnouncement(`${label}, position ${next + 1} of ${sectionIds.length}.`);
            } else if (keyboardTarget && event.key === 'Escape') {
              event.preventDefault();
              finish(null);
            } else if (keyboardTarget && event.key === 'Tab') finish(null);
          }}
          className="pointer-events-auto flex h-8 w-8 shrink-0 touch-none items-center justify-center rounded-lg text-gray-400 outline-none transition-colors hover:bg-white hover:text-brand-gold focus-visible:ring-2 focus-visible:ring-brand-gold disabled:opacity-40 cursor-grab active:cursor-grabbing"
        >
          <GripVertical size={16} />
        </button>
        <h3 className="min-w-0 flex-1 truncate text-sm font-semibold text-brand-blue">{label}</h3>
        <button
          type="button"
          onClick={(event) => { event.stopPropagation(); onRemove(); }}
          disabled={disabled}
          aria-label={`Delete ${label}`}
          className="pointer-events-auto rounded-lg p-2 text-gray-400 outline-none transition-colors hover:bg-red-50 hover:text-red-500 focus-visible:ring-2 focus-visible:ring-brand-gold disabled:opacity-40"
        >
          <Trash2 size={16} />
        </button>
      </div>
      <div className="pointer-events-none relative flex h-32 items-center justify-center overflow-hidden rounded-lg bg-gray-100 text-gray-300">
        <ImageIcon size={24} aria-hidden="true" />
        {section.image && (
          <img
            key={section.image}
            src={section.image}
            alt=""
            draggable={false}
            className="absolute inset-0 h-full w-full object-cover"
            onError={(event) => { event.currentTarget.style.display = 'none'; }}
          />
        )}
      </div>
      <span role="status" className="sr-only">{announcement}</span>
    </li>
  );
}
