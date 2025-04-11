export class BonusProgress {
  private readonly progress: number[];

  constructor(initial: number[]) {
    if (initial.length !== 26) throw new Error('BonusProgress must have 26 entries.');
    this.progress = [...initial];
  }

  useLetter(letter: string): boolean {
    const index = this.getIndex(letter);
    if (index === -1 || this.progress[index] <= 0) return false;
    this.progress[index]--;
    return true;
  }

  isComplete(): boolean {
    return this.progress.every((n) => n <= 0);
  }

  reset(template: number[]): void {
    if (template.length !== 26) throw new Error('Invalid template for reset.');
    for (let i = 0; i < 26; i++) this.progress[i] = template[i];
  }

  private getIndex(letter: string): number {
    const code = letter.toLowerCase().charCodeAt(0);
    return code >= 97 && code <= 122 ? code - 97 : -1;
  }
}
