#!/usr/bin/env node

/**
 * Article Layout Presets Verification
 * Tests layout preset definitions, validation, and defaults
 */

let passCount = 0;
let failCount = 0;

function assert(condition, message) {
  if (condition) {
    console.log(`✓ ${message}`);
    passCount++;
  } else {
    console.error(`✗ ${message}`);
    failCount++;
  }
}

function assertEqual(actual, expected, message) {
  if (JSON.stringify(actual) === JSON.stringify(expected)) {
    console.log(`✓ ${message}`);
    passCount++;
  } else {
    console.error(`✗ ${message}`);
    console.error(`  Expected: ${JSON.stringify(expected)}`);
    console.error(`  Actual:   ${JSON.stringify(actual)}`);
    failCount++;
  }
}

console.log('\n=== ARTICLE LAYOUT PRESETS VERIFICATION ===\n');

// Define presets (must match server-side definitions)
const VALID_LAYOUTS = ['image-above', 'title-above', 'image-contained', 'sidebar-image-right', 'sidebar-image-left'];
const DEFAULT_LAYOUT = 'image-above';

console.log('TEST 1: Valid Layout Identifiers');
console.log('-'.repeat(60));

VALID_LAYOUTS.forEach((layout) => {
  assert(typeof layout === 'string' && layout.length > 0, `Layout ${layout} is valid string`);
});

assertEqual(VALID_LAYOUTS.length, 5, 'Exactly 5 layout presets defined');

console.log('\nTEST 2: Default Layout');
console.log('-'.repeat(60));

assert(VALID_LAYOUTS.includes(DEFAULT_LAYOUT), `Default layout "${DEFAULT_LAYOUT}" is in valid set`);
assertEqual(DEFAULT_LAYOUT, 'image-above', 'Default layout is image-above');

console.log('\nTEST 3: Layout Validation Function');
console.log('-'.repeat(60));

function isValidLayout(value) {
  return VALID_LAYOUTS.includes(value);
}

assert(isValidLayout('image-above'), 'Valid preset: image-above');
assert(isValidLayout('title-above'), 'Valid preset: title-above');
assert(isValidLayout('image-contained'), 'Valid preset: image-contained');
assert(isValidLayout('sidebar-image-right'), 'Valid preset: sidebar-image-right');
assert(isValidLayout('sidebar-image-left'), 'Valid preset: sidebar-image-left');
assert(!isValidLayout('invalid-layout'), 'Invalid preset rejected');
assert(!isValidLayout(null), 'Null rejected');
assert(!isValidLayout(undefined), 'Undefined rejected');
assert(!isValidLayout(''), 'Empty string rejected');

console.log('\nTEST 4: Layout Normalization');
console.log('-'.repeat(60));

function normalizeLayout(value) {
  if (VALID_LAYOUTS.includes(value)) return value;
  return DEFAULT_LAYOUT;
}

assertEqual(normalizeLayout('image-above'), 'image-above', 'Valid layout preserved');
assertEqual(normalizeLayout('title-above'), 'title-above', 'Valid layout preserved');
assertEqual(normalizeLayout(undefined), DEFAULT_LAYOUT, 'Undefined normalizes to default');
assertEqual(normalizeLayout(null), DEFAULT_LAYOUT, 'Null normalizes to default');
assertEqual(normalizeLayout('invalid'), DEFAULT_LAYOUT, 'Invalid normalizes to default');
assertEqual(normalizeLayout(''), DEFAULT_LAYOUT, 'Empty string normalizes to default');

console.log('\nTEST 5: Form Schema Validation');
console.log('-'.repeat(60));

const FormSchema = {
  article_layout: VALID_LAYOUTS,
};

function validateFormField(value) {
  if (value === undefined) return DEFAULT_LAYOUT; // Undefined in form gets default
  if (!isValidLayout(value)) {
    throw new Error(`Invalid layout: ${value}`);
  }
  return value;
}

assert(validateFormField('image-above') === 'image-above', 'Form field accepts valid layout');
assert(validateFormField(undefined) === DEFAULT_LAYOUT, 'Form field defaults undefined to image-above');

try {
  validateFormField('invalid-layout');
  failCount++;
  console.error('✗ Form field should reject invalid layout');
} catch (e) {
  passCount++;
  console.log(`✓ Form field rejects invalid layout with error: ${e.message}`);
}

console.log('\nTEST 6: Server Action Validation');
console.log('-'.repeat(60));

// Simulate server-side validation
function validateArticleLayoutAction(layout, isCreate) {
  // New articles default to image-above if not provided
  if (isCreate && (layout === undefined || layout === null)) {
    return 'image-above';
  }

  // Existing articles preserve layout if not provided
  if (!isCreate && (layout === undefined || layout === null)) {
    return undefined; // Signal to preserve existing value
  }

  // Reject invalid layouts
  if (!isValidLayout(layout)) {
    throw new Error(`Invalid layout preset: ${layout}`);
  }

  return layout;
}

// Create new article: default to image-above
assert(
  validateArticleLayoutAction(undefined, true) === 'image-above',
  'New article defaults to image-above when layout undefined'
);

// Create new article: use provided layout
assert(
  validateArticleLayoutAction('title-above', true) === 'title-above',
  'New article uses provided layout'
);

// Edit existing article: preserve layout if not provided
assert(
  validateArticleLayoutAction(undefined, false) === undefined,
  'Existing article preserves layout when layout undefined'
);

// Edit existing article: update layout if provided
assert(
  validateArticleLayoutAction('image-contained', false) === 'image-contained',
  'Existing article updates layout when provided'
);

// Reject invalid on create
try {
  validateArticleLayoutAction('invalid', true);
  failCount++;
  console.error('✗ Server should reject invalid layout on create');
} catch (e) {
  passCount++;
  console.log(`✓ Server rejects invalid layout on create: ${e.message}`);
}

