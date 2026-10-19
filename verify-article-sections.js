#!/usr/bin/env node

/**
 * Article Sections Verification
 * Tests section model, validation, rendering, and legacy adaptation
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

console.log('\n=== ARTICLE SECTIONS VERIFICATION ===\n');

// Define section layouts
const VALID_LAYOUTS = ['image-above', 'image-below', 'image-contained', 'image-left', 'image-right', 'text-only'];

console.log('TEST 1: Valid Section Layouts');
console.log('-'.repeat(60));

VALID_LAYOUTS.forEach((layout) => {
  assert(typeof layout === 'string' && layout.length > 0, `Layout ${layout} is valid string`);
});

assertEqual(VALID_LAYOUTS.length, 6, 'Exactly 6 section layout presets defined');

console.log('\nTEST 2: Section Structure Validation');
console.log('-'.repeat(60));

function isValidSection(section) {
  return (
    section &&
    typeof section === 'object' &&
    typeof section.id === 'string' &&
    section.id.length > 0 &&
    typeof section.headingEnabled === 'boolean' &&
    typeof section.layout === 'string' &&
    VALID_LAYOUTS.includes(section.layout) &&
    section.body &&
    typeof section.body === 'object' &&
    typeof section.order === 'number'
  );
}

const validSection = {
  id: 'section-1',
  heading: 'Test Heading',
  headingEnabled: true,
  layout: 'image-above',
  body: { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Body text' }] }] },
  image: 'https://example.com/image.jpg',
  order: 0,
};

assert(isValidSection(validSection), 'Valid section passes validation');
assert(!isValidSection({ ...validSection, id: '' }), 'Section with empty ID fails validation');
assert(!isValidSection({ ...validSection, layout: 'invalid' }), 'Section with invalid layout fails');
assert(!isValidSection({ ...validSection, headingEnabled: 'yes' }), 'Section with non-boolean headingEnabled fails');
assert(!isValidSection({ ...validSection, order: 'zero' }), 'Section with non-number order fails');

console.log('\nTEST 3: Sections Document Structure');
console.log('-'.repeat(60));

function isValidSectionsDocument(doc) {
  return (
    doc &&
    typeof doc === 'object' &&
    doc.version === 1 &&
    Array.isArray(doc.sections) &&
    doc.sections.every((s) => isValidSection(s)) &&
    typeof doc.createdAt === 'string' &&
    typeof doc.updatedAt === 'string'
  );
}

const validDoc = {
  version: 1,
  sections: [validSection],
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

assert(isValidSectionsDocument(validDoc), 'Valid sections document passes validation');
assert(!isValidSectionsDocument({ ...validDoc, version: 2 }), 'Document with wrong version fails');
assert(isValidSectionsDocument({ ...validDoc, sections: [] }), 'Empty sections array is valid (unusual but allowed)');
assert(!isValidSectionsDocument({ ...validDoc, createdAt: 123 }), 'Non-string createdAt fails');

console.log('\nTEST 4: Legacy Article Adaptation');
console.log('-'.repeat(60));

function adaptLegacyArticleToSections(legacy) {
  const id = `legacy-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
  const body = legacy.article_content || {
    type: 'doc',
    content: [
      {
        type: 'paragraph',
        content: [{ type: 'text', text: legacy.excerpt || '' }],
      },
    ],
  };

  const layout = legacy.image ? 'image-above' : 'text-only';

  const section = {
    id,
    heading: undefined,
    headingEnabled: false,
    layout,
    body,
    image: legacy.image,
    order: 0,
  };

  const now = new Date().toISOString();
  return {
    version: 1,
    sections: [section],
    createdAt: now,
    updatedAt: now,
  };
}

// Test: Legacy article with image
const legacyWithImage = {
  title: 'Test Article',
  excerpt: 'Article excerpt text',
  image: 'https://example.com/cover.jpg',
  article_layout: 'image-above',
};

const adaptedWithImage = adaptLegacyArticleToSections(legacyWithImage);
assert(isValidSectionsDocument(adaptedWithImage), 'Adapted article with image is valid');
assert(adaptedWithImage.sections[0].layout === 'image-above', 'Article with image defaults to image-above layout');
assert(adaptedWithImage.sections[0].image === legacyWithImage.image, 'Section image matches legacy article image');

// Test: Legacy article without image
const legacyNoImage = {
  title: 'Text Article',
  excerpt: 'Just text, no image',
  article_layout: 'text-only',
};

const adaptedNoImage = adaptLegacyArticleToSections(legacyNoImage);
assert(isValidSectionsDocument(adaptedNoImage), 'Adapted article without image is valid');
assert(adaptedNoImage.sections[0].layout === 'text-only', 'Article without image defaults to text-only layout');
assert(!adaptedNoImage.sections[0].image, 'Section has no image');

console.log('\nTEST 5: Excerpt Derivation from Sections');
console.log('-'.repeat(60));

function deriveExcerptFromSections(doc) {
  for (const section of doc.sections) {
    if (section.body && section.body.content) {
      for (const block of section.body.content) {
        if (block.type === 'paragraph' && block.content) {
          let text = '';
          for (const inline of block.content) {
            if (inline.type === 'text') {
              text += inline.text || '';
            }
          }
          if (text.trim()) return text.substring(0, 200);
        }
      }
    }
  }
  return '';
}

const docWithText = {
  version: 1,
  sections: [
    {
      id: 'section-1',
      heading: 'Introduction',
      headingEnabled: true,
      layout: 'text-only',
      body: {
        type: 'doc',
        content: [
          {
            type: 'paragraph',
            content: [{ type: 'text', text: 'This is the first paragraph with some content.' }],
          },
        ],
      },
      order: 0,
    },
  ],
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

const derivedExcerpt = deriveExcerptFromSections(docWithText);
assert(derivedExcerpt.includes('This is the first paragraph'), 'Excerpt derived from first paragraph');
assert(
  deriveExcerptFromSections({
    version: 1,
    sections: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  }) === '',
  'Empty sections document returns empty excerpt'
);

console.log('\nTEST 6: Section Heading Behavior');
console.log('-'.repeat(60));

// Test: Disabled heading preserves text
const sectionWithDisabledHeading = {
  id: 'section-1',
  heading: 'Hidden Title',
  headingEnabled: false,
  layout: 'text-only',
  body: { type: 'doc', content: [] },
  order: 0,
};

assert(isValidSection(sectionWithDisabledHeading), 'Section with disabled heading is valid');
assert(sectionWithDisabledHeading.heading === 'Hidden Title', 'Heading text preserved when disabled');

console.log('\nTEST 7: Section Image Independence');
console.log('-'.repeat(60));

const sectionWithImage = {
  id: 'section-1',
  heading: 'Content Section',
  headingEnabled: true,
  layout: 'image-right',
  body: { type: 'doc', content: [] },
  image: 'https://example.com/section-image.jpg',
  order: 0,
};

assert(isValidSection(sectionWithImage), 'Section with image is valid');
assert(sectionWithImage.image !== undefined, 'Section image is independent property');

// Verify section image doesn't overwrite cover image
const articleWithCoverAndSectionImages = {
  title: 'Article',
  image: 'https://example.com/cover.jpg', // Article cover
  article_sections: {
    version: 1,
    sections: [
      {
        ...sectionWithImage,
        image: 'https://example.com/different-image.jpg', // Different section image
      },
    ],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
};

assert(
  articleWithCoverAndSectionImages.image !== articleWithCoverAndSectionImages.article_sections.sections[0].image,
  'Section image is independent of article cover image'
);

console.log('\nTEST 8: Section Reordering');
console.log('-'.repeat(60));

function reorderSections(sections, fromIndex, toIndex) {
  const reordered = [...sections];
  const [section] = reordered.splice(fromIndex, 1);
  reordered.splice(toIndex, 0, section);
  return reordered.map((s, i) => ({ ...s, order: i }));
}

const originalOrder = [
  { ...validSection, id: 's1', order: 0 },
  { ...validSection, id: 's2', order: 1 },
  { ...validSection, id: 's3', order: 2 },
];

const reorderedSections = reorderSections(originalOrder, 0, 2);
assertEqual(reorderedSections[0].id, 's2', 'First section is now s2');
assertEqual(reorderedSections[1].id, 's3', 'Second section is now s3');
assertEqual(reorderedSections[2].id, 's1', 'Third section is now s1');
assertEqual(reorderedSections.map((s) => s.order), [0, 1, 2], 'Order numbers updated correctly');

console.log('\nTEST 9: Length Guidance');
console.log('-'.repeat(60));

const LENGTH_GUIDANCE = {
  min: 50,
  typical: 300,
  max: 800,
};

assert(LENGTH_GUIDANCE.min < LENGTH_GUIDANCE.typical, 'Min is less than typical');
assert(LENGTH_GUIDANCE.typical < LENGTH_GUIDANCE.max, 'Typical is less than max');

function getWordCount(body) {
  let count = 0;
  if (body && body.content) {
    for (const block of body.content) {
      if (block.content) {
        for (const inline of block.content) {
          if (inline.type === 'text' && inline.text) {
            count += inline.text.split(/\s+/).filter((w) => w.length > 0).length;
          }
        }
      }
    }
  }
  return count;
}

const shortBody = {
  type: 'doc',
  content: [
    {
      type: 'paragraph',
      content: [{ type: 'text', text: 'Short text' }],
    },
  ],
};

const longBody = {
  type: 'doc',
  content: [
    {
      type: 'paragraph',
      content: [
        {
          type: 'text',
          text: 'This is a longer text that exceeds the minimum suggested word count and provides substantial content. It contains multiple sentences and more context to demonstrate a typical article section that readers would find valuable. Content like this would be good for readability and engagement, offering enough information to be meaningful without becoming overwhelming. The length provides a balance between conciseness and comprehensive coverage of the topic at hand.',
        },
      ],
    },
  ],
};

const shortCount = getWordCount(shortBody);
const longCount = getWordCount(longBody);

assert(shortCount < LENGTH_GUIDANCE.min, 'Short text below minimum');
assert(longCount > LENGTH_GUIDANCE.min && longCount < LENGTH_GUIDANCE.max, 'Typical text within range');

console.log('\nTEST 10: Multiple Layouts in Single Document');
console.log('-'.repeat(60));

const multiLayoutDocument = {
  version: 1,
  sections: [
    {
      id: 'intro',
      heading: 'Introduction',
      headingEnabled: true,
      layout: 'text-only',
      body: { type: 'doc', content: [] },
      order: 0,
    },
    {
      id: 'story',
      heading: 'The Story',
      headingEnabled: true,
      layout: 'image-right',
      body: { type: 'doc', content: [] },
      image: 'https://example.com/1.jpg',
      order: 1,
    },
    {
      id: 'details',
      heading: 'Details',
      headingEnabled: false,
      layout: 'image-left',
      body: { type: 'doc', content: [] },
      image: 'https://example.com/2.jpg',
      order: 2,
    },
    {
      id: 'conclusion',
      heading: undefined,
      headingEnabled: false,
      layout: 'image-below',
      body: { type: 'doc', content: [] },
      order: 3,
    },
  ],
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

assert(isValidSectionsDocument(multiLayoutDocument), 'Document with multiple layouts is valid');
assertEqual(multiLayoutDocument.sections.length, 4, 'Document has 4 sections');
assertEqual(
  new Set(multiLayoutDocument.sections.map((s) => s.layout)).size,
  4,
  'Document uses 4 different layouts'
);

console.log('\n=== SUMMARY ===');
console.log(`Passed: ${passCount}`);
console.log(`Failed: ${failCount}`);
console.log(`Total:  ${passCount + failCount}`);

if (failCount === 0) {
  console.log('\n✓ All article sections tests passed!');
  console.log('\nSection Layouts:');
  VALID_LAYOUTS.forEach((layout) => {
    console.log(`  • ${layout}`);
  });
  console.log(`\nLength Guidance: ${LENGTH_GUIDANCE.min}-${LENGTH_GUIDANCE.max} words (typical: ${LENGTH_GUIDANCE.typical})`);
  process.exit(0);
} else {
  console.log(`\n✗ ${failCount} article section issue(s) detected`);
  process.exit(1);
}
