# Design system

Every number here is checked against the stylesheet by `npm run check:tokens`, so this
file cannot describe a system the site does not have. That guard used to be a page that
painted the swatches from the live tokens; the page was deleted and the guard stayed,
because the guard was always the part doing the work.

Everything lives in `src/styles/global.css`. There is no config file and no runtime.

## Where this comes from

The site is Swiss in its bones: an objective grid, a modular type scale, hairline rules
instead of boxes, mono set as data rather than as decoration, and asymmetric balance rather
than centred symmetry. Monochrome is the constraint that keeps that honest. With no hue to
lean on, hierarchy has to come from size, weight, spacing and contrast, which are the four
things the tradition argues are sufficient.

Two borrowings from outside it. Corner geometry follows Apple's continuous curvature rather
than the circular corner, because at identical radii the continuous one reads as softer and
more deliberate. And the interaction model follows the newer convention that a control
should answer the pointer with several small coordinated moves rather than one large one.

## The one rule

**No raw values in markup.** If a size, colour, radius, duration or easing appears as an
arbitrary Tailwind bracket, such as `text-[0.95rem]`, `rounded-[14px]` or
`tracking-[-0.03em]`, it
is a decision that escaped the system, and the next person will make a slightly different
one three files away. CI fails the build on those brackets.

Adding a value is fine. Adding it _twice_ is the problem: the second time, name it.

## Colour

Absolute monochrome. Pure black, pure white, greys between, no hue anywhere. That is not
an aesthetic preference alone; it is what makes the mark, the metal and the page read as
one object, and it is why the shader's chromatic split is turned down to a level that
reads as material rather than as colour.

| Token                 | Role                       |
| --------------------- | -------------------------- |
| `--color-canvas`      | The page                   |
| `--color-surface`     | Cards and raised panels    |
| `--color-ink`         | Headings and primary text  |
| `--color-ink-2`       | Body copy                  |
| `--color-ink-3`       | Labels and fine print      |
| `--color-rule`        | Dividers and card edges    |
| `--color-rule-strong` | Hover edges and underlines |
| `--color-glow`        | The light behind the hero  |

The whole palette inverts under `prefers-color-scheme: light`. Light mode is the same
eight decisions read from the other side, not a second theme.

**Contrast is measured, not eyeballed.** `--color-ink-3` was `#6e6e6e` until it was
computed at 4.12:1 and failed AA, for the grey that carries every section label and the
registration line. It is `#787878` now, at 4.76:1. Any token carrying real content clears
4.5:1 against its canvas, in both modes.

## Type

Instrument Sans for anything read as language; IBM Plex Mono for anything read as data, such as a
label, a platform list or a registration number. Both self-hosted; no request leaves the
visitor's browser for a font.

**Every size is 16 × 1.25ⁿ**, a major third. `n` is a whole number but not a consecutive
one: the scale runs …, 1.25², 1.25⁴, 1.25⁷, skipping steps at the top because a display
size needs a jump and the sizes between would never be used. Membership of the scale is the
rule; adjacency is not. This is the part that makes it a system
rather than a tidy list, and the first version of this file failed it: eleven named sizes,
seven of them less than 12% from a neighbour. 15.2, 16, 16.8, 18 and 20 were five separate
decisions the eye reads as one. Naming an arbitrary value does not make it systematic; it
just makes it easier to find.

| Step        | Size   | Role                       |
| ----------- | ------ | -------------------------- |
| `0.64rem`   | 10.2px | fine                       |
| `0.8rem`    | 12.8px | label, mono                |
| `1rem`      | 16px   | body, wordmark             |
| `1.25rem`   | 20px   | heading, lead              |
| `1.5625rem` | 25px   | title, small end           |
| `2.44rem`   | 39px   | title large, display small |
| `4.77rem`   | 76px   | display, large end         |

Classes are named by **role**, never by size. Where two roles share a step, as heading and
lead do at 20px, they are separated by weight and leading, which is how Bringhurst
separates levels anyway, rather than by inventing a size between two existing ones.

Each class sets size, weight, leading and tracking together, because those four are one
decision. Setting `type-title` and then overriding `tracking` means the scale is missing a
step; add the step rather than the override.

**Tracking tightens as size grows.** Letterfit that reads as normal at 16px reads as loose
at 76px. That is optical correction, not a second scale.

