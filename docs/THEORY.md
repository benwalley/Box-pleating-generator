# How the generator works

The method follows Robert J. Lang's treatment of box pleating in *Origami
Design Secrets* (2nd ed., 2011, chapters 12–13) and his crease-pattern
articles. Lang describes the box-pleated counterpart of circles and
rivers as squares whose half-side equals the flap length, and rivers of
constant width with horizontal and vertical banks.

## Layout and tree

- A **flap** of length *r* is a square of side 2*r* centred on the flap tip.
  Its tip can also be a segment or rectangle (width *w*, height *h*); the
  flap is then the box of points within *r* of the tip, (*w* + 2*r*) ×
  (*h* + 2*r*), and distances are measured from the nearest point of the tip.
- A **river** of width *w* is an internal tree edge of length *w*.
- Two flaps whose squares touch hang from the same node.
- A layout is valid when no squares or rivers overlap and, for every pair
  of flaps, the Chebyshev distance between tips is at least their distance
  in the tree (the box-pleating path condition). Pairs where it is equal
  are **active paths**.

A square always contains the flap's circle (its true region in Lang's
circle/river method). When two squares overlap, or a square crosses a
river, but the circles fit, the layout is accepted as **circle packing**:
overlap, touching and the path condition fall back to the Euclidean
distance, and such pairs are reported as `circle-packed` notes.

Pleatsmith merges the ports of touching elements into nodes, adds an edge
for each drawn river, joins any remaining separate groups with implied
rivers (smallest gap first), then checks every pair of flaps against the
path condition.

## Creases

Every point on the paper is owned by the flap whose shape boundary is
nearest: the square in the L∞ metric, generalized to squares cut by
tangent sides for circle-packed flaps.

- **Hinges** separate elements: squares, rivers, and open paper.
- **Axis-parallel contours** run perpendicular to the owner's nearest square
  edge, at integer elevations (distance from the axis line through the
  owner's tip). Elevation 0 is the axis.
- **Ridges** are 45° lines where contour direction flips.

A circle-packed flap's square is cut by a **tangent side** facing each
neighbour it only fits next to as a circle. On that side, contours run
parallel to the line between the tips (the axis), the tangent through the
contact point is a hinge, and ridges run from the tip to the new corners,
bisecting the side normals. With only square sides this is exactly the
box-pleating field.

A segment tip splits the square open along the tip: 45° ridges run from
its ends, the tip itself is a ridge, and elevation is measured from one end
of the tip (plus the tip's length past its far end), so the band beside the
tip is pleated like the rest and the flap folds to a wide flap.

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

Stretch gadgets to reconcile circle-packed regions with the grid around
them (Pythagorean and generalized offset Pythagorean stretches), level shifters,
half-unit structures, flat-folding tips with both width and height (their
inside would need pleating), and meandering rivers.
Box Pleating Studio implements stretch gadgets for many such cases.
