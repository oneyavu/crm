# Design — Rules for AI Agents

- /packages/ui is the single source of truth for all UI.
- Always use shared shadcn components from /packages/ui.
- Do not override component styles with className.
- Do not introduce custom border radii, spacing, colours, shadows, or other visual deviations.
- Corners are rounded, from the scale only: `rounded-sm` (4px) for the smallest
  controls, `rounded-md` (5px) for buttons, inputs and segments, `rounded-lg`
  (8px) for surfaces that contain controls — popovers, dialogs, menus, table
  shells. Never a literal radius at the call site.
- `rounded-none` is still correct in one case: an element that must join its
  neighbour edge to edge. The input inside an input group, the middle cells of
  a selected date range, and the drawer handle are the existing examples.
- If a component needs a new variant or style, implement it in /packages/ui so the entire application stays consistent.

## Colour

VAYU CRM uses a near-black executive control surface by default, with warm neutral
greys, coral (`#FF645F`) for the primary action and urgent movement, and mint
(`#72F2AA`) for positive operational state. A restrained peach-to-lavender gradient
is reserved for insight surfaces and never used as text decoration.

**Only two things are filled**: `primary` for the action you want, `destructive`
for the one you cannot undo. Everything else — secondary, outline, ghost — is a
white chip in light and a dark chip in dark. That is what keeps a rep's eye
landing on *go* or *stop* and skimming past the rest.

Primary and destructive fills remain distinct: coral advances work, destructive
red stops and confirms irreversible actions. Mint communicates success and is not
used as a general action color. Light mode retains the same roles on warm off-white.

## Structure

The shell uses a full labelled navigation rail, hairline dividers, open content
regions, tabular numerals, compact outlined secondary controls, and 5–8px functional
radii. Avoid nested cards. Dense records use tables and a detail rail; dashboards
use large numeric hierarchy and flat sections separated by rules.
