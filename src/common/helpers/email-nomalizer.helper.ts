export class EmailNormalizer {
  /**
   * Normalizing the subject line:
   * - Stripping "Re:", "Fwd:" prefixes
   * - If empty (or becomes empty after stripping), generate a meaningful subject based on threadId + ordinal reply index
   */
  static normalizeSubject(
    subject: string | undefined,
    threadId: string,
    mailIndex: number // 0 = first mail, 1 = second mail, etc.
  ): string {
    const stripped = subject && subject.trim() ? this.stripPrefixes(subject) : '';

    if (stripped) {
      return stripped;
    }

    // Always generate with 1-based numbering (so 0 => 1st, 1 => 2nd, etc.)
    const displayIndex = mailIndex + 1;
    return `${threadId}_${this.ordinal(displayIndex)}_mail`;
  }

  /** Removing all "Re:" / "Fwd:" prefixes (multiple) */
  private static stripPrefixes(subject: string): string {
    return subject.replace(/^(?:(?:re|fwd):\s*)+/gi, '').trim();
  }

  /** Ordinal suffix helper: 1 -> 1st, 2 -> 2nd, 3 -> 3rd, 4 -> 4th ... */
  private static ordinal(n: number): string {
    const j = n % 10, k = n % 100;
    if (j === 1 && k !== 11) return `${n}st`;
    if (j === 2 && k !== 12) return `${n}nd`;
    if (j === 3 && k !== 13) return `${n}rd`;
    return `${n}th`;
  }

  /**
   * Extracting clean email address from sender header.
   * Example: "Niyaz Malik <niyaz@malik.com>" → "niyaz@malik.com"
   */
  static normalizeSender(sender: string): string {
    if (!sender) return '';
    const match = sender.match(/^(.*?)\s*<(.+?)>$/);
    if (match) return match[2].trim().toLowerCase(); // return email only
    return sender.trim().toLowerCase();
  }
}
