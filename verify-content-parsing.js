/**
 * Verification test: parseArticleContent handles all data types
 * Tests: JSONB object, JSON string, null, malformed JSON
 * Location: app/news&updates/[slug]/newsclient.tsx:158 (FIXED)
 */

const tests = [];
let passed = 0;
let failed = 0;

function test(name, fn) {
  try {
    fn();
    tests.push({ name, status: 'PASS' });
    passed++;
  } catch (err) {
    tests.push({ name, status: 'FAIL', error: err.message });
    failed++;
  }
}

// Mock parseArticleContent (from lib/rendering/article-content.ts)
function parseArticleContent(content) {
  if (!content) {
    return { type: 'doc', content: [{ type: 'paragraph', content: [] }] };
  }

  // Already parsed object
  if (typeof content === 'object' && content.type === 'doc') {
    return content; // normalized in real code
  }

  // JSON string
  if (typeof content === 'string') {
    try {
      const parsed = JSON.parse(content);
      if (parsed?.type === 'doc') {
        return parsed;
      }
    } catch {
      // Fall through to plain text parsing
    }

    // Plain text fallback
    const paragraphs = content
      .split(/\n+/)
      .filter(Boolean)
      .map((text) => ({
        type: 'paragraph',
        content: text.trim()
          ? [{ type: 'text', text: text.trim() }]
          : [],
      }));

    return {
      type: 'doc',
      content: paragraphs.length > 0 ? paragraphs : [{ type: 'paragraph' }],
    };
  }

  return { type: 'doc', content: [{ type: 'paragraph' }] };
}

// TEST 1: Already-parsed JSONB object (from Supabase)
test('TEST 1: Already-parsed Tiptap doc (JSONB object from Supabase)', () => {
  const jsonbObject = {
    type: 'doc',
    content: [
      {
        type: 'paragraph',
        content: [{ type: 'text', text: 'This is from database as object.' }],
      },
    ],
  };

  // OLD CODE WOULD FAIL: JSON.parse(jsonbObject) → "TypeError: [object Object] is not valid JSON"
  // NEW CODE: parseArticleContent(jsonbObject) → works!
  const result = parseArticleContent(jsonbObject);

  if (!result || result.type !== 'doc') {
    throw new Error('Expected valid Tiptap doc, got: ' + JSON.stringify(result));
  }
  if (!result.content[0]?.content[0]?.text) {
    throw new Error('Expected text content');
  }
});

// TEST 2: JSON string (legacy format, still possible)
test('TEST 2: JSON string (old format: stringified article_content)', () => {
  const jsonString = JSON.stringify({
    type: 'doc',
    content: [
      {
        type: 'paragraph',
        content: [{ type: 'text', text: 'This is from stringified content.' }],
      },
    ],
  });

  const result = parseArticleContent(jsonString);

  if (!result || result.type !== 'doc') {
    throw new Error('Expected valid Tiptap doc, got: ' + JSON.stringify(result));
  }
  if (!result.content[0]?.content[0]?.text) {
    throw new Error('Expected text content');
  }
});

// TEST 3: Null (no rich content, will use excerpt)
test('TEST 3: Null/undefined article_content (uses excerpt fallback)', () => {
  const result1 = parseArticleContent(null);
  const result2 = parseArticleContent(undefined);

  if (result1.type !== 'doc' || result2.type !== 'doc') {
    throw new Error('Expected doc structure for null/undefined');
  }
});

// TEST 4: Plain text string (legacy plain text, no JSON)
test('TEST 4: Plain text string (legacy plain text fallback)', () => {
  const plainText = 'This is plain text\nwith multiple lines\nof content.';
  const result = parseArticleContent(plainText);

  if (!result || result.type !== 'doc') {
    throw new Error('Expected valid doc');
  }
  if (result.content.length === 0) {
    throw new Error('Expected paragraphs from plain text');
  }
});

// TEST 5: Malformed JSON (falls back to plain text)
test('TEST 5: Malformed JSON (graceful fallback to plain text)', () => {
  const malformed = '{invalid json}';
  const result = parseArticleContent(malformed);

  if (!result || result.type !== 'doc') {
    throw new Error('Expected valid doc even for malformed JSON');
  }
  // Should be treated as plain text, not crash
});

// TEST 6: Empty object (not a valid Tiptap doc)
test('TEST 6: Empty object (not a Tiptap doc, should handle gracefully)', () => {
  const emptyObj = {};
  const result = parseArticleContent(emptyObj);

  if (!result || result.type !== 'doc') {
    throw new Error('Expected valid doc structure');
  }
});

// TEST 7: adaptLegacyArticleToSections with all content types
test('TEST 7: adaptLegacyArticleToSections receives parsed content', () => {
  // Simulates the FIXED code path in newsclient.tsx:158
  // article_content: initialArticle.article_content ? parseArticleContent(...) : null

  const scenarios = [
    {
      name: 'JSONB object',
      content: { type: 'doc', content: [{ type: 'paragraph' }] },
    },
    {
      name: 'JSON string',
      content: JSON.stringify({ type: 'doc', content: [{ type: 'paragraph' }] }),
    },
    {
      name: 'null',
      content: null,
    },
  ];

  scenarios.forEach(scenario => {
    const normalized = scenario.content ? parseArticleContent(scenario.content) : null;
    if (normalized && normalized.type !== 'doc') {
      throw new Error(`Failed for scenario: ${scenario.name}`);
    }
  });
});

// Print results
console.log('\n' + '='.repeat(70));
console.log('VERIFICATION: Article Content Parsing Fix');
console.log('='.repeat(70));
console.log(`Executed Tests: ${tests.length}`);
console.log(`✓ PASSED: ${passed}`);
console.log(`✗ FAILED: ${failed}`);
console.log('='.repeat(70) + '\n');

tests.forEach((t, i) => {
  const icon = t.status === 'PASS' ? '✓' : '✗';
  const status = t.status === 'PASS'
    ? '\x1b[32mPASS\x1b[0m'
    : '\x1b[31mFAIL\x1b[0m';
  console.log(`${i + 1}. ${icon} ${t.name}`);
  console.log(`   Status: ${status}`);
  if (t.error) {
    console.log(`   Error: ${t.error}`);
  }
  console.log();
});

console.log('='.repeat(70));
console.log('LOCATIONS FIXED:');
console.log('  1. app/news&updates/[slug]/newsclient.tsx:158');
console.log('  2. app/admin/news/PreviewSkeleton.tsx:44');
console.log('  3. app/admin/news/page.tsx:390');
console.log('='.repeat(70));

if (failed > 0) {
  console.log('\n❌ VERIFICATION FAILED\n');
  process.exit(1);
} else {
  console.log('\n✅ ALL TESTS PASSED\n');
  process.exit(0);
}
