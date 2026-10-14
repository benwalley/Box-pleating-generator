# Pleatsmith

Pleatsmith is a browser app for designing **box-pleated origami**. You lay out flap squares and rivers on a grid, and the app:

1. infers the **tree** (the stick figure of the model),
2. generates the **crease pattern** (hinges, ridges, axis-parallel contours),
3. assigns **mountain/valley** folds where it can, and
4. **checks** the layout and the pattern, explaining every problem and how to fix it.

It is built with [Lit](https://lit.dev) and [Vite](https://vite.dev) in TypeScript, with no other runtime dependencies.

This README is the complete reference for the project: how to run it, how to use it, the origami theory it implements, how the code is organized, how every algorithm works, and how to extend it.

---

## Contents

1. [Quick start](#1-quick-start)
2. [Using the app](#2-using-the-app)
3. [Box-pleating theory](#3-box-pleating-theory)
4. [Architecture overview](#4-architecture-overview)
5. [File-by-file guide](#5-file-by-file-guide)
6. [Data model and file format](#6-data-model-and-file-format)
7. [Algorithms in detail](#7-algorithms-in-detail)
8. [State, undo and gestures](#8-state-undo-and-gestures)
9. [Canvas, tools and rendering](#9-canvas-tools-and-rendering)
10. [Styling and design system](#10-styling-and-design-system)
11. [Testing](#11-testing)
12. [Extending the app](#12-extending-the-app)
13. [Limitations and known gaps](#13-limitations-and-known-gaps)
14. [Troubleshooting](#14-troubleshooting)
15. [Glossary](#15-glossary)
16. [References](#16-references)

---

## 1. Quick start

**Requirements:** Node.js **22.6 or newer** (the test runner uses Node's built-in TypeScript type stripping).

```sh
npm install
npm run dev        # start the dev server (Vite)
npm test           # run the core test suite
npm run typecheck  # type-check the whole project
npm run build      # type-check, then build into dist/
npm run preview    # serve the production build locally
```

| Script | What it runs | Notes |
| --- | --- | --- |
| `dev` | `vite` | Hot-reloading dev server. |
| `build` | `tsc --noEmit && vite build` | Fails on type errors. Output goes to `dist/`. |
| `preview` | `vite preview` | Serves `dist/`. |
| `typecheck` | `tsc --noEmit` | Checks `src/` and `tests/`. |
| `test` | `node --experimental-strip-types --no-warnings --test tests/*.test.ts` | No test framework needed. |

The production build uses a relative base path (`base: './'` in `vite.config.ts`), so `dist/` works from any folder or static host.

**Dependencies:** `lit` at runtime; `typescript`, `vite` and `@types/node` for development. Nothing else.

---

## 2. Using the app

### Screen layout

```
┌──────────────────────────── Top bar ─────────────────────────────┐
│ Pleatsmith  File ▾  name   ↶ ↷        Symmetry  Structure|M/V  Layers │
├────┬───────────────────────────────────────────┬─────────────────┤
│Tool│                                           │ Inspector        │
│rail│        Canvas: paper on a cutting mat     │ (selection)      │
│    │                                           ├─────────────────┤
│ V  │   status: coords + tool hint (top left)   │ Tree             │
│ F  │   legend (bottom left)  zoom (bottom right)│                 │
│ R  │                                           ├─────────────────┤
│ H  │                                           │ Checks           │
└────┴───────────────────────────────────────────┴─────────────────┘
```

On narrow screens (under 700 px) the tool rail moves above the canvas and the sidebar moves below it.

### Tools

| Tool | Key | How to use it |
| --- | --- | --- |
| **Select** | `V` | Click an element to select it; drag it to move it. A selected flap shows eight square handles; drag a handle **or anywhere on its outline** to resize. **Shift-drag** a handle to stretch the flap into a rectangular box instead: the dragged side follows the pointer, the opposite side stays put, and the length is kept. A selected river shows round handles (drag a segment sideways), square end handles (lengthen or shorten an end), and a diamond handle (change the width). Dragging empty paper pans the view. |
| **Flap** | `F` | Press on a grid point and **drag outward** to set the flap length as you create it. Pressing an existing flap tip moves that flap instead. |
| **River** | `R` | Click to place the start and each bend. Segments are forced horizontal or vertical. Double-click, press Enter, or click the last point again to finish. Escape cancels; Backspace removes the last point; `[` and `]` change the width while drawing. |
| **Pan** | `H` | Drag to move around. Hold **Space** and drag to pan from any tool. The middle mouse button also pans. |

The mouse wheel zooms around the cursor. The zoom widget (bottom right) zooms in, out, and fits the paper to the screen.

### Keyboard shortcuts

| Keys | Action |
| --- | --- |
| `V` `F` `R` `H` | Switch tool |
| Arrow keys | Nudge the selection by 1 unit (Shift: 4 units) |
| `+` / `=` / `]` | Grow the selection (flap length or river width) |
| `-` / `_` / `[` | Shrink the selection |
| Delete / Backspace | Delete the selection (and its mirror partner when symmetry is on) |
| Escape | Cancel the current tool action and clear the selection |
| `B` | Toggle book symmetry |
| `M` | Toggle structure / mountain-valley view |
| `0` | Fit the paper to the screen |
| Ctrl/Cmd + Z | Undo |
| Ctrl/Cmd + Shift + Z, Ctrl/Cmd + Y | Redo |

Shortcuts are ignored while you are typing in a text or number field. Space and Enter are left alone when a button or tree node has keyboard focus, so they activate that control.

### Panels

**Inspector** shows the selected item:

- **Nothing selected:** design name, grid size, book symmetry switch (plus "Make symmetric" if some elements lack a mirror), default width for new rivers, and counts (flaps by corner/edge/middle, drawn vs implied rivers, active paths).
- **Flap:** label, tip x/y (the tip's top-left corner for a box), tip size w × h (0 × 0 is a square flap; see [3.11](#311-rectangular-flaps-boxes)), length, shape (square or box with its outer size, cut by tangent sides when it is circle-packed), which tree node it hangs from, its symmetry status, "Make root", Delete. The x field is locked for a flap on the symmetry axis.
- **River:** label, width, which node each bank joins (clickable), number of bends, symmetry status, Delete.
- **Tree node:** label, number of edges, attached flaps and rivers, "Make root" or (if it is the root) "Choose root automatically".

**Tree** draws the inferred tree from its root:

- Hollow circles are flap tips (leaves); filled dots are internal nodes; the root has an amber ring.
- Black edges are flaps; thick blue edges are drawn rivers; dashed blue edges are implied rivers. Each edge is labelled with its length.
- "To scale" spaces nodes by true edge length; "Even rows" spaces them by depth.
- Click a node or edge to select it (selection is shared with the canvas). Double-click a node, or focus it and press Enter, to rename it.

**Checks** lists every issue, errors first. Each message says what is wrong and how to fix it. Click an issue to select the element it refers to, or to flash the location on the canvas. The footer summarizes the local fold checks.

### Top bar

- **File menu:** New design, Open file…, Save file, and the example designs.
- **Undo / Redo.**
- **Symmetry:** toggles book (left/right) symmetry.
- **Structure | Mountain/valley:** how creases are coloured.
- **Layers:** show or hide the grid, flaps and rivers, creases, labels, and problem markers.

### Views and colours

| Structure view | Meaning |
| --- | --- |
| Steel blue | Hinge |
| Plum | Ridge |
| Green | Axis (elevation 0) |
| Gold | Contour (elevation 1, 2, …) |
| Magenta dashed | Parity conflict |
| Amber hatching | Ambiguous cell |

| Mountain/valley view | Meaning |
| --- | --- |
| Red solid | Mountain |
| Blue dashed | Valley |
| Grey dotted | Unassigned (hinges, conflicts) |

Problem markers: magenta rings mark vertices failing Kawasaki; purple rings mark vertices failing only Maekawa.

A flap that fits only as a circle (see [3.10](#310-when-squares-dont-fit-circle-packing)) is drawn as its square with corners cut off by tangent lines, and its creases near those cuts run at the angle between the tips rather than along the grid. The "Flap circles" layer shows every flap's circle.

### Saving

- The design **autosaves** to the browser's localStorage (key `pleatsmith.design.v1`) about 400 ms after each change, and reloads on the next visit. With nothing saved, the app opens the Lizard example.
- **File → Save file** downloads `<design-name>.pleat.json`. **Open file…** loads one back (as an undoable step).

### Example designs

| Example | What it shows |
| --- | --- |
| Four corners | Four equal corner flaps on one hub, like a bird base. Symmetric. Passes all checks. |
| Five flaps | Four corner flaps plus a short middle flap. Shows local fold failures honestly (4 vertices). |
| Two groups and a river | Two columns of flaps separated by a drawn river of width 6. Symmetric. Passes all checks. |
| Lizard | Head, tail, four legs, and a body river of width 8. Symmetric. Passes all checks. |
| Box body | A body flap with an 8-unit tip (a 16 × 8 box) and four corner legs. Symmetric. Passes all checks. |

---

## 3. Box-pleating theory

This section explains the origami ideas the app implements. The method follows Robert J. Lang's treatment of box pleating in *Origami Design Secrets* (2nd ed., 2011, chapters 12–13) and his crease-pattern articles.

### 3.1 Uniaxial bases and trees

A **uniaxial base** is a folded form where every flap lies along a single line (the axis). It can be described by a **tree**: each **leaf** is a flap tip, each **edge** has a length, and internal **nodes** are where flaps branch. Designing a base means placing every flap tip on the paper so that the paper can be folded into that tree.

### 3.2 Why box pleating

In general ("circle/river") tree theory, each flap is a circle and paths are measured in straight lines, which leads to creases at arbitrary angles. **Box pleating** restricts everything to a square grid with creases only at 0°, 45° and 90°. That makes patterns easier to fold and reason about, at the cost of some paper efficiency. Distances are measured with the **Chebyshev (L∞) metric**:

```
cheb(a, b) = max(|a.x − b.x|, |a.y − b.y|)
```

### 3.3 Flaps are squares

A flap of length *r* is represented by a **square of side 2r centred on the flap tip** (the L∞ "circle" of radius *r*). A tip can sit:

- on a **corner** of the paper (uses the least paper),
- on an **edge**, or
- in the **middle** (uses the most paper).

### 3.4 Rivers are internal edges

An internal tree edge of length *w* is represented by a **river**: a strip of constant width *w* with horizontal and vertical banks. The flaps on one bank of the river belong to the subtree at one end of the edge; the flaps on the other bank belong to the subtree at the other end.

### 3.5 The path condition

For every pair of flaps *i* and *j*, the grid distance between their tips must be at least the distance between them along the tree:

```
cheb(tip_i, tip_j) ≥ r_i + r_j + (tree distance between their hubs)
```

A layout of non-overlapping squares and rivers satisfies this automatically. A pair that fails it on the grid but passes it with the **Euclidean** distance is still valid; see [3.10](#310-when-squares-dont-fit-circle-packing). Pairs where it holds with **equality** are **active paths**; they are where the paper is used fully and they determine much of the crease structure.

### 3.6 Crease types

| Crease | Where it appears |
| --- | --- |
| **Hinge** | Boundaries between flap squares and rivers. They become lines perpendicular to the axis in the folded base. |
| **Ridge** | 45° lines where the direction of the axis-parallel creases changes, e.g. the diagonals of each flap square and the corners where rivers bend. |
| **Axis** | The axis-parallel line through a flap tip (elevation 0). |
| **Axis-parallel contour** ("axial + N") | Lines at integer elevation N above the axis. They run perpendicular to the hinges and reflect across ridges. |

### 3.7 Elevation and mountain/valley parity

**Elevation** is a point's distance from the axis line through the tip of the flap that "owns" it. Lang's rule for box pleating: axial creases are mountains and axial+1 creases are valleys, alternating with parity. Ridges alternate mountain and valley along their length. Hinges can be mountain, valley, or flat depending on how the flaps are flattened, so they cannot be decided from geometry alone.

When contours coming from two different flaps meet with **different parity**, they cannot connect directly. Real designs fix this with a **level shifter** or by shifting a flap one unit. Pleatsmith marks such places as **conflicts**.

### 3.8 Local flat-foldability

At every interior vertex of a flat-foldable crease pattern:

- **Maekawa's theorem:** the number of mountains and valleys differ by exactly 2 (`|M − V| = 2`).
- **Kawasaki's theorem:** the alternating sum of the angles between consecutive creases is zero (alternate angles sum to 180°).

Both are **necessary but not sufficient**. Deciding whether a whole box-pleated pattern folds flat is NP-complete (Akitaya et al., "Box Pleating is Hard", 2015), so passing every local check does not prove a pattern folds. Always test by folding or in a simulator.

### 3.9 What full design tools add

Professional tools such as Box Pleating Studio add **stretch gadgets** (Pythagorean and generalized offset Pythagorean stretches) for flaps that must overlap efficiently, **level shifters**, **elevated (rectangular) flaps**, and **meandering rivers**. Pleatsmith does not generate these; see [Limitations](#13-limitations-and-known-gaps).


### 3.10 When squares don't fit: circle packing

The square is only box pleating's stand-in for a flap's true region, a **circle of radius *r*** (Lang's circle/river method). A square always contains its circle, so a flap can be too close to a neighbour for the squares while the circles still fit. Pleatsmith accepts that layout and switches to the general rules for that pair:

| Check | Box pleating (tried first) | Circle packing (fallback) |
| --- | --- | --- |
| Two flaps overlap | `cheb(tips) < r1 + r2` | `euclid(tips) < r1 + r2` (only this is an error) |
| Two flaps touch (share a hub) | `cheb(tips) = r1 + r2` | `euclid(tips) = r1 + r2` |
| A flap crosses a river | Its square overlaps the strip | Its circle overlaps the strip (only this is an error) |
| Path condition | `cheb(tips) ≥ r1 + r2 + hub distance` | `euclid(tips) ≥ r1 + r2 + hub distance` (only failing this is an error) |
| Implied river length | `cheb(tips) − r1 − r2` | `euclid(tips) − r1 − r2` (may be fractional) |

with `euclid(a, b) = √((a.x − b.x)² + (a.y − b.y)²)`. Euclidean distances are compared with a tolerance of 10⁻⁹, so Pythagorean placements such as tips offset by (3, 4) with `r1 + r2 = 5` touch exactly.

Each pair that passes only as circles (a **circle pair**) is listed as a `circle-packed` note in Checks. Circle pairs change the crease pattern locally:

- **Tangent sides.** Each flap in a circle pair gets an extra side: the line tangent to its circle, facing its partner (normal `u = (tip_partner − tip) / |…|`, at distance *r* from the tip). Its shape becomes the square cut by that line, the polygon circumscribing its circle. A flap whose square crosses a river corner while its circle clears it gets a tangent side facing that corner.
- **Off-grid contours.** On a tangent side, contours run parallel to `u`, at integer distances from the line through the two tips. That line is the axis (elevation 0), and the tangent through the contact point is the hinge. Both flaps share these lines, so contours continue straight across the hinge.
- **Ridges** run from the tip to each new corner of the shape, bisecting the two side normals, so contours reflect across them and Kawasaki holds where they meet. At the tip, every side contributes one axial ray and one ridge, and the interior-tip fix still balances Maekawa.

This is the same ownership-field method as box pleating ([7.7](#77-crease-generation-corecreasesfieldts-generatets)), with the square's four sides generalized to any set of tangent sides. When every side is axis-aligned it reduces exactly to the grid rules, so designs that fit on the grid get the same pattern as before. Where an off-grid region meets another flap's on-grid contours away from a tip, the contours generally don't line up. Those spots show as conflicts or local-check failures, just as box-pleating gaps that need a level shifter do. Real designs resolve them with **stretch gadgets** (e.g. Pythagorean stretches), which Pleatsmith does not generate.


### 3.11 Rectangular flaps (boxes)

A flap's tip can be a segment or a rectangle instead of a point: the **tip** runs from `(x, y)` to `(x + w, y + h)`, and the flap claims every point within *r* of it. In box pleating that region is a **box** of `(w + 2r) × (h + 2r)`; a plain flap is the case `w = h = 0`. This is the rectangular flap of Box Pleating Studio. A flap with a width-*w* segment tip folds into a **wide flap** whose tip is an edge *w* units long instead of a point, which is how bodies, heads and other broad parts are made.

Every distance that involved a tip point now uses the nearest point of the tip:

```
tipCheb(a, b)   = max(gap_x, gap_y)      gap_x = x-distance between the two tips' extents (0 if they overlap)
tipEuclid(a, b) = √(gap_x² + gap_y²)
```

Overlap, touching, implied rivers, the path condition and the circle-packing fallback ([3.10](#310-when-squares-dont-fit-circle-packing)) all use these. A box flap touching three others along its sides shares one hub with them, exactly as squares do.

**Creases.** The box is a square split open along the tip, with the tip's length inserted:

- **Ridges** run at 45° from each end of the tip to the box's corners, as the square's diagonals do from its tip.
- **The tip** is itself a ridge: the paper folds over along it, and contours cross it.
- **Elevation** is measured from the tip's top-left corner, plus the distance along the tip to the end that supports the nearest side. For a horizontal tip of width *w*, it is `|x − x0|` above and below the tip and `w + |y − y0|` to its right (`|y − y0|` to its left). So the band beside the tip is pleated at every unit like the rest, contours on both sides of each 45° ridge meet at equal elevations, and the far end of the tip sits at elevation *w*.
- The ridge along the tip alternates valley and mountain between contours, like any ridge. At the near end of the tip the usual tip fix ([7.7](#77-crease-generation-corecreasesfieldts-generatets)) balances Maekawa; the far end balances on its own.

A segment tip (width or height 0) folds flat locally: the **Box body** example passes every check. A tip with **both** width and height is a flat rectangle, like the lid of a box. Its inside has no creases and its outline is a hinge, so the contours that reach it stop there and its edges fail the local checks. Pleatsmith reports such flaps with a `flat-top` note; use them for a 3D box top, or set the width or height to 0 for a flat base.

---

## 4. Architecture overview

### 4.1 Data flow

Data flows in one direction:

```
pointer / keyboard
      │
      ▼
   Tool (editor/tools)  ──calls──▶  EditorController (state/editor.ts)
                                          │ applies pure edits
                                          ▼
                              core/model/operations.ts
                                          │ returns a new Design
                                          ▼
                              core/analyze.ts  (Design → Analysis)
                                          │
                                          ▼
                      AppState { design, analysis, ui, canUndo, canRedo }
                                          │ passed as properties
                                          ▼
                       Lit components re-render (components/)
```

### 4.2 Principles

- **The `Design` is the only thing a user authors.** The tree, crease pattern and issues are always derived from it by `analyze()`.
- **Core logic is pure.** Everything in `src/core/` is deterministic, has no DOM access, and is unit-tested.
- **Designs are immutable.** Every edit returns a new object; nothing is mutated in place. This makes undo trivial (keep old snapshots) and change detection cheap (compare references).
- **One gateway for changes.** Components never construct designs themselves; they call methods on `EditorController`.
- **Derived things have no stored identity.** Tree nodes are rebuilt after every edit, so anything users attach to them (labels, root choice) is stored against stable **ports** on user-authored elements (see [7.3](#73-ports-and-stable-identity)).

### 4.3 Directory structure

```
pleatsmith/
├── index.html               Entry HTML; loads Google Fonts and src/main.ts
├── package.json             Scripts and dependencies
├── tsconfig.json            Strict TypeScript settings
├── vite.config.ts           Vite build settings
├── public/favicon.svg       App icon
├── docs/
│   ├── ARCHITECTURE.md      Short architecture notes
│   └── THEORY.md            Short theory notes
├── tests/                   node:test suites for src/core
└── src/
    ├── main.ts              Imports global CSS and the root component
    ├── styles/tokens.css    Design tokens (colours, type, spacing)
    ├── core/                Pure logic, no DOM
    │   ├── analyze.ts       The pipeline: Design → Analysis
    │   ├── presets.ts       Example designs
    │   ├── geometry/        Points, rectangles, orthogonal polylines
    │   ├── model/           Design types, ids, ports, naming, operations, JSON
    │   ├── symmetry/        Book symmetry
    │   ├── tree/            Contacts, tree inference, tree layout
    │   ├── creases/         Ownership field, crease generation, merging
    │   ├── validation/      Issue types, local fold checks
    │   └── util/            Union-find
    ├── state/               Store, history, EditorController, persistence
    ├── editor/              Tools, hit testing, handles, viewport maths
    └── components/          Lit components and canvas layers
```

### 4.4 Why `.ts` extensions in imports

All imports use explicit `.ts` extensions (`import { cheb } from './point.ts'`). This lets Node run the core and tests directly with `--experimental-strip-types`, with no build step. `tsconfig.json` enables `allowImportingTsExtensions` and `noEmit` to allow it; Vite handles the extensions natively.

Because Node only **strips** types, code in `src/core/` must avoid TypeScript features that need a real transform: **no `enum`, no `namespace`, no constructor parameter properties** (`constructor(private x: number)`). Use string unions and explicit fields instead.

---

## 5. File-by-file guide

### 5.1 `src/core/geometry/`

| File | Contents |
| --- | --- |
| `point.ts` | `Point` type, `EPS = 1e-9`, `cheb` (L∞ distance), `euclid` (Euclidean distance), vector helpers (`add`, `sub`, `scale`, `dot`, `cross`, `length`, `normalize`, `perp`), `mirrorX(p, axis)`, `clamp`, `isInteger`, `samePoint`. |
| `rect.ts` | `Rect` (always normalized so `x0 ≤ x1`, `y0 ≤ y1`), `squareAround(c, r)` (a flap's square), `intersectRect`, `rectContact` (none / touch / overlap, with the contact midpoint), `containsOpen` (strict interior), `containsClosed`, `closestPointInRect`. |
| `flap-shape.ts` | A flap's tip and shape: `tipRect`, `flapRect` (its box), `tipCenter`, distances between tips (`tipGaps`, `tipCheb`, `tipEuclid`, `closestPoints`), `support`, `supportCorner` and `tipElevation` (see [3.11](#311-rectangular-flaps-boxes)); and its side normals: `AXIS_NORMALS` (the square), `sideNormals` (plus tangent sides), `tangentNormal`, `gauge` (the generalized `cheb − r` and the nearest side), `normalsByAngle`, `shapePolygon` (corners, for drawing). See [3.10](#310-when-squares-dont-fit-circle-packing). |
| `polyline.ts` | River centerline geometry: `stripSegments` (the rectangles a river occupies), `sideOf` (which bank a point is on), `isAtCap` (is a point against a flat end), `offsetPolyline` (shift sideways keeping it orthogonal), `snapToLattice`, `snapRiverPoints`, `normalizePolyline`, `orthogonalize`, `mirrorPolyline`, `mirrorIndex`, `translatePolyline`, `polylineBounds`, `samePolyline`, `isOrthogonalPolyline`. |

### 5.2 `src/core/model/`

| File | Contents |
| --- | --- |
| `types.ts` | `Design`, `Flap`, `River`, `SymmetrySettings`, `ElementRef`, `SCHEMA_VERSION`. |
| `design.ts` | `createDesign`, `normalizeDesign` / `normalizeFlap` / `normalizeRiver` (clamp to grid, snap rivers, drop dangling references), `symmetryAxis`, grid limits (`MIN_GRID = 2`, `MAX_GRID = 96`, `DEFAULT_GRID = 16`). |
| `ids.ts` | `createId('f' \| 'r')`: short unique ids like `f_lx3k2a7`. |
| `ports.ts` | Port keys (`flap:<id>`, `tip:<id>`, `river:<id>:a\|b`), `parsePort`, `portOwner`. |
| `naming.ts` | Display names (`flapName` → label or `F1`, `F2`…; `riverName` → label or `R1`…), `findFlap`, `findRiver`. |
| `operations.ts` | Every edit as a pure, symmetry-aware function. See [7.8](#78-edits-and-symmetry). |
| `serialize.ts` | `serializeDesign`, `parseDesign` (validates every field, normalizes, relinks mirrors). |

### 5.3 Other core modules

| File | Contents |
| --- | --- |
| `symmetry/book.ts` | `linkMirrors` (recompute every mirror link from geometry), `unpairedElements`, `makeSymmetric`, `isSelfMirror`, `mirrorsInPlace`, `isMirrorImage`, `mirrorFlap`. |
| `tree/types.ts` | `TreeNode`, `TreeEdge`, `TreeModel`, `CirclePair`, `nodeDisplayName`. |
| `tree/contacts.ts` | `riverGeometry`, `computeContacts`: which elements touch (producing port unions), which overlap, end-cap contacts, and flaps that cross a river corner only as squares (`circleCorners`). Also `CIRCLE_EPS` and `formatLength`. |
| `tree/infer-tree.ts` | `inferTree`: builds the tree and emits tree-related issues. Also exports `buildAdjacency` and `distancesFrom`. |
| `tree/layout.ts` | `layoutTree`: tidy positions for drawing the tree (`'scaled'` or `'depth'` mode). |
| `creases/types.ts` | `Crease`, `CreaseKind`, `Assignment`, `CreasePattern`. |
| `creases/field.ts` | `OwnershipField`: which flap owns each point, the contour direction there, and which element covers it. Also `elevationAt` and `parallel`. |
| `creases/generate.ts` | `generateCreases`: builds the candidate lines, splits them at their crossings, and classifies each piece as a hinge, axial, ridge or conflict; plus the interior-tip Maekawa fix. |
| `creases/merge.ts` | `mergeCreases`: joins collinear touching creases (any direction) into long lines for drawing. |
| `validation/issues.ts` | `Issue`, `IssueCode`, `Severity`, `IssueRef`, `sortIssues`. |
| `validation/flat-foldability.ts` | `checkLocalFoldability`: Maekawa and Kawasaki at every interior vertex. |
| `util/union-find.ts` | `UnionFind` over string keys with path compression and deterministic roots. |
| `analyze.ts` | `analyze(design)`: runs the whole pipeline and returns `Analysis`. |
| `presets.ts` | `PRESETS`, `findPreset`. |

### 5.4 `src/state/`

| File | Contents |
| --- | --- |
| `types.ts` | `AppState`, `UiState`, `Selection`, `ToolId`, `ViewMode`, `Layers`, `DEFAULT_UI`. |
| `store.ts` | `Store<T>`: minimal observable state (`state`, `set`, `update`, `subscribe`). |
| `history.ts` | `History<T>`: undo/redo stacks of snapshots (limit set by the controller to 250). |
| `editor.ts` | `EditorController`: the only API for changing the app. See [8](#8-state-undo-and-gestures). |
| `persistence.ts` | `loadSavedDesign`, `attachAutosave`, `downloadText`, `pickTextFile`, `fileNameFor`. |

### 5.5 `src/editor/`

| File | Contents |
| --- | --- |
| `viewport.ts` | `Viewport { centerX, centerY, scale }` (scale = pixels per grid unit, clamped 4–240), `fitViewport`, `viewBox`, `zoomAt` (keeps the point under the cursor fixed), `panBy`. |
| `handles.ts` | Positions of the selection handles: `flapHandles`, `riverHandles`, and `widthFromHandle`. Shared by rendering and hit testing so they always agree. |
| `hit-test.ts` | `hitTest(state, point, tolerance)` → what is under the pointer. |
| `tools/tool.ts` | The `Tool` and `ToolContext` interfaces, `ToolPointer`, and the `PanDrag` helper. |
| `tools/select-tool.ts` | Select, move, resize, river handle drags, pan on empty paper. |
| `tools/flap-tool.ts` | Press-and-drag flap creation; ghost preview. |
| `tools/river-tool.ts` | Click-to-draw rivers with orthogonal snapping and live preview. |
| `tools/pan-tool.ts` | Drag to pan. |
| `tools/index.ts` | `createTools()` and `TOOL_ORDER`. |

### 5.6 `src/components/`

| File | Contents |
| --- | --- |
| `bp-app.ts` | Root element. Creates the controller (from autosave or the Lizard preset), subscribes to it, attaches autosave, handles global keyboard shortcuts and toasts, lays out the shell. |
| `bp-topbar.ts` | File menu (native popovers), undo/redo, symmetry, view mode, layers. |
| `bp-toolrail.ts` | Tool buttons. |
| `bp-canvas.ts` | The editing canvas: pan/zoom, pointer routing to tools, layer rendering, legend, zoom widget, status bar. Public methods: `fitView()`, `zoomBy()`, `handleKey()`, `cancelTool()`. |
| `canvas/layers.ts` | Pure functions returning SVG templates for each layer. |
| `canvas/canvas-styles.ts` | All canvas CSS. |
| `bp-inspector.ts` | Properties of the selection or the design. |
| `bp-tree-view.ts` | Tree drawing, selection, inline renaming, fit-to-panel sizing. |
| `bp-checks.ts` | Issue list and fold-check summary. |
| `bp-number-field.ts` | Reusable integer stepper; fires `value-change`. |
| `icons.ts` | Inline SVG icons and the logo. |
| `shared-styles.ts` | Shared CSS for buttons, inputs and panel sections. |

---

## 6. Data model and file format

### 6.1 Types

```ts
interface Flap {
  id: string;
  x: number;           // tip's top-left corner, integer, 0..gridSize − w
  y: number;           //                                0..gridSize − h
  w: number;           // tip width, integer ≥ 0 (0 for a point tip)
  h: number;           // tip height, integer ≥ 0
  r: number;           // flap length = distance from the tip to the box's edge, integer ≥ 1
  label: string;
  mirrorId: string | null; // partner under book symmetry; own id if on the axis
}

interface River {
  id: string;
  points: Point[];     // orthogonal centerline (see 7.6 for the snapping lattice)
  width: number;       // integer ≥ 1 = length of the tree edge
  label: string;
  mirrorId: string | null; // own id if the river is its own mirror image
}

interface Design {
  schemaVersion: 2;   // 2 added flap w and h
  name: string;
  gridSize: number;    // paper is gridSize × gridSize units, 2..96
  flaps: Flap[];
  rivers: River[];
  symmetry: { book: boolean };
  nodeLabels: Record<PortKey, string>; // labels of internal tree nodes
  rootPort: PortKey | null;            // null = choose root automatically
}
```

**Coordinates:** grid units, origin at the top-left of the paper, **y grows downward** (screen convention).

### 6.2 Derived types

```ts
interface Analysis {
  rivers: RiverGeometry[];          // each river with its strip segments
  tree: TreeModel;
  pattern: CreasePattern | null;    // null when a blocking error exists
  foldability: FoldabilityReport | null;
  issues: Issue[];                  // sorted: errors, warnings, info
  flapCounts: { corner; edge; middle };
}

interface TreeModel {
  nodes: TreeNode[];                // kind 'hub' (internal) or 'leaf' (flap tip)
  edges: TreeEdge[];                // kind 'flap' | 'river' | 'implicit'
  rootKey: string | null;
  hubOfFlap: Map<flapId, nodeKey>;
  activePaths: number;                    // grid and circle pairs whose path condition is tight
  circlePairs: CirclePair[];              // pairs that fit only as circles: { a, b, distance, need, active }
  circleNormals: Map<flapId, Point[]>;    // tangent-side normals per flap (see 3.10)
}

interface Crease {
  x1; y1; x2; y2;                   // grid points, or off-grid points next to circle-packed flaps
  kind: 'hinge' | 'ridge' | 'axial' | 'conflict';
  mv: 'M' | 'V' | 'U';
  elevation?: number;
}
```

Node keys: internal nodes are `hub:<first port>`; leaves are `tip:<flapId>`.

### 6.3 File format

Saved files are JSON:

```json
{
  "format": "pleatsmith-design",
  "design": {
    "schemaVersion": 2,
    "name": "Lizard",
    "gridSize": 16,
    "flaps": [{ "id": "f_…", "x": 0, "y": 0, "w": 0, "h": 0, "r": 4, "label": "Front leg", "mirrorId": "f_…" }],
    "rivers": [{ "id": "r_…", "points": [{ "x": 0, "y": 8 }, { "x": 16, "y": 8 }], "width": 8, "label": "Body", "mirrorId": "r_…" }],
    "symmetry": { "book": true },
    "nodeLabels": {},
    "rootPort": null
  }
}
```

`parseDesign` accepts either this wrapper or a bare design object. It validates every flap and river, ignores unknown fields, **discards stored `mirrorId` values and recomputes them** from geometry, normalizes values to the grid, and rejects files with a newer `schemaVersion`. Version 1 files (before tip sizes) load with `w = h = 0`, and a flap missing `w` or `h` gets 0. Errors come back as readable messages.

---

## 7. Algorithms in detail

### 7.1 The analysis pipeline (`core/analyze.ts`)

```
analyze(design):
  1. Build river geometry (strip segments) for every river.
  2. Info issue if fewer than two flaps.
  3. Warning for every element without a mirror (symmetry on only).
  4. inferTree → tree + contact/tree issues.
  5. If any issue is blocking, stop: pattern = null.
  6. generateCreases(design, rivers, tree.circleNormals) → crease pattern.
  7. checkLocalFoldability on the unit creases.
  8. Warnings for conflicts, ambiguous cells and failing vertices
     (each lists up to 50 locations as point references).
  9. Count corner / edge / middle flaps.
 10. Sort issues by severity.
```

**Blocking issues** (pattern not generated): `flap-overlap`, `flap-river-overlap`, `river-overlap`. The two flap overlaps are measured with circles, so squares that overlap while their circles fit don't block ([3.10](#310-when-squares-dont-fit-circle-packing)).

### 7.2 Contacts (`core/tree/contacts.ts`)

Determines which elements touch, which overlap, and where.

**Flap–flap.** Using the Chebyshev distance *d* and the Euclidean distance *e* between tips (between the nearest points of rectangular tips, see [3.11](#311-rectangular-flaps-boxes)), and the needed spacing `r1 + r2`:
- `d = r1 + r2` → **touch**: union the two flap base ports (they share a node).
- `d < r1 + r2` (the squares overlap):
  - `e < r1 + r2` → **overlap** error (blocking): even the circles overlap.
  - `e = r1 + r2` (within `CIRCLE_EPS = 1e-9`) → the circles touch: union the ports.
  - otherwise the circles are apart; nothing to do here (tree inference finds the pair).

**Flap–river and river–river.** Each river is a list of rectangles (one per segment). Each pair of rectangles is classified by `rectContact`:
- **overlap** (positive area) → for a flap, measure from the tip to the nearest point of the strip rectangle. If the circle reaches inside, error (blocking). Otherwise the square only crosses a corner of the strip: record a **circle corner** (it gives the flap a tangent side), and if the circle touches the corner exactly, treat that corner as a touch point. Two rivers overlapping is always an error.
- **touch** (shared edge or corner) → look at the **contact midpoint**:
  - If it lies against a **flat end cap** (`isAtCap`), it is an end contact. End contacts do **not** connect anything; if that is the only contact, a `river-cap-contact` warning is emitted.
  - Otherwise `sideOf` says which bank (`a` or `b`) it touches, and the ports are unioned: the flap base with `river:<id>:<side>`, or the two river banks with each other.
- A flap touching **both** banks of one river → `river-self-loop` error.

### 7.3 Ports and stable identity

Tree nodes are rebuilt after every edit, so they cannot hold labels themselves. Instead, every user-authored element exposes **ports**:

| Port key | Meaning |
| --- | --- |
| `flap:<id>` | The base of a flap (where it attaches to its hub) |
| `tip:<id>` | The tip of a flap (the leaf) |
| `river:<id>:a` / `river:<id>:b` | One bank of a river (one end of its tree edge) |

Touching elements merge their ports into one node. Because ports belong to elements, they survive edits:

- **Labelling a node** stores the label on the node's **first** port and deletes labels on its other ports, so a node never carries two labels. When nodes merge, the merged node takes the first non-empty label among its ports.
- **Leaf labels** are simply the flap's `label`.
- **The root** is stored as a port (`rootPort`): a `tip:` port for a leaf root, or any port of an internal node.
- `normalizeDesign` drops labels and root references whose owning element no longer exists.

### 7.4 Tree inference (`core/tree/infer-tree.ts`)

```
1. Ports: add every flap base and both banks of every river to a union-find.
2. Union the ports of everything that touches (from contacts).
   Each resulting group is an internal node ("hub"), keyed hub:<first port>.
3. For each river, add an edge between the hubs on its two banks (length = width).
   - Both banks in the same hub → river-self-loop error (edge skipped).
   - The edge would close a cycle → tree-cycle error (edge skipped).
4. Implied rivers (Kruskal): for every flap pair compute
   gap = cheb(tips) − r_i − r_j, or, if that is negative (squares overlap),
   euclid(tips) − r_i − r_j; sort ascending. For each pair with gap > 0
   whose hubs are in different components, add an 'implicit' edge of length gap.
5. Leaves: one leaf node per flap (key tip:<id>) and a 'flap' edge of length r
   from the flap's hub.
6. Warn about river banks touching nothing (river-unattached).
7. Path condition: for every flap pair (skipping circle overlaps), compute
   need = r_i + r_j + tree distance between their hubs (BFS on the weighted
   tree).
   - cheb ≥ need → fine; if equal, count an active path.
   - else euclid ≥ need → a circle pair (circle-packed note); if equal,
     count an active path.
   - else → path-too-short error (reported in straight-line distance).
   Pairs with no tree path → one 'disconnected' warning.
   Each circle pair gives both flaps a tangent-side normal facing the other
   (circleNormals); each circle corner gives its flap one facing the corner.
8. Info for any hub with exactly two edges (redundant-node): it behaves like
   one longer edge.
9. Root: rootPort if it resolves; otherwise the hub with the most edges.
```

**Implied rivers** keep simple designs working without drawing every river: two groups of flaps separated by a gap are joined by an edge whose length is the gap. Drawn rivers take precedence because they are added first.

### 7.5 Tree layout (`core/tree/layout.ts`)

A tidy-tree layout from the root:
- Leaves get consecutive columns; a parent sits at the midpoint of its children's columns.
- Siblings are ordered by the mean `sortKey` of the leaves under them. The tree view's sort key is the flap's position on the paper (`x × 1000 + y`), so the tree reads roughly left-to-right like the paper.
- Vertical position is depth (`'depth'`) or cumulative edge length from the root (`'scaled'`).
- Disconnected pieces are laid out side by side with a half-column gap.

`bp-tree-view.ts` then shrinks columns (64 px down to 34 px) and row height to fit the panel, scrolls beyond that, and staggers leaf labels when columns are narrow.

### 7.6 River geometry (`core/geometry/polyline.ts`)

**Strip shape.** A river of width *w* covers every point within *w/2* of its centerline. Each segment contributes a rectangle extended by *w/2* across the segment and, **only at bends**, by *w/2* along it (filling the corner square). The two ends are **flat caps** with no extension.

**Sides.** For a segment from `a` to `b` with unit direction `dir`, a point `p` is on bank **A** if `cross(dir, p − a) > 0` and on bank **B** if it is negative. The normal toward bank A is `(−dir.y, dir.x)`. On screen (y down), bank A of a rightward river is **below** it. The side is consistent around bends, for both inner and outer corners (covered by tests).

**Snapping lattice.** Banks must lie on integer grid lines:
- **Even width:** the centerline sits on integers.
- **Odd width:** the centerline sits on half-integers.
- **Bends** are on the lattice in both coordinates.
- **Ends** are on the lattice across the river, but on an **integer along it**, so each end cap is a grid line. Rounding goes away from the neighbouring point so a river never shrinks.

**Offsetting.** `offsetPolyline(points, d)` shifts a centerline toward bank A by *d* (negative *d* toward B). Bends move diagonally by `d × (n_in + n_out)` (the two perpendicular normals), ends move only perpendicular to their segment. This keeps the line orthogonal and is how width changes keep one bank fixed.

### 7.7 Crease generation (`core/creases/field.ts`, `generate.ts`)

**The ownership field.** Each flap has a set of side normals: the square's four (`±x`, `±y`), plus one tangent side per circle pair or circle corner ([3.10](#310-when-squares-dont-fit-circle-packing)). For every point *p*, its owner is the flap whose shape boundary is nearest:

```
gauge(f, p) = max over side normals n of f of ((p − tip_f) · n) − r_f
owner(p)    = argmin over flaps of gauge(f, p)
```

Here the tip enters through its support, `support(T, n) = max over tip points t of t · n`, so the formula above is `max over n of (p · n − support(T, n)) − r_f`; for a point tip that is `(p − tip) · n`. With only the four axis normals, `gauge(f, p)` is the L∞ distance from *p* to the tip minus `r_f` (`cheb(p, tip_f) − r_f` for a point tip): the box-pleating metric. Inside a shape that shape's flap is the owner (shapes don't overlap in valid layouts). In rivers and open paper, the owner is the nearest bank's flap. From the owner:

- **Direction:** contours run along the normal `n` that attains the maximum (the owner's nearest side). For a square that is horizontal in its left and right wedges and vertical in its top and bottom wedges (ties on the diagonals go to vertical); beyond a square's sides contours continue across rivers. On a tangent side they run parallel to the line between the two tips.
- **Elevation** of *p* is its distance from the owner's axis line, the line through the tip along that direction: `|cross(n, p − tip)|`. For a square this is `|p.y − tip.y|` where contours are horizontal and `|p.x − tip.x|` where they are vertical. For a rectangular tip it is measured from the tip's top-left corner plus the distance along the tip to the corner that supports *n* (`tipElevation`, see [3.11](#311-rectangular-flaps-boxes)).
- **Ambiguity:** if another flap ties for the minimum gauge but disagrees on direction, the point is **ambiguous**.
- **Element:** `elementAt(p)` reports which flap tip (`t:<id>`, the inside of a tip with both width and height), flap shape (`f:<id>`) or river (`r:<id>`) covers *p* (strict interior), or `null` for open paper. A tip's outline is therefore a hinge, and pieces inside a tip get no crease.

**Candidate lines.** Every crease lies on one of these lines, clipped to the paper:

- the interior grid lines `x = 1 … n−1` and `y = 1 … n−1`;
- the cell diagonals `x − y = c` and `x + y = c`;
- for each tangent side with normal `u` of a flap: the contours parallel to `u` at integer offsets from the tip (clipped to the wedge where that side is nearest), and the tangent line itself;
- for each new corner of a cut shape: the ridge line from the tip through it (direction `n_i + n_j`).

**Arrangement.** Every line is split wherever it crosses another, giving **pieces**. Crossing points go through a point pool that merges points closer than 10⁻⁷ and snaps near-multiples of ½, so creases that meet at a vertex share identical coordinates (the local checks key vertices by exact coordinates). On a box-pleated design the pieces are exactly the unit grid segments and half cell diagonals.

**Classifying a piece.** The field is sampled on both sides of its midpoint: 0.25 units away for a unit grid segment (clear of half-unit ties), or 10⁻⁴ units away for any other piece and for grid segments next to a circle-packed flap (off-grid wedges near a tip can be much narrower than a quarter unit).

| Condition | Result |
| --- | --- |
| The two sides are in different elements | **Hinge** (`mv: 'U'`) |
| Both sides want contours parallel to this piece, at integer elevations with the same parity | **Axial** at elevation *e*, `M` if *e* even, `V` if odd |
| Both sides want contours parallel to this piece, at different parities (or only one at an integer elevation) | **Conflict** |
| Both sides want the same direction, not along this piece | No crease |
| The directions differ, and reflecting one across the piece gives the other | **Ridge** |
| The directions differ any other way | **Conflict** |
| The two sides are opposite sides of the same flap (along a segment tip) | **Ridge**, elevation as above |

A ridge's elevation *e* is the lower elevation of its two ends relative to the owner (the upper side's owner), along the owner's own contour direction. It is a **valley if *e* is even**, a mountain if odd. This makes ridges alternate along their length and meet contours consistently.

**On-grid cells** keep the original whole-cell ridge rule, so grid designs come out exactly as before. A half cell diagonal is classified by its cell: the cell is sampled at four points (north, east, south, west, 0.2 units in from its edges). If the direction flips across one diagonal (north = east ≠ south = west, or north = west ≠ south = east), that diagonal is a ridge. A cell where any of the four samples has an off-grid direction falls back to classifying its pieces individually.

**Interior tip fix.** At a flap tip strictly inside the paper (for a segment tip, at either end), each side contributes one valley ridge and one mountain axial ray (for a square, M = V = 4), which violates Maekawa. The elevation-0 axial ray running **right** from the tip, up to the shape's edge, is flipped to valley; if there is none (the left end of a horizontal tip, where the right-hand ray is the tip ridge), the first of down, left and up. The far end of a segment tip is balanced already (its rays sit at elevation *w*), so nothing is flipped there. Tips with both width and height are skipped: their corners are hinges.

**Ambiguous cells** are collected for any cell containing an ambiguous sample. **Merging** (`merge.ts`) groups creases by kind, assignment, elevation, direction and line (any angle), and joins consecutive ones, purely to reduce the number of SVG lines.

### 7.8 Edits and symmetry (`core/model/operations.ts`, `core/symmetry/book.ts`)

**Book symmetry** mirrors about the vertical line `x = gridSize / 2`. Mirror links are stored in `mirrorId`:
- A **paired** element points at its partner, and vice versa.
- An element **on the axis** points at itself: a flap whose tip is on the axis, or a river whose mirror image is itself.
- With symmetry off, all links are `null`.

`linkMirrors` recomputes every link from geometry (exact matches only) and is idempotent. It runs when symmetry is turned on, when the grid size changes, and after import.

| Operation | Behaviour |
| --- | --- |
| `addFlap` | Clamps to the grid. With symmetry: a tip on the axis links to itself; otherwise a partner is created at `gridSize − x − w`. |
| `moveFlap` | Rounds and clamps (the whole tip stays on the paper). A flap on the axis keeps its x. The partner moves to the mirrored position. |
| `setFlapTip` | Sets the tip's corner and size (`w`, `h` ≥ 0). The partner gets the mirrored tip (`x' = gridSize − x − w`). A flap on the axis stays centred: its width changes in steps that keep `gridSize − w` even. |
| `resizeFlap` | Clamps `1 ≤ r ≤ gridSize`. The partner gets the same length. |
| `setFlapLabel` | Only that flap (partners can have different labels, e.g. "left leg" and "right leg"). |
| `addRiver` | Normalizes the river (snap, merge collinear points); returns `id: null` if it has fewer than two distinct points. With symmetry, creates a mirrored partner unless the river is its own mirror image. |
| `translateRiver` | Integer deltas, clamped to keep the river on the paper. A self-mirrored river can only move vertically. |
| `moveRiverVertices` | Moves selected centerline vertices by an integer delta (used for segment and end drags). For a self-mirrored river, the mirrored vertices move by the mirrored delta. Rejected if the result is not orthogonal or leaves the paper. |
| `setRiverWidth` | Keeps **bank A** fixed by offsetting the centerline by `(oldWidth − newWidth) / 2`. Exception: a river lying **along the axis** (mirrors in place) widens evenly from its centre, in **steps of 2**, so both banks stay on grid lines. |
| `normalizeRiverById` | Tidies a river after a drag; deletes it if it collapses. |
| `deleteElements` | Removes elements; with symmetry on, partners go too. |
| `setGridSize` | Clamps 2–96, normalizes everything to the new grid, relinks mirrors. |
| `setBookSymmetry` | Turns symmetry on (linking existing mirrors) or off (clearing links). |
| `makeSymmetric` | Unpaired elements on the left half are copied to the right; unpaired elements on the right half are removed. Undoable. |
| `setNodeLabel` / `setRootPort` / `setName` | See [7.3](#73-ports-and-stable-identity). |

Every partner update **recomputes** the partner from the edited element (e.g. the partner's points are `mirrorPolyline` of the new points), so pairs cannot drift apart.

### 7.9 Local fold checks (`core/validation/flat-foldability.ts`)

```
For each unit crease, add a ray at each end (angle, assignment).
For each vertex strictly inside the paper:
  Kawasaki: the vertex must have an even number of rays, and the alternating
            sum of consecutive sector angles must be 0 (within 1e-6).
            All creases count, including unassigned hinges.
  Maekawa:  only if every crease is assigned: |2·M − total| must equal 2.
Report counts and every failing vertex.
```

### 7.10 Issue codes

| Code | Severity | Meaning |
| --- | --- | --- |
| `too-few-flaps` | info | Fewer than two flaps. |
| `flap-overlap` | error, blocking | Two flaps overlap even as circles. |
| `flap-river-overlap` | error, blocking | A flap crosses a river even as a circle. |
| `river-overlap` | error, blocking | Two rivers cross. |
| `river-cap-contact` | warning | Something touches only the end of a river. |
| `river-self-loop` | error | A river's two banks join the same node. |
| `tree-cycle` | error | A river closes a loop. |
| `river-unattached` | warning | A river bank touches nothing. |
| `disconnected` | warning | Part of the design is not connected to the rest. |
| `path-too-short` | error | Two flaps are closer in a straight line than in the tree (so they fail on the grid too). |
| `flat-top` | info | A flap's tip has both width and height: a flat box top, not flat-foldable around its edges. |
| `circle-packed` | info | Two flaps (or a flap and a river corner) fit only as circles; their creases run off the grid. |
| `redundant-node` | info | A node with exactly two edges. |
| `parity-conflict` | warning | Contours don't line up (needs a shift or a level shifter). |
| `ambiguous-region` | warning | Cells not clearly owned by one flap. |
| `asymmetric` | warning | An element has no mirror (symmetry on). |
| `local-foldability` | warning | Vertices fail Kawasaki or Maekawa. |

Each issue carries `refs` (flaps, rivers, nodes or points) so the Checks panel can reveal it.

---

## 8. State, undo and gestures

### 8.1 `AppState`

```ts
interface AppState {
  design: Design;      // what the user authored
  analysis: Analysis;  // derived, recomputed when design changes
  ui: UiState;         // tool, selection, view mode, layers, etc. (not undoable)
  canUndo: boolean;
  canRedo: boolean;
}
```

`UiState` holds the active tool, the selection (`flap`, `river` or `node`), a `focusPoint` (flashed by the Checks panel), the view mode, layer visibility, the default width for new rivers (default 2), and the tree layout mode (default `'scaled'`). UI changes are never recorded in undo history.

### 8.2 `EditorController`

All changes go through it. Main command groups:

- **Plumbing:** `apply(op)`, `beginGesture()`, `previewGesture(op)`, `endGesture(finalize?)`, `cancelGesture()`, `undo()`, `redo()`.
- **UI:** `setTool`, `select`, `focusPoint`, `setViewMode`, `toggleLayer`, `setRiverDrawWidth`, `setTreeLayout`.
- **Flaps:** `addFlap`, `moveFlap`, `resizeFlap`, `setFlapTip`, `setFlapLabel`.
- **Rivers:** `addRiver`, `setRiverWidth`, `setRiverLabel`, `translateRiver`.
- **Selection-wide:** `deleteSelection`, `nudgeSelection`, `growSelection`.
- **Tree:** `setNodeLabel` (leaves route to the flap label), `setRoot` (`null` = automatic).
- **Design:** `setName`, `setGridSize`, `setBookSymmetry`, `makeSymmetric`, `loadDesign`, `newDesign`, `loadPreset`, `importJson` (returns an error message or `null`), `exportJson`.

### 8.3 Undo model

- `apply(op)` runs a pure operation. If the design changed, the **previous** design is pushed onto the history and the new one is analysed and published. One call = one undo step.
- **Gestures** make a whole drag one undo step:
  1. `beginGesture()` remembers the design at the start (the *base*).
  2. `previewGesture(op)` runs `op(base)` on **every pointer move**: always from the base, never from the previous preview, so rounding never accumulates.
  3. `endGesture(finalize?)` optionally tidies the result (e.g. normalizes a river) and records the base as a single undo step, but only if something changed.
  4. `cancelGesture()` restores the base.
- Calling `apply` during a gesture applies the edit to the current design and joins the gesture's undo step.
- Undo/redo are ignored during a gesture. History keeps 250 steps.
- After every design change, the selection is validated: if the selected element or node no longer exists, it is cleared.

### 8.4 Persistence

`attachAutosave` subscribes to the controller and writes `serializeDesign(design)` to localStorage 400 ms after the last design change. Failures (full or disabled storage) are ignored. `loadSavedDesign` reads it back through `parseDesign` on startup.

---

## 9. Canvas, tools and rendering

### 9.1 Coordinates and viewport

The canvas SVG uses **grid units** directly as its coordinate system. The viewport (`centerX`, `centerY`, `scale` in pixels per unit) becomes the SVG `viewBox`. Pointer positions are converted with:

```
gridX = centerX + (clientX − canvasLeft − canvasWidth / 2) / scale
gridY = centerY + (clientY − canvasTop  − canvasHeight / 2) / scale
```

Stroke widths stay constant on screen with `vector-effect: non-scaling-stroke`. Sizes that must be constant in pixels (text, handles, markers) use `px = 1 / scale`. The view refits automatically when the grid size changes. A `ResizeObserver` tracks the canvas size.

### 9.2 Render order (bottom to top)

1. Paper (with drop shadow)
2. Clipped to the paper: flap shapes (squares, or cut squares for circle-packed flaps) and rivers → grid → flap circles → ambiguous cells → creases (hinges, then axials, ridges, conflicts)
3. Paper outline
4. Symmetry axis (amber dashed)
5. Problem markers and focus ring
6. Labels (flap tips with name and length, root ring, river names)
7. Selection handles
8. Active tool overlay (ghost flap, river draft)

Each layer is a pure function in `canvas/layers.ts`. Flaps are tinted in two alternating colours by hub, so groups that share a node are easy to see. Selected elements are amber; mirror partners of the selection get a dashed amber outline; flaps in errors are red. In the mountain/valley view the layout fades back to plain paper.

### 9.3 Hit testing priority (`editor/hit-test.ts`)

Tolerance is 8 screen pixels converted to grid units.

1. **Handles of the selected element.** Flap: corner and edge handles of its box, then anywhere within tolerance of the box's outline (all resize; with Shift held at press, they stretch the tip instead). River: width handle, then end handles, then segment handles.
2. **Flap tips** (nearest within tolerance, minimum 0.3 units; anywhere along a rectangular tip, or its centre dot).
3. **River strips** (rivers are narrow, so they win over squares).
4. **Flap boxes**, smallest area first (so overlapping boxes remain selectable).

### 9.4 Tools

Tools implement:

```ts
interface Tool {
  id; label; shortcut; hint;              // hint shows in the status bar
  onPointerDown(p, ctx); onPointerMove(p, ctx); onPointerUp(p, ctx);
  onPointerLeave?(ctx); onDoubleClick?(p, ctx);
  onKeyDown?(e, ctx): boolean;            // return true if handled
  cancel?(ctx);                           // tool switch or Escape
  cursor(hover, ctx): string;
  overlay?(ctx): SVG template;            // drawn on top of the canvas
}
```

`ToolContext` gives tools the controller, the current state, the hit tolerance, `hitTest`, `panBy` and `requestUpdate`. Tools hold their own transient state (e.g. the river tool's points).

**Select tool drags:**

| Drag | Effect |
| --- | --- |
| Flap body or tip | Move by the rounded pointer delta. |
| Flap handle or outline | `r = round(max(|dx|, |dy|))` from the tip. |
| River body | Translate by the rounded delta. |
| Segment handle | Move both vertices of that segment perpendicular to it. |
| End handle | Slide the end vertex along its segment. |
| Width handle | `width = round(distance from bank A)` (via `widthFromHandle`). |
| Empty paper | Pan. |

River drags are tidied with `normalizeRiverById` when they end.

**Flap tool:** on press, a flap of length 1 is added inside a gesture; dragging resizes it from that created state; releasing ends the gesture (one undo step). **River tool:** each click snaps to the lattice for the current width and is forced orthogonal to the previous point; finishing normalizes the points and calls `addRiver`.

### 9.5 Keyboard routing

`bp-app` listens on `window`. It skips keys aimed at inputs (and Space/Enter on focused buttons and tree nodes), then offers the key to `bp-canvas.handleKey`, which handles Space for temporary panning and forwards everything else to the active tool. Unhandled keys fall through to the global shortcuts.

### 9.6 Lit conventions used

- No decorators. Reactive properties are declared with `static properties = { … }` plus `declare` fields, with defaults set in the constructor. `tsconfig.json` sets `useDefineForClassFields: false` so class fields never shadow Lit's accessors.
- Parent → child data is passed as properties (`.state=${s} .editor=${e}`); children call controller methods instead of emitting events. The only custom events are `value-change` (number field) and `app-toast`.
- Menus use the native `popover` attribute and are positioned under their trigger on `beforetoggle`/`toggle`.
- Each component registers itself with `customElements.define` and augments `HTMLElementTagNameMap`.

---

## 10. Styling and design system

All colours, type and spacing are CSS custom properties in `src/styles/tokens.css`. They inherit into every shadow root, so **this file is the one place to retheme the app**.

**Concept:** a sheet of paper on a green cutting mat. The mat is the workspace, the chrome around it is quiet and light, and amber (the colour of a cutting mat's ruler markings) marks selection. Mountain red and valley blue follow the convention of origami crease-pattern software.

| Token group | Examples |
| --- | --- |
| Chrome | `--ink #1e2422`, `--ink-2`, `--ink-3`, `--line`, `--panel #f3f4f0`, `--surface #fff` |
| Workspace | `--mat #22433b`, `--paper #fbfaf6`, `--grid` |
| Selection | `--accent #e2a12b`, `--accent-soft`, `--accent-ink` |
| Layout fills | `--flap-fill`, `--flap-fill-alt`, `--river-fill`, `--river-line` |
| Structure creases | `--c-hinge`, `--c-ridge`, `--c-axis`, `--c-axial`, `--c-conflict` |
| M/V creases | `--c-mountain #d1342f`, `--c-valley #2f5fd0`, `--c-unassigned` |
| Status | `--error`, `--warning`, `--info`, `--ok` (+ `-soft` backgrounds) |
| Type | `--font` (Hanken Grotesk, with a system fallback), `--fs-xs` … `--fs-xl` |
| Spacing and layout | `--space-1` … `--space-5`, `--radius`, `--topbar-h 52px`, `--rail-w 56px`, `--sidebar-w 352px` |

Hanken Grotesk is loaded from Google Fonts in `index.html`; without network access the system font is used. Keyboard focus is shown with an amber ring (`--focus`). `prefers-reduced-motion` disables transitions and animations.

---

## 11. Testing

```sh
npm test
```

Tests live in `tests/` and use Node's built-in `node:test` and `node:assert/strict`. They import source files directly (no build), which is why `src/core/` follows the type-stripping rules in [4.4](#44-why-ts-extensions-in-imports).

| Suite | Covers |
| --- | --- |
| `geometry.test.ts` | Chebyshev and Euclidean distance, distances and elevation for rectangular tips, flap shapes cut by tangent sides (gauge and corners), rectangle contacts (touch, corner touch, overlap), polyline normalization, strip shapes (flat caps, filled corners), side consistency around bends, end-cap detection, offsetting, lattice snapping. |
| `operations.test.ts` | Mirrored add/move/resize/delete, rectangular tips mirroring and widening on the axis, tip sizes saved and version 1 files loading, axis flaps, linking existing mirrors and "make symmetric", mirrored and self-mirrored rivers, width changes keeping bank A, axis rivers widening in steps of 2, symmetric segment drags, node labels stored on one port. |
| `analysis.test.ts` | Presets have no errors; a segment-tip box flap touches its neighbours, passes every local check and has an alternating tip ridge; a tip with width and height is a flat top with a `flat-top` note; box flaps fit as circles from the nearest point of the tip; the clean presets pass every local check; touching flaps share a hub; drawn rivers become edges; implied rivers; circle overlaps blocking; flaps crossing rivers; path-condition violations; circle packing (overlapping squares with touching circles share a hub, the active path becomes the axis and the shared tangent the hinge, the tip passes local checks; a short grid path that fits as circles; a square crossing a river corner); labels and root surviving re-analysis. |

There are currently **39 tests**. UI components have no automated tests; they were checked visually and with scripted mouse interaction in a headless browser.

**Suggested way to test a new core feature:** write the pure function and a test first, run `npm test`, then wire it into the controller and UI.

---

## 12. Extending the app

### Add an edit

1. Write a pure function `(design, …) => Design` in `core/model/operations.ts`. Return the **same object** when nothing changes (so no empty undo steps). Handle mirror partners if symmetry is on.
2. Add a test in `tests/operations.test.ts`.
3. Add a thin method on `EditorController` that calls `this.apply(...)`.
4. Call it from a component, tool or shortcut.

### Add a tool

1. Implement `Tool` in `src/editor/tools/<name>-tool.ts`. Use `ctx.editor.beginGesture()` / `previewGesture()` / `endGesture()` for drags.
2. Add the id to `ToolId` in `state/types.ts`.
3. Register it in `createTools()` and `TOOL_ORDER` (`tools/index.ts`).
4. Add an icon in `components/icons.ts` (key = tool id) and an entry in `TOOL_INFO` in `bp-toolrail.ts`.
5. Add its shortcut to `TOOL_KEYS` in `bp-app.ts`.

### Add a check

1. Add the code to `IssueCode` in `core/validation/issues.ts`.
2. Emit the issue from the stage that detects it (`contacts.ts`, `infer-tree.ts`, or `analyze.ts`). Write the message as what is wrong plus how to fix it. Include `refs` so it can be revealed. Set `blocking: true` only if crease generation cannot run.
3. Add a test.

### Add a crease feature (level shifters, stretches)

Generation lives in `core/creases/generate.ts`. Conflicts and ambiguous cells already mark where such gadgets would be needed. A gadget would typically replace the creases inside a region (e.g. the cells around a conflict) after the main pass, then the fold checks run as usual.

### Add an element type (e.g. hexagonal or 22.5° molecules)

1. Add it to `Design` in `core/model/types.ts`, plus normalization in `design.ts` and parsing in `serialize.ts` (bump `SCHEMA_VERSION` and handle older files).
2. Give it ports in `ports.ts`.
3. Teach `tree/contacts.ts` how it touches other elements, and `creases/field.ts` how it owns space.
4. Add operations, symmetry handling, hit testing, handles, a renderer in `canvas/layers.ts`, and inspector UI.

### Change the file format

Bump `SCHEMA_VERSION` in `types.ts`, and in `parseDesign` convert older versions before normalizing. Files from newer versions are rejected with a clear message.

### Rename the app

The name appears in `package.json`, `index.html` (`<title>`), `bp-topbar.ts` (wordmark), the localStorage key in `persistence.ts`, the file format string in `serialize.ts`, the `.pleat.json` extension in `persistence.ts`, and this README. Changing the storage key or format string makes old autosaves or files unreadable unless you add a fallback.

---

## 13. Limitations and known gaps

**Generator scope.** Pleatsmith handles uniaxial box pleating with integer flap lengths, integer river widths, flaps that touch, and rivers that run straight or bend at right angles. It does **not** generate:

- Pythagorean or generalized offset Pythagorean stretches,
- level shifters,
- half-unit structures,
- meandering rivers.

Those situations appear as conflicts, ambiguous cells or warnings instead of invented creases.

**Circle packing is local.** A flap that fits only as a circle gets off-grid creases from its tangent sides ([3.10](#310-when-squares-dont-fit-circle-packing)). The structure along each circle pair's path (axis, hinge, ridges to the cut corners, tip) is consistent and passes the local checks. Where the off-grid region meets on-grid contours of other flaps, or a fractional implied river, it usually doesn't; that would take a stretch gadget. Off-grid creases also make the pattern harder to fold precisely, so prefer moving a flap one unit when the grid allows it.

**Mountain/valley.** Hinges are always unassigned. The parity heuristic plus the interior-tip fix is not a full assignment solver, and some vertices next to hinges may fail Kawasaki or Maekawa until hinges are assigned by hand.

**Checks are local.** Passing Maekawa and Kawasaki everywhere does not prove the pattern folds flat. Verify in a folding simulator (e.g. ORIPA, Oriedita, Flat-Folder) or on paper.

**Tree inference heuristics.**
- Implied rivers join groups by smallest gap; they can't represent a branch point where three or more groups meet with non-integer edge lengths (those show up as path violations).
- A river touched by a single flap on one bank is equivalent to one longer flap (reported as a redundant node).
- End caps never connect anything; rivers should run to the paper edge or wrap along their flaps.

**Editing.** One element can be selected at a time (no multi-select or marquee yet). Rivers can't be split or joined, only redrawn. The analysis reruns on every drag step; very large grids with many flaps may feel slower, and circle-packed flaps add many off-grid lines (a 96-unit grid with several large circle pairs takes about 150 ms per analysis).

**Not yet verified with the real dependencies.** At the time of writing the app had been type-checked and rendered in a headless browser using a stand-in for Lit, because the real packages couldn't be installed in the environment where it was built. Expect possibly small fixes the first time it runs with `npm install` and `npm run dev`.

**Ideas for future work:** multi-select; hinge M/V assignment (e.g. a search over interleaved and symmetric hinge assignments); level-shifter gadgets; pleating the inside of a rectangular tip so boxes with both width and height fold flat; export to SVG and ORIPA's `.opx` / `.cp` formats; diagonal symmetry; a folded-preview view; component tests.

---

## 14. Troubleshooting

| Symptom | Likely cause and fix |
| --- | --- |
| `npm test` fails with an unknown flag or syntax error | Node is older than 22.6. Upgrade Node. |
| `npm test` fails with "TypeScript syntax not supported" | A core file uses an enum, namespace or constructor parameter property. Replace it (see [4.4](#44-why-ts-extensions-in-imports)). |
| Type errors about `.ts` imports | `allowImportingTsExtensions` and `noEmit` must stay enabled in `tsconfig.json`. |
| A component property is always `undefined` | It's declared as a class field with an initializer instead of `declare` + `static properties`, or `useDefineForClassFields` was changed. |
| The app opens an old design | That's the autosave. Use File → New design, or clear the `pleatsmith.design.v1` localStorage entry. |
| No crease pattern appears | A blocking error (an overlap, measured with circles). The Checks panel names it; click it to select the culprit. |
| Creases at odd angles | A flap fits only as a circle next to a neighbour (a `circle-packed` note in Checks). Move it apart on the grid to get a pure box-pleated pattern. |
| Pink dashed lines | Parity conflicts: shift one of the flaps involved by one unit, or the spot needs a level shifter. |
| Amber-hatched cells | Paper no single flap clearly owns. Fill the gap with a flap or a river. |
| A river won't widen by 1 | It lies along the symmetry axis, so it widens in steps of 2 to keep its banks on the grid. |
| A flap's x field is greyed out | The flap is on the symmetry axis and must stay there. |
| Fonts look different | Google Fonts couldn't load; the system font is used instead. |

---

## 15. Glossary

| Term | Meaning |
| --- | --- |
| **Active path** | A flap pair whose grid distance equals its tree distance. |
| **Axis** | The line a uniaxial base's flaps lie along; elevation 0. |
| **Axis-parallel contour** ("axial + N") | A crease at constant elevation N. |
| **Bank A / Bank B** | The two sides of a river; A is left of travel in math coordinates (below a rightward river on screen). |
| **Book symmetry** | Left/right mirror symmetry about the vertical centre line. |
| **Chebyshev / L∞ distance** | `max(|dx|, |dy|)`: the metric of box pleating. |
| **Circle pair** | Two flaps too close for their squares but far enough apart for their circles; their creases use tangent sides and run off the grid. |
| **Conflict** | Where neighbouring contours disagree in parity or orientation. |
| **Elevation** | Distance from the owner flap's axis line. |
| **End cap** | The flat end of a river; it doesn't connect anything. |
| **Flap** | A leaf of the tree; drawn as the box of points within its length of its tip (a square of side 2 × length for a point tip). |
| **Box flap / rectangular flap** | A flap whose tip is a segment or rectangle (width and height); a segment tip makes a wide flap. |
| **Gesture** | A drag recorded as a single undo step. |
| **Hinge** | A crease on a boundary between flap squares and rivers. |
| **Hub** | An internal tree node: a group of touching ports. |
| **Implied river** | A tree edge added automatically for a gap between groups. |
| **Kawasaki's theorem** | Alternate angles around a flat-foldable vertex sum to 180°. |
| **Lattice** | Valid centerline coordinates for a river (integers for even widths, half-integers for odd). |
| **Level shifter** | A gadget that changes contour parity; not generated here. |
| **Maekawa's theorem** | Mountains and valleys at a flat-foldable vertex differ by 2. |
| **Ownership field** | Assignment of every point to the flap with the nearest shape boundary (its square, or the square cut by tangent sides). |
| **Path condition** | `cheb(tips) ≥ tree distance` for every flap pair, or failing that `euclid(tips) ≥ tree distance` (circle packing). |
| **Tangent side** | A side added to a flap's square: the line tangent to its circle facing a neighbour it only fits next to as a circle. |
| **Port** | A stable handle on where a node comes from: a flap base, flap tip, or river bank. |
| **Ridge** | A 45° crease where contour direction changes. |
| **River** | An internal tree edge drawn as a strip of constant width. |
| **Root** | The node the tree is drawn from. |
| **Uniaxial base** | A folded base whose flaps all lie along one axis, described by a tree. |

---

## 16. References

- Robert J. Lang, *Origami Design Secrets: Mathematical Methods for an Ancient Art*, 2nd ed., CRC Press, 2011. Chapter 12 (box pleating) and chapter 13 (uniaxial box pleating).
- Robert J. Lang, "Crease Pattern: Cicada Nymph", *The Fold* (OrigamiUSA), 2011. A worked example of designing a box-pleated crease pattern.
- Robert J. Lang, "Crease Patterns as Art", langorigami.com.
- Erik Demaine, MIT 6.849 *Geometric Folding Algorithms* (Fall 2012), lectures on tree method and box pleating.
- H. Akitaya, K. Cheung, E. Demaine, T. Horiyama, T. Hull, J. Ku, T. Tachi, R. Uehara, "Box Pleating is Hard", JCDCGG 2015 (LNCS 9943).
- E. Demaine, S. Fekete, R. Lang, "Circle Packing for Origami Design Is Hard", *Origami⁵*, 2011.
- R. Lang and M.-T. Tsai, "Generalized Offset Pythagorean Stretches in Box-Pleated Uniaxial Bases", *Origami⁷*, 2018.
- Box Pleating Studio (Mu-Tsun Tsai), bp-studio.github.io: a full box-pleating design tool with stretch gadgets.
- ORIPA, Oriedita, Flat-Folder: crease-pattern editors and flat-folding solvers for verifying patterns.
