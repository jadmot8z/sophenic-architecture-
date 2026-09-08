export class SpeechSegmenter {
  private buffer = "";

  reset(): void {
    this.buffer = "";
  }

  push(delta: string): string[] {
    this.buffer += delta;
    const segments: string[] = [];
    // Wait for punctuation and a useful amount of context. This lets speech
    // begin early without feeding the neural voice awkward two-word fragments.
    let match = this.buffer.match(/^([\s\S]{28,}?[.!?…](?:[\])}"'»”]*)(?:\s+|$))/);
    while (match) {
      const value = match[1].trim();
      if (value) segments.push(value);
      this.buffer = this.buffer.slice(match[0].length);
      match = this.buffer.match(/^([\s\S]{28,}?[.!?…](?:[\])}"'»”]*)(?:\s+|$))/);
    }
    // A very long unpunctuated model stream should still start speaking at a
    // semantic boundary rather than waiting for the entire answer.
    if (this.buffer.length > 220) {
      const boundary = Math.max(this.buffer.lastIndexOf(", ", 190), this.buffer.lastIndexOf("; ", 190), this.buffer.lastIndexOf(": ", 190));
      if (boundary > 80) {
        segments.push(this.buffer.slice(0, boundary + 1).trim());
        this.buffer = this.buffer.slice(boundary + 1).trimStart();
      }
    }
    return segments;
  }

  flush(): string {
    const value = this.buffer.trim();
    this.buffer = "";
    return value;
  }
}
