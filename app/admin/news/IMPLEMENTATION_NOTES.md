# Article Body Editing in Live Preview - Implementation

## Overview
Moved the article body editing interface from the inspector panel into the live preview article body region. The inspector Content panel now displays only Bold and Italic formatting buttons, while the full editing surface is in the preview.

## Architecture Changes

### 1. **Shared Editor Hook** (`useArticleEditor.ts`)
- New hook that manages a single Tiptap editor instance
- Accepts `value`, `excerpt`, and `onChange` props
- Implements three-priority content fallback: article_content JSON → plain text excerpt → empty
- Syncs content when props change via useEffect with JSON comparison
- Configures Tiptap with restricted schema: paragraphs, text, bold, italic, hardBreak only

### 2. **Refactored RichTextEditor** (`RichTextEditor.tsx`)
- Now a toolbar-only component (previously full editor + toolbar)
- Takes `editor` prop from parent instead of managing its own instance
- Displays only Bold, Italic, Undo, Redo buttons
- Buttons show active/inactive states based on editor selection
- Preserves text selection when formatting buttons are clicked

### 3. **Updated PreviewSkeleton** (`PreviewSkeleton.tsx`)
- Receives `editor` prop from parent
- When `selectedRegion === 'excerpt'`:
  - Renders `<EditorContent>` component from Tiptap (editable)
  - Clicking in preview focuses editor
  - Clicking to select text works normally
- When `selectedRegion !== 'excerpt'`:
  - Renders read-only preview using `renderArticleContent()`
  - Button triggers region selection

### 4. **Updated page.tsx** (`page.tsx`)
- Imports and uses `useArticleEditor` hook
- Creates shared editor instance with `formData` watching
- Passes editor to both `PreviewSkeleton` and `RichTextEditor`
- Shows toolbar only when `selectedRegion === 'excerpt'`
- Displays helper text: "Edit the article content by clicking in the preview on the left."

## User Workflow

