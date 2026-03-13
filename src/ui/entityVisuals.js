const IMAGE_CACHE = new Map();

const BASE_PALETTES = Object.freeze({
  resource: { base: '#eadfc8', ink: '#5f4630', accent: '#a47341', paper: '#f7f1e4' },
  disciple: { base: '#efe4d1', ink: '#564133', accent: '#8c5a38', paper: '#faf4e8' },
  beast: { base: '#e8dcc7', ink: '#4e3c31', accent: '#7d5d46', paper: '#f6efe3' },
  weapon: { base: '#e5d8c2', ink: '#4b4036', accent: '#8b6a46', paper: '#f3ecdf' },
  pill: { base: '#ede2d0', ink: '#4f4037', accent: '#7a6642', paper: '#faf5ea' },
  unit: { base: '#e7dbc8', ink: '#503d30', accent: '#8f6441', paper: '#f8f1e5' },
  generic: { base: '#eadfce', ink: '#554238', accent: '#8d6a4b', paper: '#f8f2e8' },
});

const RARITY_ACCENTS = Object.freeze({
  common: '#8e7861',
  rare: '#6f8d84',
  epic: '#82698d',
  legendary: '#a46e3b',
});

function clampColor(value) {
  return Math.max(0, Math.min(255, value));
}

function hexToRgb(hex) {
  const safe = `${hex}`.replace('#', '').trim();
  const normalized = safe.length === 3
    ? safe.split('').map((char) => `${char}${char}`).join('')
    : safe.padEnd(6, '0').slice(0, 6);
  return {
    r: parseInt(normalized.slice(0, 2), 16),
    g: parseInt(normalized.slice(2, 4), 16),
    b: parseInt(normalized.slice(4, 6), 16),
  };
}

function rgbToHex({ r, g, b }) {
  return `#${[r, g, b].map((value) => clampColor(value).toString(16).padStart(2, '0')).join('')}`;
}

function tintColor(hex, ratio = 0) {
  const rgb = hexToRgb(hex);
  const next = {
    r: Math.round(rgb.r + (255 - rgb.r) * ratio),
    g: Math.round(rgb.g + (255 - rgb.g) * ratio),
    b: Math.round(rgb.b + (255 - rgb.b) * ratio),
  };
  return rgbToHex(next);
}

function shadeColor(hex, ratio = 0) {
  const rgb = hexToRgb(hex);
  const next = {
    r: Math.round(rgb.r * (1 - ratio)),
    g: Math.round(rgb.g * (1 - ratio)),
    b: Math.round(rgb.b * (1 - ratio)),
  };
  return rgbToHex(next);
}

