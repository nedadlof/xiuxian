const RESULT_LABELS = {
  hit: '\u547d\u4e2d',
  miss: '\u95ea\u907f',
  block: '\u683c\u6321',
  crit: '\u66b4\u51fb',
  'crit-block': '\u66b4\u51fb\u88ab\u6321',
};

function sanitizeBattleRoundLine(text) {
  const line = String(text ?? '');
  const match = line.match(/^[?？]\s*(\d+)\s*[?？]{2}$/);
  if (!match) return null;
  return `\u7b2c ${match[1]} \u56de\u5408`;
}

function sanitizeOutcomeTokens(text) {
  const line = String(text ?? '');
  return line.replace(/(\u7ed3\u679c|结果|result)\s*(hit|miss|block|crit|crit-block)\b/gi, (full, prefix, keyRaw) => {
    const key = String(keyRaw ?? '').toLowerCase();
    const label = RESULT_LABELS[key] ?? keyRaw;
    const normalizedPrefix = prefix === 'result' ? '\u7ed3\u679c' : prefix;
    return `${normalizedPrefix} ${label}`;
  });
}

function sanitizeGarbledQuestionMarks(text) {
  const line = String(text ?? '');
  // Replace long runs of question marks (often encoding loss) with a readable placeholder.
  return line.replace(/[?？]{3,}/g, '\uff08\u6587\u672c\u4e71\u7801\uff09');
}

function sanitizeUiText(text) {
  if (text == null) return text;
  const roundLine = sanitizeBattleRoundLine(text);
  if (roundLine) return roundLine;
  return sanitizeGarbledQuestionMarks(sanitizeOutcomeTokens(String(text)));
}

export { sanitizeUiText, RESULT_LABELS };

