/**
 * Reading and writing designs as JSON. Imported data is validated field by
 * field and normalized, so a hand-edited or older file can't put the app in
 * an invalid state.
 */
import { createDesign, normalizeDesign } from './design.ts';
import { SCHEMA_VERSION, type Design, type Flap, type River } from './types.ts';
import { linkMirrors } from '../symmetry/book.ts';

export const FILE_FORMAT = 'pleatsmith-design';

export interface DesignFile {
  readonly format: typeof FILE_FORMAT;
  readonly design: Design;
}

export type ParseResult = { ok: true; design: Design } | { ok: false; error: string };

export function serializeDesign(design: Design): string {
  const file: DesignFile = { format: FILE_FORMAT, design };
  return JSON.stringify(file, null, 2);
}

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const num = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
const str = (v: unknown, fallback = ''): string => (typeof v === 'string' ? v : fallback);

function parseFlap(v: unknown, i: number): Flap {
  if (!isObj(v) || !num(v.x) || !num(v.y) || !num(v.r)) throw new Error(`Flap ${i + 1} is missing x, y or r.`);
  const size = (k: 'w' | 'h') => (num(v[k]) ? v[k] : 0);
  return { id: str(v.id, `f_import${i}`), x: v.x, y: v.y, w: size('w'), h: size('h'), r: v.r, label: str(v.label), mirrorId: null };
}

function parseRiver(v: unknown, i: number): River {
  if (!isObj(v) || !num(v.width) || !Array.isArray(v.points)) throw new Error(`River ${i + 1} is missing width or points.`);
  const points = v.points.map((p, j) => {
    if (!isObj(p) || !num(p.x) || !num(p.y)) throw new Error(`River ${i + 1}, point ${j + 1} is not a point.`);
    return { x: p.x, y: p.y };
  });
  return { id: str(v.id, `r_import${i}`), points, width: v.width, label: str(v.label), mirrorId: null };
}

/** Accepts either a full design file or a bare design object. */
export function parseDesign(text: string): ParseResult {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    return { ok: false, error: 'The file is not valid JSON.' };
  }
  try {
    const d = isObj(raw) && isObj(raw.design) ? raw.design : raw;
    if (!isObj(d)) throw new Error('The file does not contain a design.');
    if (num(d.schemaVersion) && d.schemaVersion > SCHEMA_VERSION) {
      throw new Error('This design was saved by a newer version of the app.');
    }
    const flaps = Array.isArray(d.flaps) ? d.flaps.map(parseFlap) : [];
    const rivers = Array.isArray(d.rivers) ? d.rivers.map(parseRiver) : [];
    const labels: Record<string, string> = {};
    if (isObj(d.nodeLabels)) for (const [k, v] of Object.entries(d.nodeLabels)) if (typeof v === 'string') labels[k] = v;
    const design = createDesign({
      name: str(d.name, 'Imported design'),
      gridSize: num(d.gridSize) ? d.gridSize : undefined,
      flaps,
      rivers,
      symmetry: { book: isObj(d.symmetry) && d.symmetry.book === true },
      nodeLabels: labels,
      rootPort: typeof d.rootPort === 'string' ? d.rootPort : null,
    });
    return { ok: true, design: linkMirrors(normalizeDesign(design)) };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'The design could not be read.' };
  }
}