**Line boxes land on the 4px grid.** Every fixed size multiplies to a multiple of four.
Body 16 × 1.5 = 24, heading 20 × 1.4 = 28, label 12.8 × 1.25 = 16, so stacked text keeps a
common rhythm instead of drifting a pixel per line. The two fluid sizes, display and title,
are exempt: a `clamp()` cannot sit on a baseline grid, and pretending otherwise would mean
giving up fluid type or lying about the rule.

## Measure

Bringhurst puts a comfortable line at 45–75 characters; past that the eye loses the return
sweep and has to hunt for the start of the next line. At this body size that is about
`34rem`, which is the `measure` utility. Body copy is capped by it rather than allowed to
run the full 64rem of the container. The container sets the page width, the measure sets
the reading width, and they are not the same decision.

## Rhythm

`pad-section` is the distance **between** sections: 4rem, 6rem from the medium breakpoint
up. One utility, so a larger gap on the page always means a larger break in the argument.
Before it, the page ran `py-16`, `py-24`, `py-12` and `py-20` with nothing distinguishing
them, which trains the reader to ignore spacing as a signal.

`pad-shell` is for the footer, and it is asymmetric on purpose. The shell is not a section
and padding it like one put 96px below the last line of text, space separating that line
from nothing, which reads as a slab of empty ground rather than as rhythm. The top stays
generous because the glow needs room to rise off the edge; the bottom only has to keep the
fine print off the viewport edge.

The rule generalises: **rhythm is a relationship between two things.** Where there is
nothing on the other side, the space is padding, not rhythm, and it takes a different
token.

## Radius

Named for what they wrap, not for how big they are: `control` (12px) for buttons and nav links,
`card` (16px) for cards, `panel` (20px) for the docked header, `shell` (32px) for the
footer. A button and a card cannot drift apart because neither owns a number.

All four use `corner-shape: squircle`, the continuous curvature Apple uses, where the
curve eases into the straight edge instead of meeting it at a hard tangent. That is why
their corners look softer at an identical radius. Chromium draws it today; every other
engine falls back to the circular corner the `border-radius` already specifies, so the
degradation is "what this looked like last month", not a broken shape.

Pills are deliberately excluded. A stadium is already the correct shape and a superellipse
dents its ends.

## Motion

Two curves, four durations.

`--ease-soft` decelerates hard and is the house easing, used for anything that appears or
settles. `--ease-spring` overshoots slightly and is reserved for what the pointer touches,
so an element that moves under the cursor feels physical while an element that merely
arrives does not.

`--duration-instant` (80ms) for press feedback, `--duration-fast` (200ms) for colour and
opacity, `--duration-base` (300ms) for position and size, `--duration-slow` (800ms) for
entrances.

The instant step is the newest and the one that looks like a rounding error. It is not:
a control that acknowledges a click a fifth of a second later reads as laggy, and every
platform's own press state sits between 50 and 100ms. It was a literal inside the call to
action until a motion audit found it there, alongside a 350ms and a 200ms written as a
number next to the token holding that exact value.

Tailwind's own transition defaults are set to this scale rather than left at its 150ms and
its own curve. A `transition-*` class that forgets to say how long now lands inside the
system instead of quietly outside it, which is how two pages came to run at a duration and
an easing nobody had chosen.

The hero's entrance is staggered by **ordinal, not by delay**. Each element carries
`--index` and one beat is a tenth of `--duration-slow`, so the rhythm derives from an
existing token instead of adding a fourth duration the scale would then have to admit to.
The display headline runs 1.5x because its entrance is a mask sweeping down a three-line
block, and at 800ms the edge outruns the eye and reads as a flicker.

Every animation stops under `prefers-reduced-motion`. Not slowed but stopped. And the reveal
system is built so that a visitor with motion disabled, or with JavaScript blocked, sees
the content immediately rather than depending on anything running.

## Grid

Everything geometric sits on a **4px grid**, 8px preferred. Before this rule the page
carried 6px gaps, 10px and 14px radii and 28px card padding, each individually
defensible, and collectively meaning there was no grid. Tailwind's `.5` steps land on 2px
and 6px, so CI rejects them.

Radius follows the same grid and is named for what it wraps: `control` 12px, `card` 16px,
`panel` 20px, `shell` 32px.

**Nested corners are concentric.** A rounded thing inside another rounded thing should use
`outer radius − padding`, otherwise the two curves run at different rates and the gap
between them visibly pinches at the corner. That is why the docked header (`panel`, 20px)
holds nav links at `control` (12px) across 8px of padding: 20 − 8 = 12.

## Width

