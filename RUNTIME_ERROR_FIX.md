# Runtime Error Fix: JSON.parse() on JSONB Objects

**Date:** 2026-10-16  
**Issue:** `"[object Object]" is not valid JSON` error when loading articles from database  
**Status:** ✅ FIXED AND VERIFIED  
**Build:** ✅ SUCCESS (17.6s, 25/25 pages, zero TypeScript errors)

---

## Problem

When articles are loaded from Supabase, the `article_content` field can come as:
- **JSONB object** (already parsed by Supabase client)
- **JSON string** (legacy format, still supported)
- **null** (no rich content)

The code was unconditionally calling `JSON.parse()` without checking the type first:

```typescript
// BROKEN CODE
article_content: initialArticle.article_content ? JSON.parse(initialArticle.article_content) : null
// If article_content is already an object: TypeError [object Object] is not valid JSON
```

**Affected Locations:**
1. `app/news&updates/[slug]/newsclient.tsx:158` — PUBLIC PAGE (Error occurred here)
2. `app/admin/news/PreviewSkeleton.tsx:44` — ADMIN PREVIEW
3. `app/admin/news/page.tsx:390` — ADMIN FORM LOADING

---

## Solution

Use the existing `parseArticleContent()` helper which properly handles all data types:

```typescript
export function parseArticleContent(
  content: string | TiptapDoc | null | undefined
): TiptapDoc {
  if (!content) {
    return { type: 'doc', content: [{ type: 'paragraph', content: [] }] };
  }

  // Already parsed object: validate and use directly
  if (typeof content === 'object' && content.type === 'doc') {
    return normalizeDoc(content);
  }

  // JSON string: parse safely with try/catch
  if (typeof content === 'string') {
    try {
      const parsed = JSON.parse(content);
      if (parsed?.type === 'doc') {
        return normalizeDoc(parsed);
      }
    } catch {
      // Fall through to plain text parsing
    }
    // Plain text fallback
    ...
  }

  return { type: 'doc', content: [{ type: 'paragraph' }] };
}
```

**Fixed Code:**
```typescript
article_content: initialArticle.article_content ? parseArticleContent(initialArticle.article_content) : null
```

---

## Changes Made

### 1. Fix JSON.parse() calls (3 locations)

**File 1:** `app/news&updates/[slug]/newsclient.tsx`
- Line 16: Added import for `parseArticleContent` and `TiptapDoc`
- Line 25: Updated type annotation: `article_content?: string | TiptapDoc | null`
- Line 159: Changed from `JSON.parse(initialArticle.article_content)` to `parseArticleContent(initialArticle.article_content)`

**File 2:** `app/admin/news/PreviewSkeleton.tsx`
- Line 4: Added import for `parseArticleContent`
- Line 44: Changed from `JSON.parse(data.article_content)` to `parseArticleContent(data.article_content)`

**File 3:** `app/admin/news/page.tsx`
- Line 12: Added import for `parseArticleContent`
- Line 391: Changed from `JSON.parse(initialValues.article_content)` to `parseArticleContent(initialValues.article_content)`

### 2. Improve type annotations

Updated `NewsArticle` interface to explicitly allow JSONB object type:
```typescript
article_content?: string | TiptapDoc | null; // Can be JSONB object or JSON string from Supabase
```

This clarifies to future developers that Supabase JSONB columns return parsed objects, not strings.

---

## Verification

### Executed Tests: 7/7 ✅

```
✓ TEST 1: Already-parsed Tiptap doc (JSONB object from Supabase)
  → Simulates actual Supabase behavior: database returns parsed JSON
  → Previous code would crash here
  → Fixed code handles gracefully

✓ TEST 2: JSON string (old format: stringified article_content)
  → Backward compatible with legacy format
  → Parses string correctly

✓ TEST 3: Null/undefined article_content (uses excerpt fallback)
  → Edge case: no rich content, falls back to plain text

✓ TEST 4: Plain text string (legacy plain text fallback)
  → Old articles might have plain text in article_content
  → Gracefully parses as plain text

✓ TEST 5: Malformed JSON (graceful fallback to plain text)
  → Malformed JSON strings don't crash
  → Fall back to plain text parsing

✓ TEST 6: Empty object (not a Tiptap doc, should handle gracefully)
  → Invalid objects handled with default structure

✓ TEST 7: adaptLegacyArticleToSections receives parsed content
  → Integration test: all three data types work with legacy adapter
  → No crashes with any input type
```

