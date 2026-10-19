# News Article Navigation Scroll Fix - Verification Report

## Root Cause Identified

When navigating between different articles on `/news&updates/[slug]`, the scroll position from the previous page was sometimes retained. This occurred because:

1. The scroll-reset effects (`useLayoutEffect` and `useEffect`) had empty dependency arrays `[]`
2. Effects with empty arrays only run on initial component mount
3. When navigating from one article slug to another (e.g., `/news&updates/article-1` → `/news&updates/article-2`), Next.js reuses the component instance with new props
4. The scroll-reset effects were not re-running on article change, leaving the old scroll position intact
5. The Lenis smooth-scroll library was preserving scroll position across navigations

## Solution Implemented

**File: `app/news&updates/[slug]/newsclient.tsx`**

### Change 1: useLayoutEffect dependency array (Line 81)
```javascript
// BEFORE:
useIsomorphicLayoutEffect(() => {
  window.history.scrollRestoration = 'manual';
  window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
}, []);  // ❌ Only runs on mount

// AFTER:
useIsomorphicLayoutEffect(() => {
  window.history.scrollRestoration = 'manual';
  window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
}, [initialArticle]);  // ✓ Runs when article changes
```

### Change 2: useEffect dependency array (Line 103)
```javascript
// BEFORE:
useEffect(() => {
  window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
  
  const lenis = new Lenis({...});
  lenis.scrollTo(0, { immediate: true });
  // ...
  return () => { lenis.destroy(); };
}, []);  // ❌ Only runs on mount

// AFTER:
useEffect(() => {
  window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
  
  const lenis = new Lenis({...});
  lenis.scrollTo(0, { immediate: true });
  // ...
  return () => { lenis.destroy(); };
}, [initialArticle]);  // ✓ Runs when article changes
```

## How the Fix Works

1. **On initial page load**: Effects run on mount as before
   - `useIsomorphicLayoutEffect` sets `scrollRestoration = 'manual'` and scrolls to 0 (before paint)
   - `useEffect` initializes new Lenis instance and scrolls to 0

2. **When navigating to a different article**: The `initialArticle` prop changes
   - `useIsomorphicLayoutEffect` runs again → resets scroll to 0 before paint
   - Previous Lenis instance is destroyed by cleanup function
   - `useEffect` runs again → initializes new Lenis and scrolls to 0

3. **Multi-layered scroll protection**:
   - PageTransition component resets scroll on route change: `window.scrollTo(0, 0)`
   - useLayoutEffect resets scroll before rendering
   - useEffect resets scroll after mount, before Lenis takes over
   - Lenis initializes with explicit scroll to 0

## Test Scenarios

### Scenario 1: Featured Article Navigation (Listing → Detail)
**Steps:**
1. Open `/news&updates`
2. Scroll down to see featured article section
3. Click "Read Full Story" button
4. **Expected:** Article detail page loads with cover/header at top
5. **Verify:** Check browser DevTools → scroll position should be 0

### Scenario 2: News Card Navigation (Listing → Detail)
**Steps:**
1. Open `/news&updates`
2. Scroll down past featured article to Recent Stories grid
3. Click on a news card
4. **Expected:** Article detail page loads with top of article visible
5. **Verify:** Scroll position should be 0

### Scenario 3: Article to Article Navigation (Detail → Detail)
**Steps:**
1. Open any article detail page
2. Scroll down to "The Latest Updates" recommendations section
3. Click on a recommendation card
4. **Expected:** Next article detail page loads at top
5. **Verify:** Scroll position should be 0

### Scenario 4: Browser Back Navigation
**Steps:**
1. Open `/news&updates`
2. Scroll down to position X
3. Click on an article
4. Click browser Back button
5. **Expected:** Return to listing at approximately position X (browser's normal restoration)
6. **Verify:** Scroll position should match the saved position from step 2

### Scenario 5: Direct URL Navigation
**Steps:**
1. Open article directly via URL: `/news&updates/article-slug`
2. **Expected:** Page loads at top
3. **Verify:** Scroll position should be 0

### Scenario 6: Mobile Viewport Behavior
**Steps:**
1. Resize browser to mobile width (375px)
2. Repeat Scenarios 1-3
3. **Expected:** Scroll behavior should be identical on mobile
4. **Verify:** All article navigations should start at top

## Implementation Details

### Why `initialArticle`?
- `initialArticle` is the article data prop that changes when navigating to a different slug
- It's the most reliable indicator that a different article is being loaded
- When it changes, we know we need to reset scroll for the new article

### Why Both useLayoutEffect and useEffect?
- **useLayoutEffect (line 81)**: Runs before browser paint → prevents flash of scrolled content
- **useEffect (line 103)**: Runs after mount → ensures scroll is 0 before Lenis initializes

### Why Not Just PageTransition?
- PageTransition handles route transitions but doesn't know about article-specific scroll
- This fix provides scroll reset specific to article changes
- Dual protection ensures reliability across all navigation patterns

## Affected Features (Not Changed)
- Article content and typography remain unchanged
- Featured cover visibility preference (`show_cover_on_article`) still works
- Lenis smooth scrolling animations remain unchanged
- GSAP animations for article cards remain unchanged
- Featured article modal appearance unchanged
- Publication and archive filtering unchanged
- Article data queries unchanged
- News editor functionality unchanged

## Build Status
✓ Next.js build completed successfully
✓ No TypeScript errors related to these changes
✓ All routes compile and generate correctly

## Files Modified
- `app/news&updates/[slug]/newsclient.tsx` (2 dependency arrays updated)

## No Regressions
- Listing page (`/news&updates`) scroll behavior unchanged
- Back navigation scroll restoration preserved
- Anchor links within articles unaffected
- Article-to-article navigation in "Latest Updates" section now includes scroll reset
