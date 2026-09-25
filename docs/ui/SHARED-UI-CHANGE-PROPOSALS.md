# TASK-UI05 shared UI change proposals

Record proposed global typography, navigation, layout, CSS or primitive changes here for later controlled UI02 integration. Do not edit shared components in this lane.

- UI02 should provide one scoped responsive data-list primitive with named mobile fields, full-size row links, keyboard focus and a common pagination treatment. UI05 applies these locally on People until that contract exists.
- UI02 should standardise in-page record section navigation and 44px touch targets. The People record uses a local horizontally scrollable section list at 390px.
- Do not add a global Training or credential status badge: course progress, completion, evidence acceptance, credential verification and eligibility require distinct source labels.
- UI02 should consolidate 44px action and form sizing, focus rings, source-boundary notes, and post-readback feedback into common primitives. UI05 uses local styles while those shared contracts are unresolved.
- Training administration needs an agreed large-list pattern for courses and exact versions. UI05 adds local title filtering and collapsed versions against the existing loaded result; a future paginated read contract would be a separate product task if synthetic volume grows.
