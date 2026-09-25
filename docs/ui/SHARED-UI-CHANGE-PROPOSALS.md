# TASK-UI04 shared UI change proposals

For controlled UI02 integration, consider a common source-card pattern with source label, fact timestamp, exact record link and one domain-specific next action. Control Room, Action Centre, Incident and Site Book currently implement this independently. A shared component must accept only caller-authorised fields and must not imply that one source state resolves another.

A shared async-action feedback pattern could distinguish request pending, server acceptance, authoritative readback and unconfirmed refresh. Domain clients should retain their own idempotency and source guards. No shared file was edited in UI04.

# TASK-UI05 shared UI change proposals

Record proposed global typography, navigation, layout, CSS or primitive changes here for later controlled UI02 integration. Do not edit shared components in this lane.

- UI02 should provide one scoped responsive data-list primitive with named mobile fields, full-size row links, keyboard focus and a common pagination treatment. UI05 applies these locally on People until that contract exists.
- UI02 should standardise in-page record section navigation and 44px touch targets. The People record uses a local horizontally scrollable section list at 390px.
- Do not add a global Training or credential status badge: course progress, completion, evidence acceptance, credential verification and eligibility require distinct source labels.
- UI02 should consolidate 44px action and form sizing, focus rings, source-boundary notes, and post-readback feedback into common primitives. UI05 uses local styles while those shared contracts are unresolved.
- UI05's authenticated 390px People, Staff Record and follow-up walkthroughs support a readable system sans-serif direction for UI02 across KSS Enterprise: comfortable operational body text, hierarchy through weight/size/spacing, restrained uppercase, strong focus outlines, sensible mobile spacing and practical 44px controls. This is a shared-system input, not an authorisation for UI05 to rewrite global CSS.
- Training administration needs an agreed large-list pattern for courses and exact versions. UI05 adds local title filtering and collapsed versions against the existing loaded result; a future paginated read contract would be a separate product task if synthetic volume grows.

# TASK-UI06 shared UI change proposals

For UI02 integration, consider a shared four-step journey/context component and a consistent in-page section navigation primitive. This lane keeps its current implementation local to Mobilisation. Any shared component should preserve domain-specific source identities, explicit status language and keyboard focus without deriving a readiness verdict.

The follow-up CRM, Site, Service and Event screens use a domain-local `commercial-journey.module.css` for route context and in-page navigation. UI02 can consolidate this with the Mobilisation pattern after checking role-specific link visibility, 390px wrapping and keyboard focus in the authenticated app. A shared component must not infer stage completion from a link or action count.
