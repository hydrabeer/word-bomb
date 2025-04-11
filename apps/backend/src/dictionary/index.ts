import fs from 'fs';
import path from 'path';
import https from 'https';

let dictionary = new Set<string>();
let fragmentCounts = new Map<string, number>();

/**
 * Loads the dictionary into memory from a local file or a remote source (if in production).
 * Also builds the fragment count index for fast lookup.
 */
export async function loadDictionary(): Promise<void> {
  const isProd = process.env.NODE_ENV === 'production';
  const localPath = path.resolve(__dirname, './words.txt');
  const prodPath = '/tmp/words.txt';
  const filePath = isProd ? prodPath : localPath;

  if (isProd && process.env.DICTIONARY_URL) {
    try {
      await downloadDictionaryFile(process.env.DICTIONARY_URL, prodPath);
    } catch (err) {
      console.error('❌ Failed to download dictionary:', err);
      return;
    }
  }

  try {
    const raw = fs.readFileSync(filePath, 'utf-8');
    const words = raw
      .split('\n')
      .map((w) => w.trim())
      .filter(Boolean);
    dictionary = new Set(words);
    console.log(`✅ Loaded ${dictionary.size.toString()} words`);

    buildFragmentIndex(words);
  } catch (err) {
    console.error(`❌ Failed to load dictionary from ${filePath}:`, err);
  }
}

/**
 * Downloads a remote dictionary file to the local filesystem.
 */
function downloadDictionaryFile(url: string, dest: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(dest);
    https
      .get(url, (res) => {
        if (res.statusCode !== 200) {
          reject(new Error(`Request failed with status ${String(res.statusCode ?? 'unknown')}`));
        }

        res.pipe(file);
        file.on('finish', () => {
          file.close(() => {
            resolve();
          });
        });
      })
      .on('error', reject);
  });
}

/**
 * Builds the fragment count index from the provided list of words.
 */
function buildFragmentIndex(words: string[]): void {
  fragmentCounts = new Map();

  for (const word of words) {
    for (let len = 2; len <= 3; len++) {
      if (word.length < len) continue;
      for (let i = 0; i <= word.length - len; i++) {
        const frag = word.slice(i, i + len);
        fragmentCounts.set(frag, (fragmentCounts.get(frag) ?? 0) + 1);
      }
    }
  }

  console.log(`✅ Indexed ${fragmentCounts.size.toString()} unique fragments`);
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
    throw new Error(
      `No fragments meet the minWordsPerPrompt requirement of ${minWordsPerPrompt.toString()}`,
    );
  }

  return candidates[Math.floor(Math.random() * candidates.length)];
}
