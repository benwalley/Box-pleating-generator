# Pleatsmith

A browser app for designing box-pleated origami. You lay out flap squares
and rivers on a grid; Pleatsmith infers the tree (stick figure), generates
the crease pattern, and checks it.

Built with [Lit](https://lit.dev) and [Vite](https://vite.dev), in
TypeScript, with no other runtime dependencies.

## Getting started

```sh
npm install
npm run dev        # start the dev server
npm test           # run the core test suite (Node 22.6+)
npm run typecheck  # type-check everything
npm run build      # production build into dist/
```

## Using it

| Tool   | Key | What it does |
| ------ | --- | ------------ |
| Select | V   | Click to select, drag to move. Drag a selected flap's handles or outline to resize it. Drag empty paper to pan. |
| Flap   | F   | Press on a grid point and drag outward to size the new flap. |
| River  | R   | Click to place bends, double-click or Enter to finish. `[` and `]` change the width. |
| Pan    | H   | Drag to move around. Space+drag pans from any tool. |

Other shortcuts: arrows nudge the selection (Shift for 4 units), `+`/`-`
resize it, Delete removes it, `B` toggles book symmetry, `M` toggles the
mountain/valley view, `0` fits the paper to the screen, Ctrl/Cmd+Z undoes,
Ctrl/Cmd+Shift+Z redoes.

- **Rivers** sit between groups of flaps. Every flap touching bank A hangs
  from one end of the river's tree edge, every flap touching bank B from the
  other. Gaps between groups that you don't fill with a river are joined by
  implied rivers.
- **Symmetry** mirrors left and right. With it on, every edit applies to the
  mirror partner too; "Make symmetric" pairs up an existing design.
- **Tree** shows the inferred tree. Double-click a node to label it, and use
  "Make root" in the inspector to choose which node the tree hangs from.
- **Checks** lists problems, each with how to fix it. Click one to jump to it.

The design autosaves in the browser. File → Save file downloads it as JSON.

## What the generator can and can't do

It handles uniaxial box pleating with integer flap lengths and integer river
widths: flaps that touch, and rivers that run straight or bend at right
angles. It does not generate Pythagorean stretches, level shifters,
elevated (rectangular) flaps or meandering rivers; those situations show up
as conflicts or warnings rather than invented creases. Hinges are left
unassigned. Mountain/valley checks are local (Maekawa and Kawasaki) and
can't prove a pattern folds flat, so test a real fold before trusting one.
See [docs/THEORY.md](docs/THEORY.md).

## Project layout

```
src/
  core/        pure logic, no DOM: geometry, model, tree, creases, checks
  state/       store, undo history, EditorController, persistence
  editor/      canvas interaction: tools, hit testing, handles, viewport
  components/  Lit components (app shell, canvas, panels)
  styles/      design tokens
tests/         node:test suites for core/
docs/          architecture and theory notes
```

See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) for how the pieces fit
together and how to extend them.
