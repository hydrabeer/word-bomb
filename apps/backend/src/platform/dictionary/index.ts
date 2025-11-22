import fs from 'fs';
import path from 'path';

import { getLogger } from '../logging/context';

/**
 * Defines the dictionary lookup contract and prompt‑generation API used by the game loop.
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

type Logger = ReturnType<typeof getLogger>;

/**
 * Loads the in‑memory dictionary and rebuilds supporting fragment indexes from the given words.
 *
 * @remarks
 * Mutates module‑level state: `dictionary`, `fragmentCounts`, and `usingFallbackDictionary`.
 *
 * @param words - Canonical, lowercase list of dictionary words to load.
 * @param fallback - Whether this dictionary is the lightweight built-in fallback.
 * @internal
 */
function applyDictionary(words: string[], fallback: boolean): void {
  dictionary = new Set(words);
  usingFallbackDictionary = fallback;
  buildFragmentIndex(words);
}

/**
 * Switches to the lightweight fallback dictionary and emits a structured log entry.
 *
 * @remarks
 * Intended for test runs or when the primary dictionary fails to load.
 *
 * @param log - Logger instance for structured diagnostics.
 * @param reason - Reason code for selecting the fallback dictionary.
 * @param messageSuffix - Optional message suffix appended to the info log entry (defaults to an empty string).
 * @internal
 */
function useFallbackDictionary(
  log: Logger,
  reason: 'test_fast_path' | 'load_failed',
  messageSuffix = '',
): void {
  applyDictionary(DEFAULT_WORDS, true);
  log.info(
    {
      event: 'dictionary_using_fallback',
      reason,
      wordCount: dictionary.size,
    },
    `Using built-in fallback dictionary with ${dictionary.size.toString()} words${messageSuffix}`,
  );
}

/**
 * Loads the primary dictionary into process memory and prepares supporting indexes.
 *
 * @remarks
 * Chooses a dictionary source based on `NODE_ENV`, defaulting to `/tmp/words.txt` in production
 * and `./words.txt` during development. When running tests without `DICTIONARY_TEST_MODE=full`
 * the lightweight fallback dictionary keeps CI deterministic. Fallback behavior is also invoked
 * when file loading fails outside of production.
 *
 * @public
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
    useFallbackDictionary(log, 'test_fast_path', ' (test fast path)');
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
    applyDictionary(words, false);
    log.info(
      {
        event: 'dictionary_loaded_from_file',
        wordCount: dictionary.size,
        maxLength: 30,
        source: filePath,
      },
      `Loaded ${dictionary.size.toString()} words (max length 30)`,
    );
  } catch (err) {
    log.error(
      { event: 'dictionary_load_failed', err, source: filePath },
      `Failed to load dictionary from ${filePath}`,
    );
    if (!isProd) {
      // Fallback to a tiny built-in dictionary for dev/test so CI remains deterministic.
      useFallbackDictionary(log, 'load_failed');
    }
  }
}

/**
 * Builds a `DictionaryPort` backed by module‑level state and helpers.
 *
 * @returns A `DictionaryPort` instance that proxies to the local dictionary utilities.
 *
 * @example
 * ```ts
 * loadDictionary();
 * const dict = createDictionaryPort();
 * dict.isValid('able'); // true/false
 * const frag = dict.getRandomFragment(10);
 * ```
 * @public
 */
export function createDictionaryPort(): DictionaryPort {
  return {
    isValid: isValidWord,
    getRandomFragment,
  };
}

/**
 * Populates the fragment frequency index used to support prompt generation heuristics.
 *
 * @remarks
 * Overwrites and rebuilds the `fragmentCounts` index and logs a summary of indexed fragments.
 *
 * @param words - Word list from which to derive fragments.
 * @param minLength - Minimum fragment length to index, inclusive (default: 2).
 * @param maxLength - Maximum fragment length to index, inclusive (default: 3).
 * @internal
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
 * @public
 */
export function isValidWord(word: string): boolean {
  return dictionary.has(word.toLowerCase());
}

/**
 * Generates a random fragment whose frequency meets the requested minimum in the dictionary.
 *
 * @remarks
 * In test environments, falls back deterministically to `'aa'` when no qualifying fragment exists.
 * In non-test environments, chooses the most frequent fragment as a best‑effort fallback and logs a warning.
 *
 * @param minWordsPerPrompt - Required minimum number of words that contain the fragment.
 * @returns A fragment that satisfies the constraint.
 * @throws When no qualifying fragment or fallback can be determined (non-test environments only).
 * @public
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
 * @public
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
 * @public
 */
export function isUsingFallbackDictionary(): boolean {
  return usingFallbackDictionary;
}
