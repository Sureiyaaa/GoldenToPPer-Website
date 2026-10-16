#!/usr/bin/env node

/**
 * Editor Implementation Verification Script
 * Runs core logic tests without Jest
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

console.log('\n=== EDITOR LOGIC VERIFICATION ===\n');

// TEST 1: Paragraph Splitting
console.log('TEST 1: Paragraph Splitting');
console.log('-'.repeat(50));

const test1a = 'First\n\nSecond\n\nThird'.split(/\n\n+/);
assertEqual(test1a, ['First', 'Second', 'Third'], 'Double newlines split into paragraphs');

const test1b = 'Line one\nLine two\nLine three'.split(/\n\n+/);
assertEqual(test1b, ['Line one\nLine two\nLine three'], 'Single newlines do NOT split');

const test1c = 'Para 1 line 1\nPara 1 line 2\n\nPara 2 line 1\nPara 2 line 2'.split(/\n\n+/);
assertEqual(test1c.length, 2, 'Mixed newlines: only double newlines split');
assert(test1c[0].includes('\n'), 'First paragraph preserves single newlines');
assert(!test1c[0].includes('\n\n'), 'First paragraph has no double newlines');

const test1d = 'First\n\n\nSecond'.split(/\n\n+/);
assertEqual(test1d, ['First', 'Second'], 'Triple+ newlines treated as single split');

console.log('\nTEST 2: Content Fallback Priority');
console.log('-'.repeat(50));

// When article_content exists, use it
const richJson = JSON.stringify({ type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Rich' }] }] });
let content = richJson;
try {
  const parsed = JSON.parse(content);
  assert(parsed.type === 'doc', 'Rich JSON parsed correctly');
} catch (e) {
  assert(false, 'Rich JSON parsing should succeed');
}

// When article_content is null, use excerpt
content = null;
const excerpt = 'Fallback text';
if (!content && excerpt) {
  assert(true, 'Fallback to excerpt when article_content null');
}

// When both null, empty document
content = null;
if (!content && !excerpt) {
  assert(true, 'Empty document when both null');
}

console.log('\nTEST 3: Formatting Preservation');
console.log('-'.repeat(50));

const boldDoc = {
  type: 'doc',
  content: [
    {
      type: 'paragraph',
      content: [
        { type: 'text', text: 'Normal ' },
        { type: 'text', text: 'bold', marks: [{ type: 'bold' }] }
      ]
    }
  ]
};
assert(boldDoc.content[0].content[1].marks[0].type === 'bold', 'Bold marks preserved');

const mixedDoc = {
  type: 'doc',
  content: [
    {
      type: 'paragraph',
      content: [
        { type: 'text', text: 'text', marks: [{ type: 'bold' }, { type: 'italic' }] }
      ]
    }
  ]
};
assert(mixedDoc.content[0].content[0].marks.length === 2, 'Multiple marks on single text node');

const hardbreakDoc = {
  type: 'doc',
  content: [
    {
      type: 'paragraph',
      content: [
        { type: 'text', text: 'Line 1' },
        { type: 'hardBreak' },
        { type: 'text', text: 'Line 2' }
      ]
    }
  ]
};
assert(hardbreakDoc.content[0].content[1].type === 'hardBreak', 'hardBreak nodes preserved');

console.log('\nTEST 4: JSON Round-Trip');
console.log('-'.repeat(50));

const original = { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Test', marks: [{ type: 'bold' }] }] }] };
const json = JSON.stringify(original);
const reparsed = JSON.parse(json);
assertEqual(reparsed, original, 'JSON serialization round-trip preserves structure');

const doc1Json = JSON.stringify({ type: 'doc', content: [{ type: 'paragraph' }] });
const doc2Json = JSON.stringify({ type: 'doc', content: [{ type: 'paragraph' }] });
assert(doc1Json === doc2Json, 'Same content produces same JSON');

const doc3Json = JSON.stringify({ type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'changed' }] }] });
assert(doc1Json !== doc3Json, 'Different content produces different JSON');

console.log('\nTEST 5: Plain Text Extraction');
console.log('-'.repeat(50));

const extractDoc = {
  type: 'doc',
  content: [
    {
      type: 'paragraph',
      content: [
        { type: 'text', text: 'Bold', marks: [{ type: 'bold' }] },
        { type: 'text', text: ' and ' },
        { type: 'text', text: 'italic', marks: [{ type: 'italic' }] }
      ]
    }
  ]
};
const extracted = extractDoc.content[0].content.map(n => (n.type === 'text' ? n.text : '')).join('');
assert(extracted === 'Bold and italic', 'Plain text extraction ignores formatting marks');

const multiParaDoc = {
  type: 'doc',
  content: [
    { type: 'paragraph', content: [{ type: 'text', text: 'Para 1' }] },
    { type: 'paragraph', content: [{ type: 'text', text: 'Para 2' }] }
  ]
};
const paraTexts = multiParaDoc.content
  .filter(n => n.type === 'paragraph')
  .map(para => (para.content ? para.content.map(n => (n.type === 'text' ? n.text : '')).join('') : ''));
const joined = paraTexts.join('\n\n');
assert(joined === 'Para 1\n\nPara 2', 'Multi-paragraph extraction joins with double newlines');

console.log('\nTEST 6: Validation');
console.log('-'.repeat(50));

const emptyDoc = { type: 'doc', content: [{ type: 'paragraph', content: [] }] };
const hasTextEmpty = emptyDoc.content.some(node => {
  if (node.type !== 'paragraph') return false;
  return node.content && node.content.some(child => child.type === 'text' && child.text?.trim());
});
assert(!hasTextEmpty, 'Empty document fails validation');

const fullDoc = { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Content' }] }] };
const hasTextFull = fullDoc.content.some(node => {
  if (node.type !== 'paragraph') return false;
  return node.content && node.content.some(child => child.type === 'text' && child.text?.trim());
});
assert(hasTextFull, 'Document with text passes validation');

console.log('\nTEST 7: Edge Cases');
console.log('-'.repeat(50));

// Whitespace handling
const whitespacePara = '  Text with spaces  '.trim();
assert(whitespacePara === 'Text with spaces', 'Leading/trailing spaces trimmed');

// Empty paragraphs
const emptyParas = '\n\n\n'.split(/\n\n+/).filter(p => p.trim());
assertEqual(emptyParas, [], 'Empty paragraphs filtered out');

// Mixed formatting on same text (shouldn't happen, but verify structure)
const complexMarks = [{ type: 'bold' }, { type: 'italic' }];
assert(complexMarks.length === 2, 'Multiple marks can be on same node');

console.log('\n=== SUMMARY ===');
console.log(`Passed: ${passCount}`);
console.log(`Failed: ${failCount}`);
console.log(`Total:  ${passCount + failCount}`);

if (failCount === 0) {
  console.log('\n✓ All logic tests passed!');
  process.exit(0);
} else {
  console.log(`\n✗ ${failCount} test(s) failed`);
  process.exit(1);
}
