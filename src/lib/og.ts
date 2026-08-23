interface OgData {
  title: string;
  date: string;
  categories: string[];
  siteName: string;
}

const xml = (value: string) => value.replace(/[<>&"']/g, (character) => ({
  '<': '&lt;',
  '>': '&gt;',
  '&': '&amp;',
  '"': '&quot;',
  "'": '&apos;',
})[character]!);

function units(value: string) {
  return [...value].reduce((total, character) => total + (/[^\u0000-\u00ff]/.test(character) ? 2 : 1), 0);
}

// ponytail: character-width wrapping avoids a layout dependency; use measured font metrics if mixed-script titles visibly overflow.
export function wrapTitle(title: string, maxUnits = 38, maxLines = 3) {
  const lines: string[] = [];
  let line = '';
  for (const character of title.trim()) {
    if (line && units(line + character) > maxUnits) {
      lines.push(line.trim());
      line = '';
      if (lines.length === maxLines) break;
    }
    line += character;
  }
  if (line.trim() && lines.length < maxLines) lines.push(line.trim());
  if (lines.join('').replace(/\s/g, '').length < title.replace(/\s/g, '').length) {
    lines[lines.length - 1] = `${lines.at(-1)?.replace(/[.…]*$/, '')}…`;
  }
  return lines;
}

export function renderOgSvg({ title, date, categories, siteName }: OgData) {
  const titleLines = wrapTitle(title);
  const categoryLine = categories.slice(0, 3).join(' · ') || 'Article';
  const titleText = titleLines.map((line, index) => (
    `<text x="92" y="${362 + index * 67}" class="title">${xml(line)}</text>`
  )).join('');

  return `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
  <defs><linearGradient id="landscape" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#839b75"/><stop offset="0.5" stop-color="#58725c"/><stop offset="1" stop-color="#273c34"/></linearGradient></defs>
  <rect width="1200" height="630" fill="#f1f1f1"/>
  <rect x="45" y="28" width="1110" height="574" fill="#fff"/>
  <text x="92" y="92" class="site">${xml(siteName)}</text>
  <rect x="92" y="126" width="1016" height="126" fill="url(#landscape)"/>
  <path d="M92 224L270 157 390 210 552 146 710 226 865 167 1108 228V252H92Z" fill="#d6ddc9" opacity=".7"/>
  <rect x="92" y="252" width="1016" height="38" fill="#111"/>
  <text x="108" y="278" class="identity">TWENTY TEN · MODERN ASTRO EDITION</text>
  ${titleText}
  <text x="92" y="566" class="meta">${xml(date)}  ·  ${xml(categoryLine)}</text>
  <style>.site{font:700 34px Arial,sans-serif;fill:#111}.identity{font:700 14px Arial,sans-serif;letter-spacing:2px;fill:#ddd}.title{font:700 52px Georgia,'Noto Serif CJK TC','Noto Serif CJK SC',serif;fill:#111}.meta{font:18px Arial,'Noto Sans CJK TC','Noto Sans CJK SC',sans-serif;fill:#666}</style>
</svg>`;
}
