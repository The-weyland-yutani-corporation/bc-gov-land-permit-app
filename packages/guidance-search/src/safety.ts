const suspiciousPatterns: readonly [RegExp, string][] = [
  [
    /\bignore (?:all |any |the )?(?:previous|prior|system) instructions?\b/i,
    'instruction_override',
  ],
  [
    /\b(?:system|developer) (?:message|prompt|instructions?)\b/i,
    'prompt_reference',
  ],
  [
    /\b(?:reveal|print|return|expose)\b.{0,40}\b(?:secret|token|credential|environment variable|system prompt)\b/i,
    'secret_exfiltration',
  ],
  [
    /\b(?:call|invoke|use)\b.{0,30}\b(?:tool|function|shell|command)\b/i,
    'tool_instruction',
  ],
  [
    /\b(?:bypass|disable|override)\b.{0,30}\b(?:safety|policy|authorization|scope)\b/i,
    'policy_bypass',
  ],
];

export function sanitizeRetrievedText(text: string): {
  text: string;
  flagged: boolean;
  reasons: string[];
} {
  const reasons = new Set<string>();
  const kept = text.split(/\r?\n/).filter((line) => {
    let suspicious = false;
    for (const [pattern, reason] of suspiciousPatterns) {
      if (pattern.test(line)) {
        reasons.add(reason);
        suspicious = true;
      }
    }
    return !suspicious;
  });
  const sanitized = kept
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
  return {
    text: sanitized || '[Suspicious retrieved content removed.]',
    flagged: reasons.size > 0,
    reasons: [...reasons].sort(),
  };
}
