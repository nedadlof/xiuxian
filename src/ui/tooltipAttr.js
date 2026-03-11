function escapeHtmlAttribute(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
    .replace(/\r?\n/g, '&#10;');
}

function tooltipAttr(lines) {
  const content = (Array.isArray(lines) ? lines : [])
    .filter((line) => line != null && line !== '')
    .join('\n');
  if (!content) return '';
  return `data-tooltip="${escapeHtmlAttribute(content)}"`;
}

export { tooltipAttr, escapeHtmlAttribute };