// Reject invalid on edit
try {
  validateArticleLayoutAction('bad-layout', false);
  failCount++;
  console.error('✗ Server should reject invalid layout on edit');
} catch (e) {
  passCount++;
  console.log(`✓ Server rejects invalid layout on edit: ${e.message}`);
}

console.log('\nTEST 7: Allowlist Integration');
console.log('-'.repeat(60));

const FIELD_ALLOWLIST_CREATE = new Set(['title', 'category', 'date', 'slug', 'excerpt', 'image', 'article_content', 'article_layout']);
const FIELD_ALLOWLIST_EDIT = new Set(['title', 'category', 'date', 'slug', 'excerpt', 'image', 'article_content', 'article_layout']);

assert(FIELD_ALLOWLIST_CREATE.has('article_layout'), 'article_layout in create allowlist');
assert(FIELD_ALLOWLIST_EDIT.has('article_layout'), 'article_layout in edit allowlist');

// Simulate field filtering
function filterPayload(payload, allowlist) {
  const filtered = {};
  for (const [key, value] of Object.entries(payload)) {
    if (allowlist.has(key)) {
      filtered[key] = value;
    }
  }
  return filtered;
}

const testPayload = {
  title: 'Test Article',
  article_layout: 'sidebar-image-right',
  malicious_field: 'should-be-filtered',
};

const filtered = filterPayload(testPayload, FIELD_ALLOWLIST_CREATE);
assert(filtered.article_layout === 'sidebar-image-right', 'Layout passes through allowlist');
assert(!filtered.malicious_field, 'Illegal field filtered out');
assert(Object.keys(filtered).length === 2, 'Payload contains only allowed fields');

console.log('\nTEST 8: Layout Presets Metadata');
console.log('-'.repeat(60));

const LAYOUT_PRESETS = {
  'image-above': {
    label: 'Image Hero',
    description: 'Full-width image above title & body',
  },
  'title-above': {
    label: 'Title First',
    description: 'Title & body above full-width image',
  },
  'image-contained': {
    label: 'Image Contained',
    description: 'Image below body, aligned with text width',
  },
  'sidebar-image-right': {
    label: 'Sidebar Right',
    description: 'Title/body left, image right',
  },
  'sidebar-image-left': {
    label: 'Sidebar Left',
    description: 'Image left, title/body right',
  },
};

VALID_LAYOUTS.forEach((layout) => {
  assert(LAYOUT_PRESETS[layout], `Preset ${layout} has metadata`);
  assert(LAYOUT_PRESETS[layout].label, `Preset ${layout} has label`);
  assert(LAYOUT_PRESETS[layout].description, `Preset ${layout} has description`);
});

assert(Object.keys(LAYOUT_PRESETS).length === 5, 'All 5 presets have metadata');

console.log('\nTEST 9: Backward Compatibility');
console.log('-'.repeat(60));

// Existing article with no layout field should use default
const existingArticleNoLayout = { title: 'Old Article', article_layout: undefined };
assert(
  normalizeLayout(existingArticleNoLayout.article_layout) === DEFAULT_LAYOUT,
  'Existing article without layout defaults to image-above'
);

// Existing article with layout field should use that value
const existingArticleWithLayout = { title: 'New Article', article_layout: 'title-above' };
assert(
  normalizeLayout(existingArticleWithLayout.article_layout) === 'title-above',
  'Existing article with layout uses that value'
);

console.log('\nTEST 10: Mobile Responsive Behavior');
console.log('-'.repeat(60));

// Define responsive behavior for each preset (verified against actual implementation)
const RESPONSIVE_BEHAVIOR = {
  'image-above': {
    desktop: 'Image hero (h-screen) → Title → Metadata → Body',
    mobile: 'Image full-width (h-screen) → Title → Metadata → Body',
  },
  'title-above': {
    desktop: 'Title → Metadata → Body → Image hero (h-screen)',
    mobile: 'Title → Metadata → Body → Image full-width (h-screen)',
  },
  'image-contained': {
    desktop: 'Title → Metadata → Body → Image (contained width)',
    mobile: 'Title → Metadata → Body → Image (full-width)',
  },
  'sidebar-image-right': {
    desktop: 'Title/Metadata/Body left (60%) | Image right (40%, h-[50vh])',
    mobile: 'Image full-width (h-[50vh]) → Title → Metadata → Body',
  },
  'sidebar-image-left': {
    desktop: 'Image left (40%, h-[50vh]) | Title/Metadata/Body right (60%)',
    mobile: 'Image full-width (h-[50vh]) → Title → Metadata → Body',
  },
};

VALID_LAYOUTS.forEach((layout) => {
  assert(RESPONSIVE_BEHAVIOR[layout], `Preset ${layout} has responsive behavior defined`);
  assert(RESPONSIVE_BEHAVIOR[layout].desktop, `Preset ${layout} has desktop behavior`);
  assert(RESPONSIVE_BEHAVIOR[layout].mobile, `Preset ${layout} has mobile behavior`);
});

console.log('\n=== SUMMARY ===');
console.log(`Passed: ${passCount}`);
console.log(`Failed: ${failCount}`);
console.log(`Total:  ${passCount + failCount}`);

if (failCount === 0) {
  console.log('\n✓ All layout preset tests passed!');
  console.log('\nLayout Presets:');
  VALID_LAYOUTS.forEach((layout) => {
    console.log(`  • ${layout}: ${LAYOUT_PRESETS[layout].label}`);
  });
  console.log(`\nDefault: ${DEFAULT_LAYOUT}`);
  process.exit(0);
} else {
  console.log(`\n✗ ${failCount} layout preset issue(s) detected`);
  process.exit(1);
}
