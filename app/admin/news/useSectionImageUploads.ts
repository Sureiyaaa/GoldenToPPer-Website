'use client';

import { useEffect, useRef, useState } from 'react';

export type SectionImageDraft = { file: File; previewUrl: string; uploadedUrl?: string };

// Files and blob URLs live outside article_sections and are always keyed by ID.
export function useSectionImageUploads() {
  const draftsRef = useRef<Record<string, SectionImageDraft>>({});
  const [drafts, setDrafts] = useState(draftsRef.current);

  const clearImage = (id: string, expected?: SectionImageDraft) => {
    const previous = draftsRef.current[id];
    if (!previous || (expected && previous !== expected)) return;
    URL.revokeObjectURL(previous.previewUrl);
    const next = { ...draftsRef.current };
    delete next[id];
    draftsRef.current = next;
    setDrafts(next);
  };

  const stageImage = (id: string, file: File) => {
    const previous = draftsRef.current[id];
    if (previous) URL.revokeObjectURL(previous.previewUrl);
    const next = { ...draftsRef.current, [id]: { file, previewUrl: URL.createObjectURL(file) } };
    draftsRef.current = next;
    setDrafts(next);
  };

  const clearAllImages = () => {
    Object.values(draftsRef.current).forEach((draft) => URL.revokeObjectURL(draft.previewUrl));
    draftsRef.current = {};
    setDrafts({});
  };

  useEffect(() => () => {
    Object.values(draftsRef.current).forEach((draft) => URL.revokeObjectURL(draft.previewUrl));
    draftsRef.current = {};
  }, []);

  return { drafts, draftsRef, stageImage, clearImage, clearAllImages };
}
