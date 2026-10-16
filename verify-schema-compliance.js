#!/usr/bin/env node

/**
 * Tiptap/ProseMirror Schema Compliance Verification
 *
 * Verifies generated documents conform to the editor's schema:
 * - Paragraphs with empty content: []
 * - Text nodes only contain non-empty text
 * - No empty text nodes { type: 'text', text: '' }
 * - hardBreak nodes in paragraphs
 * - Mark structure on text nodes
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

console.log('\n=== TIPTAP SCHEMA COMPLIANCE ===\n');

// Helper: Validate document against schema
function validateSchema(doc) {
  const errors = [];

  if (!doc || doc.type !== 'doc') {
    errors.push('Document must have type: "doc"');
  }

  if (!Array.isArray(doc.content)) {
    errors.push('Document content must be array');
    return errors;
  }

  doc.content.forEach((node, idx) => {
    // Only paragraphs allowed at top level
    if (node.type !== 'paragraph') {
      errors.push(`Node ${idx}: only paragraphs allowed at top level, got ${node.type}`);
      return;
    }

    // Paragraph content must be array (can be empty)
    if (!Array.isArray(node.content)) {
      errors.push(`Node ${idx}: paragraph content must be array`);
      return;
    }

    // Each child node validation
    node.content.forEach((child, cidx) => {
      if (child.type === 'text') {
        // Text nodes must have text property
        if (typeof child.text !== 'string') {
          errors.push(`Node ${idx}[${cidx}]: text node missing text property`);
        }
        // Text must not be empty (schema rule)
        if (child.text === '') {
          errors.push(`Node ${idx}[${cidx}]: empty text node { type: 'text', text: '' } not allowed`);
        }
        // Note: Text spacing is preserved in rich content for proper rendering
        // Tiptap may intentionally have spaces for word separation across nodes
        // We do NOT enforce trimming for rich content
        // Marks array optional but if present, must be array
        if (child.marks && !Array.isArray(child.marks)) {
          errors.push(`Node ${idx}[${cidx}]: marks must be array if present`);
        }
      } else if (child.type === 'hardBreak') {
        // hardBreak valid in paragraphs
      } else {
        errors.push(`Node ${idx}[${cidx}]: unknown node type "${child.type}"`);
      }
    });
  });

  return errors;
}

console.log('TEST 1: Whitespace-Only Paragraph Handling');
console.log('-'.repeat(60));

// Input: "First\n   \nSecond" (middle paragraph is only spaces)
const input1 = 'First\n   \nSecond';
const paragraphs1 = input1
  .split(/\n+/)
  .filter(Boolean)
  .map((text) => ({
    type: 'paragraph',
    content: text.trim()
      ? [{ type: 'text', text: text.trim() }]
      : [],
  }));

const doc1 = { type: 'doc', content: paragraphs1 };

console.log(`Input: ${JSON.stringify(input1)}`);
console.log(`Result: ${JSON.stringify(doc1.content)}`);
console.log(`Paragraph count: ${paragraphs1.length}`);

// Note: filter(Boolean) only removes truly empty strings ('')
// Whitespace-only strings like '   ' are truthy and pass through
// They become paragraphs with content: [] after trim check
assertEqual(
  paragraphs1.length,
  3,
  'Three segments from split: "First", "   ", "Second"'
);
assert(
  doc1.content[0].content.length > 0,
  'First paragraph has text content'
);
assert(
  doc1.content[1].content.length === 0,
  'Middle paragraph is empty (content: []) because "   " trims to ""'
);
assert(
  doc1.content[2].content.length > 0,
  'Third paragraph has text content'
);

const errors1 = validateSchema(doc1);
assertEqual(errors1, [], `Schema valid (${errors1.length} errors)`);

console.log('\nTEST 2: Empty Paragraph Detection');
console.log('-'.repeat(60));

// Simulate a case where we'd generate empty paragraphs
const input2 = 'Text\n\n\n   \n\nMore';
const split2 = input2.split(/\n+/).filter(Boolean);
console.log(`Input: ${JSON.stringify(input2)}`);
console.log(`After split: ${JSON.stringify(split2)}`);

const paragraphs2 = split2.map((text) => ({
  type: 'paragraph',
  content: text.trim()
    ? [{ type: 'text', text: text.trim() }]
    : [],
}));

const doc2 = { type: 'doc', content: paragraphs2 };

// split(/\n+/) produces: ['Text', '   ', 'More']
// All pass filter(Boolean), all become paragraphs
// Whitespace-only segment becomes content: []
assertEqual(
  paragraphs2.length,
  3,
  'Split produces 3 segments; whitespace-only segment becomes empty paragraph'
);
const realContent2 = paragraphs2.filter((p) => p.content.length > 0);
assertEqual(realContent2.length, 2, 'Only 2 paragraphs have real content');

const errors2 = validateSchema(doc2);
assertEqual(errors2, [], `Schema valid after whitespace collapse (${errors2.length} errors)`);

console.log('\nTEST 3: No Empty Text Nodes Generated');
console.log('-'.repeat(60));

const testCases = [
  'Text',
  'Line 1\nLine 2',
  'First\n   \nSecond',
  '  Trim me  ',
];

for (const input of testCases) {
  const paras = input
    .split(/\n+/)
    .filter(Boolean)
    .map((text) => ({
      type: 'paragraph',
      content: text.trim()
        ? [{ type: 'text', text: text.trim() }]
        : [],
    }));

  const doc = { type: 'doc', content: paras };
  const errors = validateSchema(doc);

  // Check no empty text nodes
  let hasEmptyTextNode = false;
  doc.content.forEach((para) => {
    para.content.forEach((node) => {
      if (node.type === 'text' && node.text === '') {
        hasEmptyTextNode = true;
      }
    });
  });

  assert(!hasEmptyTextNode, `No empty text nodes in: ${JSON.stringify(input)}`);
  assert(
    errors.length === 0,
    `Schema valid for: ${JSON.stringify(input)}`
  );
}

console.log('\nTEST 4: Conditional Content Construction');
console.log('-'.repeat(60));

// Verify the conditional works correctly
const conditionalTest = '  \nText\n  \nMore  \n  ';

const paras4 = conditionalTest
  .split(/\n+/)
  .filter(Boolean)
  .map((text) => ({
    type: 'paragraph',
    content: text.trim()
      ? [{ type: 'text', text: text.trim() }]
      : [],
  }));

// After split, segments are: ['', 'Text', '', 'More', '']
// After filter: ['Text', 'More'] (filter(Boolean) removes empty strings)
// Wait, filter(Boolean) removes empty strings from the split, not trim checks

// Let me reconsider: split(/\n+/) on '  \nText\n  \nMore  \n  '
// Results in: ['  ', 'Text', '  ', 'More  ', '  ']
// Then filter(Boolean) keeps all (none are empty string)
// Then map applies conditional trim check

const doc4 = { type: 'doc', content: paras4 };
console.log(`Input: ${JSON.stringify(conditionalTest)}`);
console.log(`Paragraphs: ${JSON.stringify(doc4.content)}`);

// Should have 2 real paragraphs (Text and More) with content
// Whitespace-only segments should have content: []
const realContent = doc4.content.filter((p) => p.content.length > 0);
assertEqual(realContent.length, 2, 'Only 2 paragraphs have real content');

const errors4 = validateSchema(doc4);
assertEqual(errors4, [], `Schema valid with conditional construction (${errors4.length} errors)`);

console.log('\nTEST 5: Rich Content Marks Preserved');
console.log('-'.repeat(60));

const richWithMarks = {
  type: 'doc',
  content: [
    {
      type: 'paragraph',
      content: [
        { type: 'text', text: 'Bold', marks: [{ type: 'bold' }] },
        { type: 'text', text: ' normal' }, // Space before, no trailing
        { type: 'text', text: ' italic', marks: [{ type: 'italic' }] }, // Space before
      ],
    },
  ],
};

const errors5 = validateSchema(richWithMarks);
assertEqual(errors5, [], 'Rich content with marks is schema valid');

// Verify no empty text nodes
let hasEmpty5 = false;
richWithMarks.content[0].content.forEach((node) => {
  if (node.type === 'text' && node.text === '') {
    hasEmpty5 = true;
  }
});
assert(!hasEmpty5, 'Rich content: no empty text nodes');

console.log('\nTEST 6: hardBreak Nodes');
console.log('-'.repeat(60));

const docWithBreak = {
  type: 'doc',
  content: [
    {
      type: 'paragraph',
      content: [
        { type: 'text', text: 'Line 1' },
        { type: 'hardBreak' },
        { type: 'text', text: 'Line 2' },
      ],
    },
  ],
};

const errors6 = validateSchema(docWithBreak);
assertEqual(errors6, [], 'Document with hardBreak is schema valid');
assert(
  docWithBreak.content[0].content[1].type === 'hardBreak',
  'hardBreak node preserved'
);

console.log('\nTEST 7: Empty Document Edge Case');
console.log('-'.repeat(60));

// All whitespace input
const allWhitespace = '   \n\n   ';
const parasEmpty = allWhitespace
  .split(/\n+/)
  .filter(Boolean)
  .map((text) => ({
    type: 'paragraph',
    content: text.trim()
      ? [{ type: 'text', text: text.trim() }]
      : [],
  }));

// After filter(Boolean), this might be empty or have whitespace-only segments
console.log(`All-whitespace input: ${JSON.stringify(allWhitespace)}`);
console.log(`After split: ${JSON.stringify(allWhitespace.split(/\n+/))}`);

const docEmpty = {
  type: 'doc',
  content: parasEmpty.length > 0 ? parasEmpty : [{ type: 'paragraph' }],
};

const errors7 = validateSchema(docEmpty);
assertEqual(errors7, [], 'Empty input results in valid document');

console.log('\n=== SUMMARY ===');
console.log(`Passed: ${passCount}`);
console.log(`Failed: ${failCount}`);
console.log(`Total:  ${passCount + failCount}`);

if (failCount === 0) {
  console.log('\n✓ All schema compliance tests passed!');
  console.log('\nKey Validations:');
  console.log('  ✓ No empty text nodes generated');
  console.log('  ✓ Whitespace-only segments handled correctly');
  console.log('  ✓ Conditional content: [] for whitespace, [text] for content');
  console.log('  ✓ Rich content marks preserved');
  console.log('  ✓ hardBreak nodes supported');
  console.log('  ✓ All documents conform to Tiptap schema');
  process.exit(0);
} else {
  console.log(`\n✗ ${failCount} schema compliance issue(s) detected`);
  process.exit(1);
}
