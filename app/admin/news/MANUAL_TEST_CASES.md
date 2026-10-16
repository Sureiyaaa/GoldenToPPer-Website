# Manual Test Cases for Editable Preview

## Setup
1. `npm run dev` to start development server
2. Navigate to http://localhost:3000/admin/news
3. Create a new article or load an existing one

---

## TEST 1: First Click Into Article After Region Switch

**Objective:** Verify caret lands at clicked position; no extra activation needed

### Steps:
1. Load any article or create new one with content
2. Click on **Title** region (in preview)
3. Inspector shows title editor
4. Click on **article body text** (in preview, not the outline)
   - Expected: Caret appears at clicked position immediately
   - Expected: Blue ring outline appears around article body
   - Expected: Inspector switches to "Formatting" label
   - Expected: Bold/Italic buttons appear

### Verification:
- ✓ Caret visible in article text where clicked
- ✓ Can type immediately without another click
- ✓ No empty editor state
- ✓ Region indicator updated correctly

---

## TEST 2: Text Selection - Multiple Methods

**Objective:** Verify text selection works for formatting application

### 2a - Single Click + Drag
1. Click in article text
2. Click and drag to select 3-4 words
   - Expected: Text highlighted in blue
   - Expected: Bold/Italic buttons enabled
3. Release mouse
   - Expected: Selection preserved
4. Click Bold button
   - Expected: Selected text becomes bold
   - Expected: Selection preserved after button click
   - Expected: Can continue typing

### 2b - Double-Click Word Selection
1. Click in article text
2. Double-click on a word
   - Expected: Word selected (highlighted)
   - Expected: Bold/Italic buttons enabled
3. Click Italic button
   - Expected: Selected word becomes italic
   - Expected: Selection preserved
   - Expected: Rest of text unaffected

### 2c - Ctrl+A Select All
1. Click in article text
2. Press Ctrl+A
   - Expected: All content selected
   - Expected: Buttons enabled
3. Click Bold
   - Expected: All text becomes bold
   - Expected: Form marked dirty

### Verification:
- ✓ Selection visible in all cases
- ✓ Buttons enabled when text selected
- ✓ Selection preserved when clicking toolbar buttons
- ✓ Formatting applied to selected text only
- ✓ Can continue editing after formatting

---

## TEST 3: Legacy Paragraph Behavior

**Objective:** Verify both single-newline and double-newline handling

### 3a - Double Newlines (Explicit Paragraph Split)
1. Create article with excerpt:
   ```
   First paragraph
   
   Second paragraph
   
   Third paragraph
   ```
2. Save article (creates article_content)
3. Reload or click to another region and back
4. Inspect article display
   - Expected: Three separate paragraphs
   - Expected: Spacing between paragraphs (mb-6)
   - Expected: No blank lines between paragraphs

### 3b - Single Newlines (Legacy Plain Text)
1. Create article with excerpt:
   ```
   Line one
   Line two
   Line three
   ```
2. Save article
3. Reload
4. Inspect article display
   - Expected: All three lines in SINGLE paragraph (not split)
   - Expected: No paragraph breaks
   - Possible: Lines appear as continuous text (behavior dependent on split regex /\n\n+/)

### 3c - Mixed Newlines
1. Create article with excerpt:
   ```
   Para 1 line 1
   Para 1 line 2
   
   Para 2 line 1
   Para 2 line 2
   ```
2. Save and reload
3. Inspect display
   - Expected: Two paragraphs
   - Expected: First para has "Para 1 line 1 Para 1 line 2" (single newlines not split)
   - Expected: Second para has "Para 2 line 1 Para 2 line 2"

### Verification:
- ✓ Double newlines create paragraph breaks
- ✓ Single newlines preserved within paragraphs (text rendering handles \n)
- ✓ Consistent rendering across load/reload
- ✓ No extra blank paragraphs created

---

## TEST 4: Public Article Rendering

**Objective:** Verify /news&updates/[slug] displays saved content correctly

### Prerequisites:
- Database migration applied to dev environment
- At least one published article with rich content in article_content

### Steps:
1. In admin, load article with rich content (bold/italic applied)
2. Note the title and content formatting
3. Save article
4. Navigate to public page: http://localhost:3000/news&updates/[slug]
   - Replace [slug] with actual article slug
   - Expected: Article displays
   - Expected: Bold text appears bold
   - Expected: Italic text appears italic
   - Expected: Multiple paragraphs have proper spacing
5. Compare with admin preview
   - Expected: Formatting identical
   - Expected: Spacing identical
   - Expected: Typography identical

### Verification (with database):
- ✓ Public page renders all paragraphs
- ✓ Formatting (bold/italic) displays correctly
- ✓ Matches admin preview exactly
- ✓ No HTML entities or escaping issues

### Note:
If database migration not applied, public page may show excerpt only (expected behavior for legacy articles).

---

## TEST 5: Editor Instance Persistence

**Objective:** Verify editor doesn't remount when switching regions

### Steps:
1. Load article with content
2. Click in article body (Focus Formatting region)
3. Type some new text: "TEST TEXT HERE"
4. Click Title region (in preview)
   - Inspector switches to title editor
   - Article body retains new text (not visible while title selected)
5. Click back to article body
   - Expected: "TEST TEXT HERE" still present
   - Expected: No form reset or content loss

### Verification:
- ✓ Content persists across region switches
- ✓ No extra renders/remounts
- ✓ Form dirty state preserved

---

## TEST 6: Form Dirty State Transitions

**Objective:** Verify form clean/dirty state accuracy

