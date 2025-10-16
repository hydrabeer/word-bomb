import fs from 'fs';
import path from 'path';

import { getLogger } from '../logging/context';

/**
 * Contract for dictionary lookups and prompt generation used by the game loop.
 *
 * @public
 */
export interface DictionaryPort {
  /**
   * Tests whether the provided word exists in the active dictionary.
   *
   * @param word - Candidate word submitted by a player.
   * @returns `true` if the normalized word is part of the dictionary; otherwise `false`.
   */
  isValid(word: string): boolean;

  /**
   * Produces a fragment that yields at least the desired number of dictionary matches.
   *
   * @param minWordsPerPrompt - Desired lower bound for matching dictionary entries.
   * @returns A fragment that satisfies the constraint, potentially using a fallback when necessary.
   */
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
 * Loads the primary dictionary into process memory and prepares supporting indexes.
 *
 * @remarks
 * Chooses a dictionary source based on `NODE_ENV`, defaulting to `/tmp/words.txt` in production
 * and `./words.txt` during development. When running tests without `DICTIONARY_TEST_MODE=full`
 * the lightweight fallback dictionary keeps CI deterministic. Fallback behavior is also invoked
 * when file loading fails outside of production.
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

/**
 * Builds a `DictionaryPort` backed by module-level state and helpers.
 *
 * @returns A `DictionaryPort` instance that proxies to the local dictionary utilities.
 */
export function createDictionaryPort(): DictionaryPort {
  return {
    isValid: (word: string) => isValidWord(word),
    getRandomFragment: (minWordsPerPrompt: number) =>
      getRandomFragment(minWordsPerPrompt),
  };
}

/**
 * Populates the fragment frequency index used to support prompt generation heuristics.
 *
 * @param words - Word list from which to derive fragments.
 * @param minLength - Minimum fragment length to index, inclusive.
 * @param maxLength - Maximum fragment length to index, inclusive.
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
 * Determines whether the provided word appears in the active dictionary.
 *
 * @param word - Word to validate; casing is normalized internally.
 * @returns `true` if the word is recognized; otherwise `false`.
 */
export function isValidWord(word: string): boolean {
  return dictionary.has(word.toLowerCase());
}

/**
 * Generates a random fragment that reaches the desired match count within the dictionary.
 *
 * @param minWordsPerPrompt - Required minimum number of words that contain the fragment.
 * @returns A fragment satisfying the constraint, or a deterministic fallback during tests.
 * @throws When no qualifying fragment or fallback can be determined (non-test environments only).
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
 * Reports dictionary sizing information for health and readiness checks.
 *
 * @returns Current counts for distinct words and indexed fragments.
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

/**
 * Indicates whether the in-memory dictionary originates from the lightweight fallback list.
 *
 * @returns `true` when fallback words are active; otherwise `false`.
 */
export function isUsingFallbackDictionary(): boolean {
  return usingFallbackDictionary;
}
