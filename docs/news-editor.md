# News & Updates editor technical reference

This describes the current implementation, rather than historical completion or build results. It covers `/admin/news` and `/news&updates/[slug]`; older implementation notes and standalone verification scripts may describe superseded behavior.

## Implementation map

| Responsibility | Source |
| --- | --- |
| Form state, loading, selection, Save and Reset | [News editor page](../app/admin/news/page.tsx) |
| Interactive preview and inline body surface | [PreviewSkeleton](../app/admin/news/PreviewSkeleton.tsx), [SectionBodyEditor](../app/admin/news/SectionBodyEditor.tsx) |
| Section settings and draggable cards | [SectionInspector](../app/admin/news/SectionInspector.tsx), [SectionEditor](../app/admin/news/SectionEditor.tsx) |
| Editor registry and image drafts | [useSectionEditor](../app/admin/news/useSectionEditor.ts), [useSectionImageUploads](../app/admin/news/useSectionImageUploads.ts) |
| Data model, legacy adapter and section excerpt helper | [Article section types/helpers](../app/types/article-sections.ts) |
| Authorized uploads and persistence | [News server actions](../app/actions/news.ts) |
| Public rendering and shared presentation | [ArticleSections](../app/components/news/ArticleSections.tsx), [ArticleSectionLayout](../app/components/news/ArticleSectionLayout.tsx), [article typography](../app/components/news/article-typography.css), [content renderer](../lib/rendering/article-content.ts) |
| Public query, metadata and navigation | [Article route](../app/news&updates/[slug]/page.tsx), [article client](../app/news&updates/[slug]/newsclient.tsx) |

## Article and section model

Articles remain in `public.news_updates`. `article_sections` is a JSONB document containing `version: 1`, a `sections` array, and `createdAt`/`updatedAt` strings. Each section has a stable `id`, `headingEnabled`, `layout`, rich-text `body`, and numeric `order`, with optional `heading` and `image`.

The array is the rendering order. Reordering updates the array and its `order` fields, marks the form dirty, and persists through Save Changes. Editor identity, image drafts and selection targets use section IDs, never array positions. A missing heading displays a card label such as “Section 2” without writing that label into content. Disabling a heading retains its text.

The default inspector remains Title → Category → URL Slug → Sections. The displayed category “Update” retains the stored value `Updates`; `News` remains unchanged. Selecting preview content replaces the overview with a contextual panel:

- Title and publication date share Article Header and one selection boundary, excluding the cover.
- The cover opens Featured Image; section images and headings retain dedicated controls.
- Section body and card selection share Section Settings, including the compact Bold/Italic toolbar. Body typing stays in the preview.
- Back to overview restores default fields. Panel selection scrolls its controls to the beginning without dirtying the form; body selection retains preview focus/caret behavior. Child image/heading clicks stop propagation.

Section placements are Image Above, Image Below, Image Left and Image Right. Placement controls appear when an image, including a staged upload, exists. Removing an image retains its placement. Without an image, all placements use the standard paragraph width with no media column or reserved media height. Desktop side placements retain a 40% image column, top alignment and proportional full-image display; mobile side placements stack image first.

## Legacy compatibility and text rendering

Readers prefer a valid `article_sections` document. Otherwise, `adaptLegacyArticleToSections` creates one section from legacy `article_content`, falling back to `excerpt`, and seeds its image from the article's `image`. Adaptation is in memory during loading/rendering; opening an article does not write records. An explicit editor Save can persist the adapted sections.

Keep `article_content`, `article_layout`, `excerpt` and `image`. Recognized stored article-level layouts survive Save/Reset, although their obsolete inspector is removed and current section presentation uses section placements. The legacy adapter uses `image-above`; it does not recreate each old whole-article arrangement. Within section layouts, `image-contained` renders like Image Below. `text-only` uses standard paragraph width and keeps any stored image hidden until a supported placement is explicitly selected. Do not reveal or delete that hidden image during unrelated edits.