1. **Loading an article:**
   - Form loads with `article_content` and `excerpt`
   - Editor hook initializes with content (rich JSON preferred, falls back to excerpt)
   - Form remains clean (setContent doesn't trigger onChange)

2. **Clicking to edit:**
   - User clicks article body in preview
   - Body region gains focus ring outline
   - Caret appears at clicked position
   - Content becomes editable inline

3. **Applying formatting:**
   - User selects text in preview
   - Clicks Bold/Italic button in inspector toolbar
   - Selection preserved during button click
   - Formatting applied to selected text
   - User continues typing without losing content

4. **Saving:**
   - "Save Changes" button saves article with updated `article_content` JSON
   - Excerpt is auto-derived from rich content
   - Cache invalidation revalidates public pages
   - Reload shows formatted content in both preview and public page

## Styling & Typography

- Editor inherits article typography: `text-base leading-[1.85] text-gray-700 md:text-[17px]`
- Prose classes suppress default browser styles
- ProseMirror editor container has no outline on focus
- Paragraphs maintain `mb-6` spacing
- Matches public article rendering exactly

## Form State Management

**During async load:**
- `reset(values)` updates form state
- `watch()` notifies of changes
- Editor hook receives new props
- `useEffect` calls `editor.setContent()`
- `setContent()` does NOT trigger `onChange` callback
- Form remains clean: `isDirty = false` ✓

**During user edit:**
- User types in editor
- `onUpdate` event fires (Tiptap callback)
- `onChange` called with JSON string
- `setValue(..., { shouldDirty: true })`
- Form marked dirty: `isDirty = true` ✓

## Keyboard Shortcuts

- **Ctrl+B**: Toggle bold on selection
- **Ctrl+I**: Toggle italic on selection
- **Ctrl+Z**: Undo
- **Ctrl+Y/Ctrl+Shift+Z**: Redo
- **Enter**: Create new paragraph
- **Shift+Enter**: Insert line break (hardBreak node)

## Limitations & Non-Scope

- **Markdown preview:** Not implemented (rich content is source of truth)
- **Text alignment:** Not supported by schema (paragraphs only)
- **Headings/lists:** Disabled in Tiptap configuration
- **Copy-paste HTML:** Converted to plain text (configured in clipboardParser)
- **Mobile editing:** Touch support works but selection UI may differ from desktop
- **Collaborative editing:** Not implemented (single-user admin)
- **Image/video embeds:** Not supported (text-only content)

## Validation & Storage

- **Validation:** Uses existing `validateArticleContent()` from article-validation.ts
- **JSON Storage:** Article stored as JSONB in `news_updates.article_content`
- **Plain Text Fallback:** Existing articles with `null` article_content display excerpt
- **Excerpt Sync:** Rich content auto-derives excerpt via `extractPlainTextFromContent()`
- **Public Rendering:** Uses shared `renderArticleContent()` utility (consistent with admin)

## Files Changed

1. `app/admin/news/useArticleEditor.ts` - NEW: Shared editor hook
2. `app/admin/news/RichTextEditor.tsx` - MODIFIED: Toolbar-only component
3. `app/admin/news/PreviewSkeleton.tsx` - MODIFIED: Editable preview
4. `app/admin/news/page.tsx` - MODIFIED: Editor management, inspector layout
5. `app/admin/news/useArticleEditor.test.ts` - NEW: Test scenarios

## Backward Compatibility

- **Existing articles:** Continue to display via excerpt until edited with rich content
- **Migration:** No database changes required; column already exists
- **Public pages:** No changes; read-only rendering unchanged
- **Save/load cycle:** Preserves existing flow; only UI reorganization

## Testing Checklist

### Core Functionality
- [ ] Load legacy article (null article_content + populated excerpt)
  - [ ] Editor displays excerpt text in preview
  - [ ] Toolbar visible in inspector
  - [ ] Form remains clean on load

- [ ] Load formatted article (article_content populated)
  - [ ] Editor displays formatted content (bold/italic visible)
  - [ ] Toolbar shows correct active states for current formatting
  - [ ] Typography matches public page exactly

### Editing & Selection
- [ ] Click in preview to focus editor
  - [ ] Caret appears at clicked position
  - [ ] Preview region shows focus ring

- [ ] Text selection in preview
  - [ ] Double-click selects word
  - [ ] Drag to select multiple words
  - [ ] Ctrl+A selects all

- [ ] Formatting via toolbar buttons
  - [ ] Select text, click Bold → text becomes bold
  - [ ] Select bold text, click Bold again → bold removed
  - [ ] Select text, click Italic → text becomes italic
  - [ ] Selection preserved after button click

### Content Preservation
- [ ] Type new content in editor
  - [ ] Form marked dirty
  - [ ] Content appears in preview
  - [ ] Form shows unsaved indicator

- [ ] Switch inspector regions without saving
  - [ ] Click different inspector field (title, meta, image)
  - [ ] Return to excerpt region
  - [ ] Unsaved content still present

- [ ] Reset button
  - [ ] Reverts to original content
  - [ ] Undo history cleared (optional: may preserve)
  - [ ] Form marked clean

### Paragraph & Whitespace
- [ ] Multiple paragraphs in legacy excerpt
  - [ ] Split on `\n\n` preserved
  - [ ] Each paragraph has correct spacing

- [ ] Enter key creates new paragraph
  - [ ] Text on new line in separate paragraph
  - [ ] Paragraph spacing maintained

- [ ] Shift+Enter creates line break
  - [ ] Inline line break (hardBreak node)
  - [ ] Content continues on next line without paragraph break

### Form & Validation
- [ ] Save legacy article after editing
  - [ ] article_content stored as JSON
  - [ ] excerpt derived from content
  - [ ] Reload shows saved formatting

- [ ] Discard warning
  - [ ] Shows when isDirty && attempting to leave
  - [ ] "Discard Changes" clears form dirty state
  - [ ] "Keep Editing" remains in editor

- [ ] Validation errors display
  - [ ] Too little text shows error in inspector
  - [ ] Invalid JSON shows error (shouldn't happen in normal use)

### Browser & Platform
- [ ] Desktop browsers (Chrome, Firefox, Safari, Edge)
  - [ ] Editing works correctly
  - [ ] Keyboard shortcuts function
  - [ ] Typography renders correctly

- [ ] Mobile browsers (iOS Safari, Chrome Mobile)
  - [ ] Touch focus works
  - [ ] Text selection works (may differ from desktop)
  - [ ] Toolbar buttons clickable
  - [ ] Viewport doesn't shift during editing

### Integration
- [ ] Public article page
  - [ ] Displays saved formatted content
  - [ ] Rendering identical to admin preview
  - [ ] No editing controls visible

- [ ] Article switching
  - [ ] Navigate to different article via bottom nav
  - [ ] Editor loads new content
  - [ ] Unsaved changes warning if dirty

- [ ] Cache invalidation
  - [ ] Save article → public page updates immediately (with revalidatePath)
  - [ ] No stale content displayed

## Performance Notes

- Editor instance reused across region switches (no remounting)
- JSON comparison prevents unnecessary re-renders
- Content sync only triggers on actual changes
- Toolbar buttons use memoization in Tiptap internals

## Future Enhancements (Out of Scope)

- [ ] Markdown preview split-view
- [ ] Word count display
- [ ] Reading time estimate
- [ ] Automatic image resizing
- [ ] Link detection and formatting
- [ ] Table support
- [ ] Collaborative editing
- [ ] Version history/audit trail
