export class EmailNormalizer {
  /**
   * Normalizing the subject line:
   * - Stripping "Re:", "Fwd:" prefixes
   * - If empty (or becomes empty after stripping), generate a meaningful subject based on threadId + ordinal reply index
   */
  static normalizeSubject(
    subject: string | undefined,
    threadId: string,
    replyIndex: number // 0 = original (first other-party message), 1 = 1st reply, ...
  ): string {
    const stripped = subject && subject.trim() ? this.stripPrefixes(subject) : '';

    if (stripped) {
      return stripped;
    }

    // If no usable subject → synthetic subject based on index
    if (replyIndex === 0) {
      return `${threadId}_original`;
    }
    return `${threadId}_${this.ordinal(replyIndex)}_reply`;
  }

  /** Removing all "Re:" / "Fwd:" prefixes (multiple) */
  private static stripPrefixes(subject: string): string {
    // Removing repeated Re:/Fwd: at the start safely
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
