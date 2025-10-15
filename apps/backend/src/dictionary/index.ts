import fs from 'fs';
import path from 'path';

import { getLogger } from '../logging/context';

export interface DictionaryPort {
  isValid(word: string): boolean;
  getRandomFragment(minWordsPerPrompt: number): string;
}

let dictionary = new Set<string>();
let fragmentCounts = new Map<string, number>();
let usingFallbackDictionary = false;

// Minimal built-in fallback to keep tests and dev environment working when
// the local words.txt is not present (CI doesn't commit the large dictionary).
// Keep this list tiny and all lowercase.
const DEFAULT_WORDS: string[] = [
  'aa',
  'aah',
  'ab',
  'aba',
  'able',
  'about',
  'above',
  'act',
  'action',
  'active',
  'add',
  'age',
  'ago',
  'agree',
  'air',
  'aim',
  'all',
  'alone',
  'also',
  'always',
  'amazing',
  'amount',
];

/**
 * Loads the dictionary into memory from a local file.
 * Also builds the fragment count index for fast lookup.
 */
export function loadDictionary() {
  const isProd = process.env.NODE_ENV === 'production';
  const isTest = process.env.NODE_ENV === 'test';
  const localPath = path.resolve(__dirname, './words.txt');
  const prodPath = '/tmp/words.txt';
  const filePath = isProd ? prodPath : localPath;
  const log = getLogger();

  // Fast path for tests: avoid reading the huge words.txt to keep CI quick and deterministic.
  // Set DICTIONARY_TEST_MODE=full to force reading the local file during tests when desired.
  if (isTest && process.env.DICTIONARY_TEST_MODE !== 'full') {
    dictionary = new Set(DEFAULT_WORDS);
    buildFragmentIndex(DEFAULT_WORDS);
    usingFallbackDictionary = true;
    log.info(
      {
        event: 'dictionary_using_fallback',
        reason: 'test_fast_path',
        wordCount: dictionary.size,
      },
      `Using built-in fallback dictionary with ${dictionary.size.toString()} words (test fast path)`,
    );
    return;
  }

  try {
    const raw = fs.readFileSync(filePath, 'utf-8');
    let words = raw.split('\n').filter(Boolean);
    const before = words.length;
    // Enforce maximum word length of 30 characters (game input cap is 30)
    words = words.filter((w) => w.length <= 30);
    const removed = before - words.length;
    if (removed > 0) {
      log.warn(
        {
          event: 'dictionary_filtered_overlength',
          removed,
          maxLength: 30,
        },
        `Filtered ${removed.toString()} over-length words (>30 chars)`,
      );
    }
    dictionary = new Set(words);
    usingFallbackDictionary = false;
    log.info(
      {
        event: 'dictionary_loaded_from_file',
        wordCount: dictionary.size,
        maxLength: 30,
        source: filePath,
      },
      `Loaded ${dictionary.size.toString()} words (max length 30)`,
    );

    buildFragmentIndex(words);
  } catch (err) {
    log.error(
      { event: 'dictionary_load_failed', err, source: filePath },
      `Failed to load dictionary from ${filePath}`,
    );
    if (!isProd) {
      // Fallback to a tiny built-in dictionary for dev/test so CI remains deterministic.
      dictionary = new Set(DEFAULT_WORDS);
      buildFragmentIndex(DEFAULT_WORDS);
      usingFallbackDictionary = true;
      log.info(
        {
          event: 'dictionary_using_fallback',
          reason: 'load_failed',
          wordCount: dictionary.size,
        },
        `Using built-in fallback dictionary with ${dictionary.size.toString()} words`,
      );
    }
  }
}

export function createDictionaryPort(): DictionaryPort {
  return {
    isValid: (word: string) => isValidWord(word),
    getRandomFragment: (minWordsPerPrompt: number) =>
      getRandomFragment(minWordsPerPrompt),
  };
}

/**
 * Builds the fragment count index from the provided list of words.
 */
function buildFragmentIndex(
  words: string[],
  minLength = 2,
  maxLength = 3,
): void {
  fragmentCounts = new Map();

  for (const word of words) {
    for (let len = minLength; len <= maxLength; len++) {
      if (word.length < len) continue;
      for (let i = 0; i <= word.length - len; i++) {
        const frag = word.slice(i, i + len);
        fragmentCounts.set(frag, (fragmentCounts.get(frag) ?? 0) + 1);
      }
    }
  }

  getLogger().info(
    {
      event: 'dictionary_indexed_fragments',
      fragmentCount: fragmentCounts.size,
      minLength,
      maxLength,
    },
    `Indexed ${fragmentCounts.size.toString()} unique fragments`,
  );
}

/**
 * Checks if a word is valid.
 */
export function isValidWord(word: string): boolean {
  return dictionary.has(word.toLowerCase());
}

/**
 * Generates a random word fragment from the precomputed fragmentCounts map
 * that has at least `minWordsPerPrompt` matches in the dictionary.
 */
export function getRandomFragment(minWordsPerPrompt: number): string {
  const candidates = Array.from(fragmentCounts.entries())
    .filter(([, count]) => count >= minWordsPerPrompt)
    .map(([fragment]) => fragment);

  if (candidates.length === 0) {
    // In test environment, fall back to a deterministic fragment so integration
    // tests can proceed without a fully populated dictionary.
    if (process.env.NODE_ENV === 'test') {
      return 'aa';
    }

    const fallback = Array.from(fragmentCounts.entries()).sort(
      (a, b) => b[1] - a[1],
    )[0]?.[0];

    if (fallback) {
      getLogger().warn(
        {
          event: 'dictionary_fragment_fallback',
          minWordsPerPrompt,
          fallback,
        },
        `No fragments meet minWordsPerPrompt=${minWordsPerPrompt.toString()}; using '${fallback}' instead`,
      );
      return fallback;
    }

    throw new Error(
      `No fragments available to satisfy minWordsPerPrompt=${minWordsPerPrompt.toString()}`,
    );
  }

  return candidates[Math.floor(Math.random() * candidates.length)];
}

/**
 * Exposes basic dictionary statistics for health/readiness endpoints.
 */
export function getDictionaryStats(): {
  wordCount: number;
  fragmentCount: number;
} {
  return {
    wordCount: dictionary.size,
    fragmentCount: fragmentCounts.size,
  };
}

export function isUsingFallbackDictionary(): boolean {
  return usingFallbackDictionary;
}
