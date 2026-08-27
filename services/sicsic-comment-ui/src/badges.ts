// Author badge marks shown at the lower-right of a comment avatar.
//   'cockade' — abstract French tricolor cockade (seal outline, scalloped ivory/navy rings, faint pleats)
//   'seal'    — approved seal + check, recolored to #2E6450
// Both render crisply at ~12-16px. SVG strings carry unique gradient/clip ids per call.

export type BadgeKind = 'none' | 'cockade' | 'seal';

const SEAL =
  'm894.4 461.56-54.4-63.2c-10.4-12-18.8-34.4-18.8-50.4v-68c0-42.4-34.8-77.2-77.2-77.2h-68c-15.6 0-38.4-8.4-50.4-18.8l-63.2-54.4c-27.6-23.6-72.8-23.6-100.8 0l-62.8 54.8c-12 10-34.8 18.4-50.4 18.4h-69.2c-42.4 0-77.2 34.8-77.2 77.2v68.4c0 15.6-8.4 38-18.4 50l-54 63.6c-23.2 27.6-23.2 72.4 0 100l54 63.6c10 12 18.4 34.4 18.4 50v68.4c0 42.4 34.8 77.2 77.2 77.2h69.2c15.6 0 38.4 8.4 50.4 18.8l63.2 54.4c27.6 23.6 72.8 23.6 100.8 0l63.2-54.4c12-10.4 34.4-18.8 50.4-18.8h68c42.4 0 77.2-34.8 77.2-77.2v-68c0-15.6 8.4-38.4 18.8-50.4l54.4-63.2c23.2-27.6 23.2-73.2-.4-100.8z';
const CHECK =
  'M678.4 436.36l-193.2 193.2a30 30 0 0 1-42.4 0l-96.8-96.8a30.16 30.16 0 0 1 0-42.4c11.6-11.6 30.8-11.6 42.4 0l75.6 75.6 172-172c11.6-11.6 30.8-11.6 42.4 0 11.6 11.6 11.6 30.8 0 42.4z';

const CX = 512;
const CY = 512;
const R = 382;
const VB = '108 108 808 808';

function n(v: number): string {
  return v.toFixed(2);
}

function scallop(base: number, amp: number): string {
  const pts = 120;
  let d = '';
  for (let j = 0; j <= pts; j += 1) {
    const th = (j / pts) * 6.2831853;
    const r = base * (1 + amp * Math.cos(8 * th));
    d += `${j ? 'L' : 'M'}${n(CX + r * Math.cos(th))} ${n(CY + r * Math.sin(th))} `;
  }
  return `${d}Z`;
}

function cockade(px: number, uid: string): string {
  const N = 8;
  const W = 6.2831853 / N;
  const rg = 0.6 * R;
  const sR = R * 1.5;
  let grad = '';
  let sectors = '';
  for (let i = 0; i < N; i += 1) {
    const a0 = i * W;
    const a1 = (i + 1) * W;
    const g0x = CX + rg * Math.cos(a0);
    const g0y = CY + rg * Math.sin(a0);
    const g1x = CX + rg * Math.cos(a1);
    const g1y = CY + rg * Math.sin(a1);
    const A0x = CX + sR * Math.cos(a0);
    const A0y = CY + sR * Math.sin(a0);
    const A1x = CX + sR * Math.cos(a1);
    const A1y = CY + sR * Math.sin(a1);
    grad += `<linearGradient id="g${uid}_${i}" gradientUnits="userSpaceOnUse" x1="${n(g0x)}" y1="${n(g0y)}" x2="${n(g1x)}" y2="${n(g1y)}"><stop offset="0" stop-color="#fff" stop-opacity="0.07"/><stop offset="1" stop-color="#000" stop-opacity="0.11"/></linearGradient>`;
    sectors += `<path d="M${CX} ${CY} L${n(A0x)} ${n(A0y)} A${n(sR)} ${n(sR)} 0 0 1 ${n(A1x)} ${n(A1y)} Z" fill="url(#g${uid}_${i})"/>`;
  }
  return (
    `<svg viewBox="${VB}" width="${px}" height="${px}" style="display:block" role="img" aria-label="三色花结">` +
    `<defs>${grad}<clipPath id="cl${uid}"><path d="${SEAL}"/></clipPath></defs>` +
    `<path d="${SEAL}" fill="#b23b34"/>` +
    `<path d="${scallop(0.6 * R, 0.05)}" fill="#f4f1e9"/>` +
    `<path d="${scallop(0.31 * R, 0.05)}" fill="#2c4f86"/>` +
    `<g clip-path="url(#cl${uid})">${sectors}</g>` +
    `<path d="${SEAL}" fill="none" stroke="#000" stroke-opacity="0.14" stroke-width="${n(R * 0.012)}"/>` +
    '</svg>'
  );
}

function seal(px: number): string {
  return (
    `<svg viewBox="${VB}" width="${px}" height="${px}" style="display:block" role="img" aria-label="认证标记">` +
    `<path d="${SEAL}" fill="#2E6450"/>` +
    `<path d="${CHECK}" fill="#f4f1e9"/>` +
    '</svg>'
  );
}

let seq = 0;

export function badgeSvg(kind: BadgeKind, px = 14): string {
  if (kind === 'cockade') return cockade(px, `b${(seq += 1)}`);
  if (kind === 'seal') return seal(px);
  return '';
}

export function badgeLabel(kind: BadgeKind): string {
  if (kind === 'cockade') return '三色花结';
  if (kind === 'seal') return '认证标记';
  return '不标注';
}
