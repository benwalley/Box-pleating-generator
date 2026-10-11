/** Example designs. Each one demonstrates a feature of the generator. */
import { createDesign } from './model/design.ts';
import type { Design, Flap, River } from './model/types.ts';
import { linkMirrors } from './symmetry/book.ts';
import type { Point } from './geometry/point.ts';

export interface Preset {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  readonly build: () => Design;
}

let seq = 0;
const flap = (x: number, y: number, r: number, label = ''): Flap => ({ id: `f_p${++seq}`, x, y, r, label, mirrorId: null });
const river = (points: Point[], width: number, label = ''): River => ({ id: `r_p${++seq}`, points, width, label, mirrorId: null });

export const PRESETS: readonly Preset[] = [
  {
    id: 'bird',
    name: 'Four corners',
    description: 'Four equal corner flaps around one hub, like a bird base.',
    build: () =>
      linkMirrors(
        createDesign({
          name: 'Four corners',
          gridSize: 8,
          symmetry: { book: true },
          flaps: [flap(0, 0, 4, 'Head'), flap(8, 0, 4, 'Wing'), flap(0, 8, 4, 'Tail'), flap(8, 8, 4, 'Wing')],
        }),
      ),
  },
  {
    id: 'five',
    name: 'Five flaps',
    description: 'Four corner flaps and a short middle flap sharing one hub.',
    build: () =>
      createDesign({
        name: 'Five flaps',
        gridSize: 8,
        flaps: [flap(0, 0, 3), flap(8, 0, 3), flap(0, 8, 3), flap(8, 8, 3), flap(4, 4, 1, 'Middle')],
      }),
  },
  {
    id: 'river',
    name: 'Two groups and a river',
    description: 'Two columns of flaps separated by a river of width 6.',
    build: () =>
      linkMirrors(
        createDesign({
          name: 'Two groups and a river',
          gridSize: 12,
          symmetry: { book: true },
          flaps: [0, 6, 12].flatMap((y) => [flap(0, y, 3), flap(12, y, 3)]),
          rivers: [river([{ x: 6, y: 0 }, { x: 6, y: 12 }], 6, 'Spine')],
        }),
      ),
  },
  {
    id: 'lizard',
    name: 'Lizard',
    description: 'Head, tail and four legs; a body river of width 8 joins front and back.',
    build: () =>
      linkMirrors(
        createDesign({
          name: 'Lizard',
          gridSize: 16,
          symmetry: { book: true },
          flaps: [
            flap(0, 0, 4, 'Front leg'),
            flap(8, 0, 4, 'Head'),
            flap(16, 0, 4, 'Front leg'),
            flap(0, 16, 4, 'Back leg'),
            flap(8, 16, 4, 'Tail'),
            flap(16, 16, 4, 'Back leg'),
          ],
          rivers: [river([{ x: 0, y: 8 }, { x: 16, y: 8 }], 8, 'Body')],
        }),
      ),
  },
];

export const findPreset = (id: string): Preset | undefined => PRESETS.find((p) => p.id === id);
