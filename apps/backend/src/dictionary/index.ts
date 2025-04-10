import fs from 'fs';
import path from 'path';

let dictionary = new Set<string>();

export function loadDictionary() {
  const filePath = path.resolve(__dirname, './words.txt');
  const raw = fs.readFileSync(filePath, 'utf-8');
  const words = raw.split('\n').map((w) => w.trim());

  dictionary = new Set(words);
  console.log(`✅ Loaded ${dictionary.size.toString()} words into dictionary`);
}

export function isValidWord(word: string): boolean {
  return dictionary.has(word.toLowerCase());
}

export function getRandomFragment(minLen = 2, maxLen = 3): string {
  const words = Array.from(dictionary).filter((w) => w.length >= maxLen);
  const word = words[Math.floor(Math.random() * words.length)];
  const start = Math.floor(Math.random() * (word.length - minLen));
  const len = Math.floor(Math.random() * (maxLen - minLen + 1)) + minLen;
  return word.slice(start, start + len);
}
