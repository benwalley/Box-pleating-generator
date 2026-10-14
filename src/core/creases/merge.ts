import type { Crease } from './types.ts';

const KEY_SCALE = 1e6;

/**
 * Merge collinear, touching creases of the same kind and assignment into
 * long lines. Purely for drawing; checks run on the unmerged pieces.
 */
export function mergeCreases(creases: readonly Crease[]): Crease[] {
  type Item = { t0: number; t1: number; c: Crease };
  const groups = new Map<string, Item[]>();
  for (const c of creases) {
    let x1 = c.x1, y1 = c.y1, x2 = c.x2, y2 = c.y2;
    if (x2 < x1 || (x2 === x1 && y2 < y1)) [x1, y1, x2, y2] = [x2, y2, x1, y1];
    const len = Math.hypot(x2 - x1, y2 - y1);
    if (len === 0) continue;
    const dx = (x2 - x1) / len;
    const dy = (y2 - y1) / len;
    // A line is identified by its direction and its offset from the origin.
    const offset = dx * y1 - dy * x1;
    const key = `${c.kind}|${c.mv}|${c.elevation ?? ''}|${Math.round(dx * KEY_SCALE)},${Math.round(dy * KEY_SCALE)}|${Math.round(offset * KEY_SCALE)}`;
    const t0 = dx * x1 + dy * y1;
    const item: Item = { t0, t1: t0 + len, c: { ...c, x1, y1, x2, y2 } };
    const g = groups.get(key);
    if (g) g.push(item);
    else groups.set(key, [item]);
  }
  const out: Crease[] = [];
  for (const items of groups.values()) {
    items.sort((a, b) => a.t0 - b.t0);
    let cur = items[0]!;
    let { x1, y1, x2, y2 } = cur.c;
    for (let i = 1; i < items.length; i++) {
      const it = items[i]!;
      if (Math.abs(it.t0 - cur.t1) < 1e-7) {
        x2 = it.c.x2;
        y2 = it.c.y2;
        cur = { ...cur, t1: it.t1 };
      } else {
        out.push({ ...cur.c, x1, y1, x2, y2 });
        cur = it;
        ({ x1, y1, x2, y2 } = it.c);
      }
    }
    out.push({ ...cur.c, x1, y1, x2, y2 });
  }
  return out;
}