One breakpoint carries almost everything: **48rem**, which is Tailwind's `md` and the
`(width >= 48rem)` in the stylesheet. Below it the page is a single column with 24px of
side padding and the header collapses to a wordmark and one button. Above it the padding
goes to 40px, the navigation appears and the section padding grows. `sm`, `lg` and `xl`
appear four times between them, always for a grid that has room for a second column.

The column is `max-w-5xl`, 1024px, and everything sits inside it: the header, every
section, the footer. Reading width is separate and narrower, because a line of body text
that runs the width of the container is a line nobody finishes.

Display and title sizes are `clamp()` rather than stepped, so the headline scales with the
viewport instead of jumping at a breakpoint. That is also why they are exempt from the 4px
line box rule: a fluid size cannot sit on a fixed grid.

### What was measured

Twelve viewports from 320px to 2560px, plus a phone turned sideways at 844x390. No horizontal
scrolling anywhere, no interactive target under 24px, no text under 12px.

Four WCAG criteria were checked by forcing the condition rather than by reading the code:

| Criterion           | Condition forced                                                                   | Result                                                        |
| ------------------- | ---------------------------------------------------------------------------------- | ------------------------------------------------------------- |
| 1.4.10 Reflow       | Viewport at 320 CSS px                                                             | No two-dimensional scrolling                                  |
| 1.4.4 Resize text   | Root font size at 200%                                                             | No two-dimensional scrolling                                  |
| 1.4.12 Text spacing | Line height 1.5, letter spacing 0.12em, word spacing 0.16em, paragraph spacing 2em | Nothing clipped or overlapping                                |
| 2.4.7 Focus visible | Nineteen Tab presses through the page                                              | White 2px ring at 3px offset on every stop, in document order |

The one defect it found was the registration line in the footer. Its address link boxed at
133 by 13 pixels, which WCAG 2.5.8 permits because the target sits inside a sentence, and
a thumb does not care what the exemption says. It carries vertical padding now, and the
line went from 10.24px to 12.8px, because the smallest step on the scale was being spent
on the one legally identifying fact on the page.

## Layers

Named, because `-2`, `-1`, `50` and `60` were scattered across four files with no
relationship to each other and no way to know whether a new number was safe.

| Token            | Value | What lives there                   |
| ---------------- | ----- | ---------------------------------- |
| `--layer-behind` | -1    | The hero glow, behind everything   |
| `--layer-sticky` | 50    | The header                         |
| `--layer-grain`  | 60    | The grain overlay, above all of it |

Three, not five. A `base: 0` and a `raised: 10` were declared for completeness and never
applied to anything, and a test fails on any token nothing references, and a layer nobody
occupies is a number waiting to be used inconsistently.

## Interaction

**Every control clears 44px.** Apple asks 44, Material asks 48dp, and the nav links were
shipping 33 because padding was doing the sizing. `hit-target` sets the floor independently
of text size, so a small label never produces a small target.

Focus is one ring everywhere, `--focus-width` at `--focus-offset`, and it is never
removed, only styled. Keyboard focus gets the same treatment as hover on the call to
action, since a control that only answers a mouse is a broken control.

Weights are three and each has a job: `--weight-regular` reads, `--weight-medium` marks a
control, `--weight-semibold` is structure. A fourth would be a distinction nobody can see.

Decorative opacity is `--opacity-ghost` for watermarks and `--opacity-grain` for the paper
texture. A watermark at 3.5% next to another at 5% was two decisions where one does.

## Elevation

On a black ground a shadow cannot darken anything, so height comes from a hairline plus a
wide, very soft shadow: `--shadow-raised` for a resting object, `--shadow-floating` for one
that has lifted. That is the same trick a printed page uses for a die cut.

**Both flip in light mode.** The dark values lean on a near-black hairline, and that same
ring on white reads as a hard printed outline rather than as height, so on light the ring
softens to 8% and the shadow does the lifting instead. Elevation is the one part of the
palette that is not a straight inversion, because shadow is not a colour, it is an absence
of light, and absence behaves differently on the two grounds.

## Components

There is one call to action per page. Its ring is a WebGL shader over a CSS
chrome fallback, and hovering moves five things at once (lift, shadow length, ring
thickness, label brightness, shader speed) because several small moves pointing the same
way read as one gesture, while one big move reads as an effect.

Cards state their edge with `--color-rule` and brighten it to `--color-rule-strong` on
hover. Text links keep their underline at rest and carry the emphasis in the decoration
colour, not the text colour, so nothing reflows or changes weight under the cursor.