function hashText(text = '') {
  let hash = 2166136261;
  for (const char of `${text}`) {
    hash ^= char.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return Math.abs(hash >>> 0);
}

function escapeAttr(value = '') {
  return `${value}`
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function createDataUri(svg) {
  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
}

function getBadgeText(title = '', fallback = '') {
  const source = `${title}`.trim();
  return (source[0] ?? fallback ?? '仙').toString().slice(0, 1);
}

function getPalette(kind = 'generic', rarity = 'common', seed = 0) {
  const basePalette = BASE_PALETTES[kind] ?? BASE_PALETTES.generic;
  const accentBase = RARITY_ACCENTS[rarity] ?? basePalette.accent;
  const drift = (seed % 5) * 0.03;
  return {
    base: tintColor(basePalette.base, drift),
    paper: tintColor(basePalette.paper, drift * 0.7),
    accent: tintColor(accentBase, drift * 0.4),
    accentSoft: tintColor(accentBase, 0.32 + drift * 0.3),
    ink: shadeColor(basePalette.ink, drift * 0.18),
    line: shadeColor(basePalette.accent, 0.22),
  };
}

function renderBorderOrnaments(colors) {
  return `
    <path d="M18 30 C18 22, 22 18, 30 18 L38 18" fill="none" stroke="${colors.line}" stroke-width="2.4" stroke-linecap="round" opacity="0.65"/>
    <path d="M82 18 L90 18 C98 18, 102 22, 102 30" fill="none" stroke="${colors.line}" stroke-width="2.4" stroke-linecap="round" opacity="0.65"/>
    <path d="M18 90 C18 98, 22 102, 30 102 L38 102" fill="none" stroke="${colors.line}" stroke-width="2.4" stroke-linecap="round" opacity="0.65"/>
    <path d="M82 102 L90 102 C98 102, 102 98, 102 90" fill="none" stroke="${colors.line}" stroke-width="2.4" stroke-linecap="round" opacity="0.65"/>
  `;
}

function renderMotif(kind = 'generic', colors, seed = 0, title = '', subtitle = '') {
  const label = `${title} ${subtitle}`.toLowerCase();

  if (kind === 'resource') {
    if (/wood|木/.test(label)) {
      return `
        <path d="M60 22 C76 34, 78 58, 60 82 C42 58, 44 34, 60 22 Z" fill="${colors.accentSoft}" stroke="${colors.ink}" stroke-width="3"/>
        <path d="M60 30 L60 78" stroke="${colors.ink}" stroke-width="3" stroke-linecap="round"/>
        <path d="M60 46 C50 42, 46 38, 42 30" stroke="${colors.ink}" stroke-width="2.4" stroke-linecap="round"/>
        <path d="M60 56 C70 52, 76 48, 80 40" stroke="${colors.ink}" stroke-width="2.4" stroke-linecap="round"/>
      `;
    }
    if (/herb|草/.test(label)) {
      return `
        <path d="M50 80 C44 64, 46 46, 58 28 C64 42, 64 62, 50 80 Z" fill="${colors.accentSoft}" stroke="${colors.ink}" stroke-width="3"/>
        <path d="M70 80 C76 66, 74 48, 62 32 C56 44, 56 64, 70 80 Z" fill="${tintColor(colors.accentSoft, 0.1)}" stroke="${colors.ink}" stroke-width="3"/>
        <path d="M60 28 L60 86" stroke="${colors.ink}" stroke-width="3" stroke-linecap="round"/>
      `;
    }
    if (/iron|铁/.test(label)) {
      return `
        <path d="M36 36 L84 36 L92 54 L78 82 L42 82 L28 54 Z" fill="${colors.accentSoft}" stroke="${colors.ink}" stroke-width="3"/>
        <path d="M46 50 L74 50" stroke="${colors.ink}" stroke-width="3" stroke-linecap="round"/>
        <path d="M50 64 L70 64" stroke="${colors.ink}" stroke-width="3" stroke-linecap="round"/>
      `;
    }
    if (/pills|丹/.test(label)) {
      return `
        <circle cx="49" cy="56" r="16" fill="${colors.accentSoft}" stroke="${colors.ink}" stroke-width="3"/>
        <circle cx="71" cy="50" r="14" fill="${tintColor(colors.accentSoft, 0.08)}" stroke="${colors.ink}" stroke-width="3"/>
        <path d="M40 75 C48 82, 60 84, 74 76" fill="none" stroke="${colors.line}" stroke-width="2.5" stroke-linecap="round"/>
      `;
    }
    if (/talisman|符/.test(label)) {
      return `
        <path d="M44 24 H76 V88 L60 78 L44 88 Z" fill="${colors.accentSoft}" stroke="${colors.ink}" stroke-width="3"/>
        <path d="M52 40 L68 40" stroke="${colors.ink}" stroke-width="3" stroke-linecap="round"/>
        <path d="M52 52 L68 52" stroke="${colors.ink}" stroke-width="3" stroke-linecap="round"/>
        <path d="M60 40 L60 68" stroke="${colors.line}" stroke-width="2.5" stroke-linecap="round"/>
      `;
    }
    if (/seal|印/.test(label)) {
      return `
        <circle cx="60" cy="58" r="25" fill="${colors.accentSoft}" stroke="${colors.ink}" stroke-width="3"/>
        <rect x="52" y="24" width="16" height="18" rx="4" fill="${colors.accent}" stroke="${colors.ink}" stroke-width="3"/>
        <path d="M48 58 H72 M60 46 V70" stroke="${colors.ink}" stroke-width="3" stroke-linecap="round"/>
      `;
    }
    return `
      <path d="M60 18 L78 40 L72 84 L48 84 L42 40 Z" fill="${colors.accentSoft}" stroke="${colors.ink}" stroke-width="3"/>
      <path d="M60 28 L60 76" stroke="${colors.ink}" stroke-width="3" stroke-linecap="round"/>
      <path d="M48 48 L72 48" stroke="${colors.line}" stroke-width="2.5" stroke-linecap="round"/>
    `;
  }

  if (kind === 'disciple') {
    return `
      <circle cx="60" cy="42" r="17" fill="${colors.accentSoft}" stroke="${colors.ink}" stroke-width="3"/>
      <path d="M36 88 C36 71, 47 60, 60 60 C73 60, 84 71, 84 88" fill="${colors.accent}" fill-opacity="0.6" stroke="${colors.ink}" stroke-width="3"/>
      <path d="M44 32 C50 22, 68 20, 76 34" fill="none" stroke="${colors.line}" stroke-width="3" stroke-linecap="round"/>
      <path d="M46 72 C54 78, 66 78, 74 72" fill="none" stroke="${colors.line}" stroke-width="2.6" stroke-linecap="round"/>
    `;
  }

  if (kind === 'beast') {
    return `
      <path d="M40 84 C36 66, 42 48, 60 36 C78 48, 84 66, 80 84" fill="${colors.accentSoft}" stroke="${colors.ink}" stroke-width="3"/>
      <circle cx="48" cy="32" r="8" fill="${colors.accent}" stroke="${colors.ink}" stroke-width="3"/>
      <circle cx="72" cy="32" r="8" fill="${colors.accent}" stroke="${colors.ink}" stroke-width="3"/>
      <circle cx="48" cy="58" r="7" fill="${colors.paper}" stroke="${colors.ink}" stroke-width="3"/>
      <circle cx="72" cy="58" r="7" fill="${colors.paper}" stroke="${colors.ink}" stroke-width="3"/>
      <path d="M52 72 C56 78, 64 78, 68 72" fill="none" stroke="${colors.ink}" stroke-width="3" stroke-linecap="round"/>
    `;
  }

  if (kind === 'weapon') {
    if (/弓|bow/.test(label)) {
      return `
        <path d="M42 24 C28 40, 28 80, 42 96" fill="none" stroke="${colors.ink}" stroke-width="4" stroke-linecap="round"/>
        <path d="M78 24 C92 40, 92 80, 78 96" fill="none" stroke="${colors.ink}" stroke-width="4" stroke-linecap="round"/>
        <path d="M42 24 L78 96" stroke="${colors.line}" stroke-width="3"/>
        <path d="M36 60 H84" stroke="${colors.accent}" stroke-width="4" stroke-linecap="round"/>
      `;
    }
    if (/枪|矛|戟|spear/.test(label)) {
      return `
        <path d="M60 18 L72 34 L60 42 L48 34 Z" fill="${colors.accentSoft}" stroke="${colors.ink}" stroke-width="3"/>
        <path d="M60 42 L60 92" stroke="${colors.ink}" stroke-width="4" stroke-linecap="round"/>
        <path d="M54 74 L66 74" stroke="${colors.line}" stroke-width="3" stroke-linecap="round"/>
      `;
    }
    return `
      <path d="M60 18 L68 28 L60 36 L52 28 Z" fill="${colors.accentSoft}" stroke="${colors.ink}" stroke-width="3"/>
      <path d="M60 36 L60 78" stroke="${colors.ink}" stroke-width="5" stroke-linecap="round"/>
      <path d="M44 52 H76" stroke="${colors.ink}" stroke-width="4" stroke-linecap="round"/>
      <path d="M52 84 Q60 92 68 84" fill="none" stroke="${colors.line}" stroke-width="4" stroke-linecap="round"/>
    `;
  }

  if (kind === 'pill') {
    return `
      <path d="M52 24 H68 V34 C68 40, 72 44, 78 52 C84 60, 82 84, 60 88 C38 84, 36 60, 42 52 C48 44, 52 40, 52 34 Z" fill="${colors.accentSoft}" stroke="${colors.ink}" stroke-width="3"/>
      <path d="M52 28 H68" stroke="${colors.ink}" stroke-width="3" stroke-linecap="round"/>
      <circle cx="52" cy="60" r="4" fill="${colors.paper}"/>
      <circle cx="68" cy="68" r="5" fill="${colors.paper}"/>
      <path d="M48 74 C56 80, 64 80, 72 72" fill="none" stroke="${colors.line}" stroke-width="2.8" stroke-linecap="round"/>
    `;
  }

  if (kind === 'unit') {
    return `
      <path d="M42 24 L42 92" stroke="${colors.ink}" stroke-width="4" stroke-linecap="round"/>
      <path d="M46 26 C62 28, 78 36, 84 48 C76 52, 62 54, 46 52 Z" fill="${colors.accentSoft}" stroke="${colors.ink}" stroke-width="3"/>
      <path d="M58 54 L78 86" stroke="${colors.line}" stroke-width="3" stroke-linecap="round"/>
      <path d="M72 78 L86 88" stroke="${colors.line}" stroke-width="3" stroke-linecap="round"/>
    `;
  }

  const orbit = 24 + (seed % 10);
  return `
    <circle cx="60" cy="60" r="20" fill="${colors.accentSoft}" stroke="${colors.ink}" stroke-width="3"/>
    <path d="M${60 - orbit} 60 H${60 + orbit}" stroke="${colors.line}" stroke-width="3" stroke-linecap="round"/>
    <path d="M60 ${60 - orbit} V${60 + orbit}" stroke="${colors.line}" stroke-width="3" stroke-linecap="round"/>
  `;
}

export function getEntityArtSrc(options = {}) {
  const cacheKey = JSON.stringify(options);
  if (IMAGE_CACHE.has(cacheKey)) {
    return IMAGE_CACHE.get(cacheKey);
  }

  const {
    kind = 'generic',
    rarity = 'common',
    title = '',
    subtitle = '',
    badge = '',
    tone = '',
  } = options;
  const seed = hashText(`${kind}:${title}:${subtitle}:${badge}:${tone}`);
  const colors = getPalette(kind, rarity, seed);
  const badgeText = getBadgeText(badge || title, kind === 'resource' ? '资' : '仙');
  const textureOpacity = 0.05 + (seed % 6) * 0.01;
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120" role="img" aria-label="${escapeAttr(title)}">
      <defs>
        <linearGradient id="bg-${seed}" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stop-color="${colors.paper}"/>
          <stop offset="100%" stop-color="${colors.base}"/>
        </linearGradient>
        <linearGradient id="wash-${seed}" x1="0" y1="1" x2="1" y2="0">
          <stop offset="0%" stop-color="${tintColor(colors.accent, 0.34)}" stop-opacity="0.28"/>
          <stop offset="100%" stop-color="${shadeColor(colors.base, 0.14)}" stop-opacity="0.08"/>
        </linearGradient>
      </defs>
      <rect x="8" y="8" width="104" height="104" rx="24" fill="url(#bg-${seed})" stroke="${colors.line}" stroke-width="2.8"/>
      <rect x="16" y="16" width="88" height="88" rx="18" fill="none" stroke="${tintColor(colors.line, 0.24)}" stroke-width="1.6" opacity="0.75"/>
      <path d="M18 94 C34 86, 46 90, 60 82 C74 74, 88 76, 102 66" fill="none" stroke="url(#wash-${seed})" stroke-width="14" stroke-linecap="round" opacity="0.85"/>
      <path d="M18 40 C36 30, 52 32, 66 24 C78 18, 92 22, 102 18" fill="none" stroke="${colors.accent}" stroke-opacity="${textureOpacity}" stroke-width="12" stroke-linecap="round"/>
      ${renderBorderOrnaments(colors)}
      <g transform="translate(0 ${seed % 3})">
        ${renderMotif(kind, colors, seed, title, subtitle)}
      </g>
      <circle cx="91" cy="29" r="11" fill="${colors.accent}" fill-opacity="0.18" stroke="${colors.line}" stroke-width="1.4"/>
      <text x="91" y="33" text-anchor="middle" font-size="10" font-family="STKaiti, KaiTi, serif" fill="${colors.ink}" font-weight="700">${escapeAttr(badgeText)}</text>
    </svg>
  `;
  const src = createDataUri(svg);
  IMAGE_CACHE.set(cacheKey, src);
  return src;
}

export function renderEntityThumb(options = {}) {
  const {
    kind = 'generic',
    className = '',
    title = '',
  } = options;
  const classes = ['entity-thumb', className].filter(Boolean).join(' ');
  return `<span class="${classes}"><img class="entity-thumb-image" src="${getEntityArtSrc(options)}" alt="${escapeAttr(title || kind)}" loading="lazy" /></span>`;
}