`parseArticleContent` accepts JSONB objects, JSON strings and legacy plain text. Do not blindly `JSON.parse` a value already returned as an object. Legacy plain text splits on any run of newlines (`/\n+/`), filtering blank segments and trimming paragraph edges. Rich paragraph documents retain intentional empty paragraphs, spaces, Bold/Italic marks and hard breaks. Enter creates a paragraph; Shift+Enter creates a hard break. The shared renderer adds no spacing characters between adjacent marked text nodes and matches the editor's terminal line-break presentation.

News typography is shared across editable preview, unselected admin preview and public content: justified text, line height 1.85 and preserved rich-text spacing. Empty editor bodies show “Click here to write your section's paragraph...” through generated CSS content and an empty-only 64px interaction area. This cue is based on document text, does not normalize the document, is absent from saved JSON/excerpts and public pages, and must not dirty the form on focus.

`deriveExcerptFromSections` finds the first nonempty paragraph across sections and limits its result to 200 characters. The save action also validates legacy `article_content` when supplied and can derive the final excerpt from that content afterward. Check both paths when reviewing excerpt behavior; do not assume the section helper is the only writer.

## Cover visibility, uploads and saving

Cover rendering requires an article image and `show_cover_on_article !== false`. Explicit `false` must survive loading, form submission, persistence and public queries; only missing/null preferences retain the visible legacy default. The save action accepts booleans, leaves an omitted preference unchanged on edits, and lets new records use the database default when omitted.

The visibility toggle hides only the article cover, leaving no reserved cover space. It retains the original `image` for listing cards and metadata. Cover and section images are separate targets; a legacy-adapted section can still use the original article image independently of the cover toggle. A hidden/missing cover remains reachable through the preview's Featured Image control.

Section uploads reuse the shared admin ImageDropzone. Files and blob preview URLs stay in ID-keyed drafts outside `article_sections`; Save uploads to `news_images` and substitutes persistent URLs into the matching sections. Shared validation permits JPEG, PNG, WebP and GIF up to 10 MiB, checking both MIME type and extension. See [upload validation](../lib/validations/news-image-upload.ts).

Save guards results by load/save generation and draft identity. Switching selection or reordering cannot redirect an image; removal, Reset and article navigation invalidate stale results. Successful section uploads can be reused after a database-save failure, while changed drafts require saving again. Preview URLs are revoked when drafts are replaced, removed or discarded. Reset restores saved fields/images, discards drafts and returns to overview. Keep the existing unsaved-navigation warning and server-side News permissions/field allowlists.

The public detail query retrieves the full article and filters for `is_active = true` and `is_archived IS NULL`; metadata retains `image`. The route declares 60-second revalidation, and successful saves revalidate the home page, News listing and article detail route pattern. Do not mask a missing database column or failed save with a local-only visibility preference.

## Database prerequisites

| Migration | Purpose |
| --- | --- |
| [20261016000000_add_article_content_field.sql](../supabase/migrations/20261016000000_add_article_content_field.sql) | Nullable JSONB rich article content |
| [20261016010000_add_article_layout.sql](../supabase/migrations/20261016010000_add_article_layout.sql) | Legacy article layout field, allowed values and default |
| [20261016020000_add_article_sections.sql](../supabase/migrations/20261016020000_add_article_sections.sql) | Nullable JSONB section document; structure validated by the application |
| [20261019000000_add_news_cover_visibility.sql](../supabase/migrations/20261019000000_add_news_cover_visibility.sql) | `show_cover_on_article BOOLEAN NOT NULL DEFAULT true` |

Migration files do not establish the schema state of any connected environment. Verify the target schema before real persistence tests and use the normal reviewed migration process. Early migrations are not all idempotent; do not blindly rerun them. Loading compatibility does not make a missing column available for saving. No bulk article rewrite is required by the section adapter.

## Editor lifecycle safeguards