### 6a - Load → Clean
1. Load existing article
2. Inspect form state (browser DevTools or form indicator)
   - Expected: isDirty = false
   - Expected: No "unsaved changes" warning
3. Reload admin page
   - Expected: Same content loads again

### 6b - Edit → Dirty
1. Load existing article
2. Click in article body
3. Type new content
4. Inspect form state
   - Expected: isDirty = true
   - Expected: "Save Changes" button active
   - Expected: Unsaved indicator visible
5. Try to navigate away
   - Expected: "Unsaved changes" warning appears

### 6c - Reset → Clean
1. Load and make edits
2. Click Reset button
3. Inspect form state
   - Expected: isDirty = false
   - Expected: Content reverted to original
   - Expected: Can navigate away

### Verification:
- ✓ Form clean on initial load
- ✓ Form dirty on user edits
- ✓ Form clean after Reset
- ✓ Navigation warnings work correctly

---

## TEST 7: Keyboard Shortcuts

**Objective:** Verify keyboard shortcuts work in preview editor

### 7a - Ctrl+B Bold
1. Click in article body
2. Type "text"
3. Select the word "text"
4. Press Ctrl+B
   - Expected: Text becomes bold
   - Expected: Button shows active state

### 7b - Ctrl+I Italic
1. Click in article body
2. Type "word"
3. Select "word"
4. Press Ctrl+I
   - Expected: Text becomes italic

### 7c - Ctrl+Z Undo
1. Type new content
2. Press Ctrl+Z
   - Expected: Content reverts to previous state
   - Expected: Works multiple times for multiple undos

### 7d - Ctrl+Y Redo (or Ctrl+Shift+Z)
1. Undo some changes
2. Press Ctrl+Y (or Ctrl+Shift+Z)
   - Expected: Content re-applies
   - Expected: Can redo multiple changes

### 7e - Enter New Paragraph
1. Type text: "Line 1"
2. Press Enter
3. Type text: "Line 2"
   - Expected: Creates two separate paragraphs
   - Expected: Can verify in saved JSON structure

### 7f - Shift+Enter Line Break
1. Type text: "Line 1"
2. Press Shift+Enter
3. Type text: "Line 2"
   - Expected: Same paragraph with line break
   - Expected: No paragraph separation
   - Verify in saved JSON: hardBreak node present

### Verification:
- ✓ Ctrl+B toggles bold
- ✓ Ctrl+I toggles italic
- ✓ Ctrl+Z undoes
- ✓ Ctrl+Y redoes
- ✓ Enter creates paragraph
- ✓ Shift+Enter creates line break

---

## TEST 8: Toolbar Button States

**Objective:** Verify Bold/Italic button active/inactive states

### Steps:
1. Click in article body with mixed formatting
2. Position caret in unformatted text
   - Expected: Bold button inactive
   - Expected: Italic button inactive
3. Position caret in bold text
   - Expected: Bold button shows active (blue background)
   - Expected: Italic button inactive
4. Position caret in italic text
   - Expected: Italic button inactive
   - Expected: Bold button inactive
5. Position caret in both bold AND italic text
   - Expected: Both buttons show active
6. Select mixed text (some bold, some not)
   - Expected: Button shows mixed/partial state (if supported)
   - Or: Button shows active if any selection contains that mark

### Verification:
- ✓ Buttons reflect current formatting accurately
- ✓ States update as caret moves
- ✓ Mixed selection handled appropriately

---

## TEST 9: Long Form Editing

**Objective:** Verify editor handles substantial content

### Steps:
1. Create article with 5+ paragraphs of content
2. Add formatting (bold, italic) throughout
3. Test scrolling within preview
4. Test selection across paragraphs
5. Save and verify all content persists
6. Reload and verify formatting intact

### Verification:
- ✓ No performance issues with large content
- ✓ Scroll works smoothly
- ✓ Selection works across paragraph boundaries
- ✓ All content saves and reloads correctly

---

## TEST 10: Inspector to Preview Focus Handoff

**Objective:** Verify focus management between regions

### Steps:
1. Click in article body
   - Expected: Editor focused, cursor visible
2. Press Tab
   - Expected: Focus moves to next element (likely outside editor)
   - Or: Inserts tab (depends on Tiptap config)
3. Click Bold button in toolbar
   - Expected: Focus returns to editor for command execution
   - Expected: Selection preserved
   - Expected: Can continue typing

### Verification:
- ✓ Focus transitions work smoothly
- ✓ Toolbar buttons can be accessed while editing
- ✓ Editor regains focus after toolbar interaction

---

## Database-Dependent Tests

Only run if migration is applied to dev database:

### TEST 11: Save and Persist
1. Create new article with rich content
2. Click Save Changes
3. Verify success message
4. Reload page
   - Expected: Content still present with formatting
5. Navigate to public page
   - Expected: Formatting visible

### TEST 12: Edit Existing Article
1. Load article that was previously edited via rich editor
2. Verify formatting displays
3. Make additional edits
4. Save again
5. Verify changes persisted

---

## Summary Table

| Test | Objective | Status |
|------|-----------|--------|
| 1 | First click caret placement | ? |
| 2 | Text selection methods | ? |
| 3 | Paragraph behavior | ? |
| 4 | Public rendering | ? |
| 5 | Editor persistence | ? |
| 6 | Form dirty state | ? |
| 7 | Keyboard shortcuts | ? |
| 8 | Button states | ? |
| 9 | Long form editing | ? |
| 10 | Focus management | ? |
| 11 | Save/persist (DB) | ? |
| 12 | Edit existing (DB) | ? |

**After testing, update status column with ✓ or ✗ and notes.**
