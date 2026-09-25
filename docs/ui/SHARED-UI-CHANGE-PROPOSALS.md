# TASK-UI06 shared UI change proposals

For UI02 integration, consider a shared four-step journey/context component and a consistent in-page section navigation primitive. This lane keeps its current implementation local to Mobilisation. Any shared component should preserve domain-specific source identities, explicit status language and keyboard focus without deriving a readiness verdict.

The follow-up CRM, Site, Service and Event screens use a domain-local `commercial-journey.module.css` for route context and in-page navigation. UI02 can consolidate this with the Mobilisation pattern after checking role-specific link visibility, 390px wrapping and keyboard focus in the authenticated app. A shared component must not infer stage completion from a link or action count.
