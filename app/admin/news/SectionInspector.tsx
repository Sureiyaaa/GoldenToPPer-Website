'use client';

import React from 'react';
import { Eye, EyeOff } from 'lucide-react';
import { getSectionImagePlacement, type ArticleSection, type SectionImagePlacement } from '@/app/types/article-sections';

interface SectionInspectorProps {
  section: ArticleSection | null;
  onUpdate: (updates: Partial<ArticleSection>) => void;
  inputClassName: string;
  labelClassName: string;
  mode?: 'settings' | 'heading' | 'image';
  imageControl: React.ReactNode;
  formattingControl?: React.ReactNode;
  hasImage?: boolean;
}

const PLACEMENT_OPTIONS: Array<{ value: SectionImagePlacement; label: string; description: string }> = [
  { value: 'image-above', label: 'Image Above', description: 'Full-width image above body' },
  { value: 'image-below', label: 'Image Below', description: 'Full-width image below body' },
  { value: 'image-left', label: 'Image Left', description: 'Image left (40%), body right (60%)' },
  { value: 'image-right', label: 'Image Right', description: 'Body left (60%), image right (40%)' },
];

export function SectionInspector({ section, onUpdate, inputClassName, labelClassName, imageControl, formattingControl, hasImage = Boolean(section?.image), mode = 'settings' }: SectionInspectorProps) {
  if (!section) {
    return (
      <div className="p-6 text-center text-gray-500">
        <p className="text-sm">Select a section to edit its properties</p>
      </div>
    );
  }

  const handleHeadingChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onUpdate({ heading: e.target.value });
  };

  const handleHeadingToggle = () => {
    onUpdate({ headingEnabled: !section.headingEnabled });
  };

  const placement = getSectionImagePlacement(section.layout);
  const handlePlacementChange = (layout: SectionImagePlacement) => onUpdate({ layout });


  return (
    <div className="space-y-6">
      {mode === 'settings' && formattingControl && (
        <div>
          <p className={labelClassName}>Text Formatting</p>
          {formattingControl}
          <p className="mt-2 text-[10px] leading-relaxed text-gray-400">Select text in the preview to apply formatting.</p>
        </div>
      )}
      {/* Heading Section */}
      {mode !== 'image' && (
        <div>
          <div className="flex items-center justify-between mb-3">
            <label htmlFor="section-heading" className={labelClassName}>
              Section Heading
            </label>
            <button
              type="button"
              onClick={handleHeadingToggle}
              className={`p-1 rounded transition-colors ${
                section.headingEnabled
                  ? 'bg-brand-gold text-white'
                  : 'bg-gray-200 text-gray-600'
              }`}
              title={section.headingEnabled ? 'Disable heading' : 'Enable heading'}
              aria-label={section.headingEnabled ? 'Disable heading' : 'Enable heading'}
              aria-pressed={section.headingEnabled}
            >
              {section.headingEnabled ? (
                <Eye size={16} />
              ) : (
                <EyeOff size={16} />
              )}
            </button>
          </div>
          <input
            id="section-heading"
            type="text"
            value={section.heading || ''}
            onChange={handleHeadingChange}
            placeholder="Enter section heading (optional)"
            disabled={!section.headingEnabled}
            className={`${inputClassName} disabled:bg-gray-100 disabled:text-gray-500`}
          />
          {!section.headingEnabled && <p className="mt-2 text-[10px] text-gray-400">Heading is hidden but text is preserved.</p>}
        </div>
      )}

      {mode !== 'heading' && imageControl}

      {/* Image placement is independent of whether an image is currently saved. */}
      {mode !== 'heading' && hasImage && (
        <div>
          <p className={labelClassName}>
            Image placement
          </p>
          <div role="group" aria-label="Image placement" className="grid grid-cols-2 gap-2">
            {PLACEMENT_OPTIONS.map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => handlePlacementChange(option.value)}
                aria-pressed={placement === option.value}
                className={`p-3 text-left text-xs rounded-md border-2 transition-all ${
                  placement === option.value
                    ? 'border-brand-gold bg-brand-gold/10'
                    : 'border-gray-200 bg-white hover:border-gray-300'
                }`}
              >
                <div className="font-semibold text-gray-900">{option.label}</div>
                <div className="text-gray-600">{option.description}</div>
              </button>
            ))}
          </div>
          {section.layout === 'text-only' && (
            <p className="mt-3 text-[10px] leading-relaxed text-gray-400">
              This section&apos;s image is hidden. Choose a placement to show it.
            </p>
          )}
        </div>
      )}

    </div>
  );
}
