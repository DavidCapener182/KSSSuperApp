# KSS Enterprise UI guide

Status: TASK-03F development standard, 23 September 2026. Applies to the existing authenticated product and future UI work.

## Direction

Use a restrained, iOS-inspired operational interface: clear hierarchy, compact controls, generous but purposeful spacing, and calm surfaces. Use shadcn/ui primitives where they fit the existing workflow. Keep business state and access decisions in the existing server APIs; UI components are presentation only.

**No green in product UI.** Do not add green, emerald, lime, mint, green-teal, green gradients, green success badges, or green progress. Completed states use explicit text/icons with blue or neutral treatment. Warning uses amber; destructive/error uses red. Never encode status by colour alone.

## Tokens

Semantic tokens live in `src/app/globals.css`. Light mode: white and cool neutral surfaces, graphite text, light separators, iOS-style blue for interaction, amber for warning, red for danger. A `.dark` token foundation exists in charcoal/graphite and blue, but no user-facing dark-mode switch or full dark-mode QA is included yet. Do not scatter one-off colours into page components.

System font stack uses `-apple-system`, BlinkMacSystemFont, Segoe UI, and fallbacks. No proprietary Apple font assets. Use restrained heading weights, body line height around 1.5, and visible labels. Page gutters are 16px on phones and wider on desktop; cards commonly use 12–18px radius, subtle borders/shadows, and 16–24px internal spacing.

## Components and patterns

- shadcn primitives currently adopted: Button, Badge, Input, Sheet, Skeleton, and Progress. `workflow.tsx` maps common actions/status/loading into these primitives. Add further components only when a real screen needs them.
- Use exact text labels for Requested, Awaiting evidence/review, Action required, Verified, Acknowledged, Not connected, Not available, In progress, Done, and Cancelled. Completion can be blue/neutral, never green.
- Progress is a count first (for example, “5 of 6 requirements complete”) with a subtle blue bar and the remaining blocker. It is not a compliance or deployability score.
- Forms keep labels above controls, descriptions and field errors near inputs, separate Save draft from explicit Submit, and use a confirmation for consequential/destructive actions.
- Loading uses Skeleton/status rather than a false empty result. Empty, denied, error and no-results states must explain the next useful action.
- Lucide icons aid navigation or a specific action; they are not substitutes for labels.

## Responsive behaviour

Staff phone journeys are first class at 390px: bottom navigation for primary destinations, a Sheet for more destinations, no page-level horizontal scroll, readable cards instead of compressed desktop tables, 44px-class controls, and comfortable form spacing. Office desktop uses denser tables, summary counts and side-by-side detail where space helps. Office phone queues use cards and wrapping filters. Keep private fields out of triage surfaces.

The authorised navigation map remains server-owned. Do not display or load a role's forbidden destinations. Every modal/sheet must have keyboard focus management, labels, visible focus, and an accessible close path; statuses and errors need text or live announcements. Check contrast, reduced motion, and zoom before expanding this system.

## Deliberate exclusions

Avoid neon, glowing/glass surfaces, purple/blue hero gradients, decorative blobs, oversized pills, and decorative icon noise. Controlled document acknowledgement remains “Acknowledged,” never “Signed.” Synthetic RTW/SIA/Identity states never claim legal compliance or deployability.