- One Tiptap editor per section ID lives in an article-scoped registry. Selection, reordering, heading changes and placement changes preserve instances and independent undo histories. The shared layout keeps keyed text/editor subtrees stable.
- Programmatic content synchronization suppresses change callbacks; selection and focus alone must not dirty the form. Toolbar actions retain the intended preview selection and target the registered editor.
- Reset intentionally destroys/recreates editors from saved content with fresh history, so undo cannot recover discarded edits. Removed sections destroy their editors; article changes and unmount clear the registry.
- Tiptap remains in admin editing code. Public sections render static content through the shared renderer and do not initialize editors.

## Regression checks

Focused runnable checks are [section images/editor interactions](../tests/news-section-images.test.cjs), [typography/rendering](../tests/news-typography.test.cjs) and [cover visibility/action validation](../tests/news-cover-visibility.test.cjs):

```sh
node --test tests/news-cover-visibility.test.cjs
node --test tests/news-section-images.test.cjs
node --test tests/news-typography.test.cjs
```

The browser fixtures use real components/Tiptap in Chromium with mocked authentication, storage and database calls. They generate temporary outputs and do not prove real storage uploads or database persistence. All nine obsolete standalone root `verify-*.js` scripts have been retired; useful regression coverage was migrated into maintained `tests/*.test.cjs` suites that exercise production implementations rather than copied verification logic. Historical pass counts are not evidence for a new checkout.

For authenticated manual regression, use an approved development/staging environment with the required schema, checking desktop and mobile widths:

1. Load both sections-based and legacy articles. Check overview field order, unchanged slug/category values and clean initial state. Select title/date, cover, section heading/image/body and cards; confirm exactly one contextual panel and correct Back behavior, with no dirtiness from selection alone.
2. Add an empty section, with/without a heading. Click or keyboard-activate the body cue and type immediately. Test image-before-text and text-before-image, clearing text, section switching and Save/reload; the cue must never become content.
3. Drag-select and double-click text. Apply Bold, Italic and both together from toolbar and keyboard; verify the correct section/range, caret behavior, Enter/Shift+Enter and independent undo/redo after switching sections and placements.
4. Reorder by mouse, touch and keyboard handle: Enter/Space picks up/drops, arrows or Home/End choose position, Escape cancels. Selection and deletion stay separate. Save/reload must preserve content and order by ID.
5. Browse/drop, replace and remove section images; try invalid types/extensions and oversized files. Switch/reorder/remove sections while uploads are pending; verify no stale assignment. Check error feedback, retry and Reset. Confirm real persistent URLs, with no Files/blob URLs in saved section JSON, and unchanged cover/other sections.
6. Exercise all four placements, portrait/landscape images, removed/re-added images, and headings on/off. Check standard image-free paragraph width, side-image top alignment, mobile stacking, matching preview/public typography and intentional blank lines. Verify legacy `image-contained` and hidden-image `text-only` content survives unrelated saves.
7. Hide the cover, Save, reload the editor and open the public route. Confirm the preference persists, no cover gap remains, and listing thumbnails/metadata retain the image. Re-enable and Save to recover the original cover. Verify Reset restores the last saved preference and content; discarded edits must not return via undo.
8. Check published versus archived/inactive article access. Confirm Latest Updates precedes the single footer, excludes the current article and shows up to three visible articles ordered by descending date. With no recommendations, the recommendations block should be absent.
9. Navigate listing → article, article → article, via direct URLs and browser Back at desktop/mobile widths, including navigation during entrance animations. Record any retained scroll position rather than assuming it is resolved.

## Deferred navigation issue

The public client resets scroll on slug changes, recreates Lenis, and removes the same GSAP ticker callback that it registered. Latest Updates is placed before Footer in document flow. **Article navigation may still retain an incorrect scroll position when triggered during entrance animations. Further investigation is deferred.** Keep this limitation explicit; the existing lifecycle cleanup does not establish that every animation/navigation race is fixed.
