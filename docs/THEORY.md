# How the generator works

The method follows Robert J. Lang's treatment of box pleating in *Origami
Design Secrets* (2nd ed., 2011, chapters 12–13) and his crease-pattern
articles. Lang describes the box-pleated counterpart of circles and
rivers as squares whose half-side equals the flap length, and rivers of
constant width with horizontal and vertical banks.

## Layout and tree

- A **flap** of length *r* is a square of side 2*r* centred on the flap tip.
- A **river** of width *w* is an internal tree edge of length *w*.
- Two flaps whose squares touch hang from the same node.
- A layout is valid when no squares or rivers overlap and, for every pair
  of flaps, the Chebyshev distance between tips is at least their distance
  in the tree (the box-pleating path condition). Pairs where it is equal
  are **active paths**.

Pleatsmith merges the ports of touching elements into nodes, adds an edge
for each drawn river, joins any remaining separate groups with implied
rivers (smallest gap first), then checks every pair of flaps against the
path condition.

## Creases

Every point on the paper is owned by the flap whose square boundary is
nearest in the L∞ metric.

- **Hinges** separate elements: squares, rivers, and open paper.
- **Axis-parallel contours** run perpendicular to the owner's nearest square
  edge, at integer elevations (distance from the axis line through the
  owner's tip). Elevation 0 is the axis.
- **Ridges** are 45° lines where contour direction flips.

This reproduces the waterbomb-style molecule inside each square, contours
that continue across rivers, and ridges at river bends. Where neighbouring
contours disagree in parity, the segment is marked as a **conflict**: a
level shifter or a one-unit shift would be needed.

## Mountain and valley

Contours follow elevation parity (even = mountain, odd = valley). A ridge
between elevations *e* and *e*+1 is a valley when *e* is even. At an
interior flap tip one axial ray is flipped to balance Maekawa's condition.
Hinges stay unassigned because their direction depends on how the flaps
are flattened.

## Checks and their limits

Every interior vertex is checked for Kawasaki's condition (alternating
angles sum to 180°) and, where all creases are assigned, Maekawa's
(|M − V| = 2). Both are necessary but not sufficient: deciding global
flat-foldability is NP-complete even for box pleating (Akitaya et al.,
"Box Pleating is Hard", 2015). Verify generated patterns in a folding
simulator or on paper.

## Not covered

Pythagorean and generalized offset Pythagorean stretches, level shifters,
half-unit structures, elevated (rectangular) flaps, and meandering rivers.
Box Pleating Studio implements stretch gadgets for many such cases.
