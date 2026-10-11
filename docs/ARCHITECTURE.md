# Architecture

Data flows one way:

```
user input ─▶ tool ─▶ EditorController ─▶ core/model/operations ─▶ Design
                                                                     │
components ◀── AppState { design, analysis, ui } ◀── core/analyze ◀──┘
```

## Layers

**`src/core/` (pure TypeScript, no DOM).** Everything here is deterministic
and unit-tested. It runs directly in Node via type stripping, which is why
imports use explicit `.ts` extensions and the code avoids TypeScript-only
runtime syntax (enums, parameter properties).

- `geometry/`: points, rectangles, and orthogonal polylines (river
  centerlines). The Chebyshev (L∞) metric is used throughout.
- `model/`: the `Design` type (the only thing a user authors), id and naming
  helpers, normalization, JSON import/export, and `operations.ts`: every edit
  as a pure function `Design -> Design`. Operations are symmetry-aware.
- `symmetry/book.ts`: linking mirror partners, "make symmetric".
- `tree/`: contact detection (`contacts.ts`), tree inference
  (`infer-tree.ts`) and display layout (`layout.ts`).
- `creases/`: the ownership field (`field.ts`), crease generation
  (`generate.ts`) and merging unit creases into lines for drawing.
- `validation/`: issue types and local flat-foldability checks.
- `analyze.ts`: the pipeline `Design -> Analysis`.

**`src/state/`.** `EditorController` is the only way to change the app.
Every design edit is either one undo step (`apply`) or a gesture
(`beginGesture` → `previewGesture`… → `endGesture`), which records the whole
drag as one step. Previews are always applied to the design as it was when
the gesture began, so drags never accumulate rounding drift. The analysis is
recomputed whenever the design object changes.

**`src/editor/`.** Canvas interaction, independent of rendering details:
`tools/` (one class per tool, all implementing `Tool`), `hit-test.ts`,
`handles.ts` (handle positions shared by the renderer and hit tester) and
`viewport.ts` (pan/zoom maths).

**`src/components/`.** Lit components. `bp-app` owns the controller and
passes `state` and `editor` down as properties; components read state and
call controller commands, and never construct designs themselves. The canvas
draws pure layer functions from `canvas/layers.ts`.

## Identity of derived things

The tree is rebuilt after every edit, so internal nodes have no stored
identity. Each node is made of **ports** (`model/ports.ts`): a flap's base,
or one bank of a river. Ports belong to user-authored elements, so they
survive edits. Node labels and the root choice are stored against a port,
and a node takes the label of any of its ports.

## Extending

- **New edit:** add a pure function to `core/model/operations.ts` with a
  test, then a thin method on `EditorController`.
- **New tool:** implement `Tool` in `editor/tools/`, register it in
  `tools/index.ts`, and add its icon and label in `bp-toolrail.ts`.
- **New check:** add an `IssueCode` in `validation/issues.ts` and emit the
  issue from `analyze.ts` (or from the stage that detects it). Give it
  `refs` so the checks list can reveal it.
- **New crease feature (e.g. level shifters, Pythagorean stretches):**
  generation lives in `creases/generate.ts`. Conflicts and ambiguous cells
  already mark the places such gadgets would go.
- **New element type (e.g. rectangular flaps):** add it to `Design`,
  give it ports, teach `contacts.ts` how it touches other elements and
  `field.ts` how it owns space.
- **Theme:** all colours and type live in `styles/tokens.css`.

## Persistence format

Files are JSON: `{ "format": "pleatsmith-design", "design": { … } }` with
`schemaVersion` inside the design. `core/model/serialize.ts` validates and
normalizes anything it reads; bump `SCHEMA_VERSION` and add a migration
there when the format changes.
