import fs from 'fs';
import path from 'path';
import https from 'https';

let dictionary = new Set<string>();

/**
 * Loads the dictionary into memory from a local file or a remote source (if in production).
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
    console.log(`✅ Loaded ${dictionary.size.toLocaleString()} words`);
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
 * Checks if a word is valid.
 */
export function isValidWord(word: string): boolean {
  return dictionary.has(word.toLowerCase());
}

/**
 * Generates a random word fragment from the dictionary.
 */
export function getRandomFragment(minLen = 2, maxLen = 3): string {
  const words = Array.from(dictionary).filter((w) => w.length >= maxLen);
  const word = words[Math.floor(Math.random() * words.length)];
  const start = Math.floor(Math.random() * (word.length - minLen));
  const len = Math.floor(Math.random() * (maxLen - minLen + 1)) + minLen;
  return word.slice(start, start + len);
}