**Test Results:**
```
Executed Tests: 7
✓ PASSED: 7
✗ FAILED: 0
✅ ALL TESTS PASSED
```

### Build Results: ✅ SUCCESS

```
✓ Compiled successfully in 17.6s
✓ TypeScript: 0 errors
✓ Pages: 25/25 generated
✓ Exit code: 0
```

---

## Data Priority

The content priority in `adaptLegacyArticleToSections()` remains correct:

1. **Valid `article_sections` FIRST** → use sections directly (no parsing needed)
2. **Otherwise, adapt legacy `article_content`** → parse using `parseArticleContent()`
3. **Otherwise, use plain-text `excerpt`** → fallback in adapter

The fix **does not eagerly parse legacy content when valid sections exist**, maintaining performance.

---

## Backward Compatibility

✅ **No breaking changes:**
- Existing articles without sections continue to work
- Legacy string content still supported
- Plain text fallback preserved
- Null/empty content handled gracefully

✅ **No database changes required:**
- `article_content` field unchanged
- `article_sections` field unchanged
- No migration needed
- Existing records untouched

✅ **Type-safe:**
- Updated interfaces reflect reality
- All three data types explicitly documented
- Future developers won't repeat this bug

---

## Remaining Work

### Executed
- ✅ Identified root cause (unconditional JSON.parse)
- ✅ Located all affected code paths (3 locations)
- ✅ Reused existing type-safe helper
- ✅ Updated type annotations
- ✅ Verified with comprehensive test suite (7/7 pass)
- ✅ Confirmed build success (zero errors)

### Pending Manual Browser Testing
- ⏳ Load public article page with sections
- ⏳ Load public article page with legacy content
- ⏳ Verify no runtime errors in browser console
- ⏳ Check admin form loads without crashing
- ⏳ Verify preview renders correctly
- ⏳ Test on mobile/desktop for responsive behavior

### Pending After Database Migration
- ⏳ Create new article with sections
- ⏳ Save and reload (persistence test)
- ⏳ Verify excerpt derived correctly
- ⏳ Test mixed articles (some sections, some legacy)

---

## Related Code (Already Safe)

Server-side validation in `app/actions/news.ts` already checks type before parsing:
```typescript
// ✅ SAFE: Checks typeof before parsing
const sections = typeof filteredPayload.article_sections === 'string'
  ? JSON.parse(filteredPayload.article_sections)
  : filteredPayload.article_sections;

if (typeof filteredPayload.article_content === 'string') {
  try {
    filteredPayload.article_content = JSON.parse(filteredPayload.article_content);
  } catch (e) {
    throw new Error('Invalid article content format');
  }
}
```

---

## Files Modified

| File | Changes | Status |
|------|---------|--------|
| `app/news&updates/[slug]/newsclient.tsx` | Import + type + fix | ✅ DONE |
| `app/admin/news/PreviewSkeleton.tsx` | Import + fix | ✅ DONE |
| `app/admin/news/page.tsx` | Import + fix | ✅ DONE |
| `verify-content-parsing.js` | Test suite (7/7 pass) | ✅ DONE |

---

## Deployment Safety

✅ **Ready to deploy when ready:**
- No database changes required
- No migrations needed
- Backward compatible
- Improved type safety
- All tests pass
- Build succeeds

---

## Summary

**The runtime error has been fixed by replacing unconditional `JSON.parse()` with a type-safe helper that handles JSONB objects, JSON strings, and null values.**

All three affected code paths now properly normalize article content regardless of how it arrives from the database. The fix maintains backward compatibility, improves type safety, and is ready for deployment after manual browser testing.
