# UI02 product-wide route tracker

Source: current isolated UI02 baseline at `eb65cfcf8b740338523db41a170d98c2fd3f307d`, compared with original UI01 product inventory. Dynamic page files count once. “Redesigned” means accepted UI03–UI07 domain presentation plus UI02 shell, not that UI02 rewrote that page. “Shared-design-system updated” means the shell alone changed. “Deliberately retained” means the existing source-specific workflow stays intact under the shell.

| Enterprise route | Classification | Evidence / reason |
|---|---|---|
| `/access/incident-reviewers` | Deliberately retained | Source-specific workflow retained under UI02 shell |
| `/action-centre` | Redesigned | UI04 accepted lane; UI02 shell sampled where listed in report |
| `/app` | Shared-design-system updated | UI02 shell, context and focus only |
| `/assets` | Redesigned | UI07 accepted lane; UI02 shell sampled where listed in report |
| `/control-room` | Redesigned | UI04 accepted lane; UI02 shell sampled where listed in report |
| `/credentials` | Redesigned | UI05 accepted lane; UI02 shell sampled where listed in report |
| `/crm` | Redesigned | UI06 accepted lane; UI02 shell sampled where listed in report |
| `/crm/opportunities/[id]` | Redesigned | UI06 accepted lane; UI02 shell sampled where listed in report |
| `/crm/organisations/[id]` | Redesigned | UI06 accepted lane; UI02 shell sampled where listed in report |
| `/documents` | Deliberately retained | Source-specific workflow retained under UI02 shell |
| `/documents/[requestId]` | Deliberately retained | Source-specific workflow retained under UI02 shell |
| `/events` | Redesigned | UI06 accepted lane; UI02 shell sampled where listed in report |
| `/events/[id]` | Redesigned | UI06 accepted lane; UI02 shell sampled where listed in report |
| `/events/[id]/attendance` | Redesigned | UI04 accepted lane; UI02 shell sampled where listed in report |
| `/events/[id]/work-time` | Shared-design-system updated | UI02 shell, context and focus only |
| `/incidents` | Redesigned | UI04 accepted lane; UI02 shell sampled where listed in report |
| `/incidents/[id]` | Redesigned | UI04 accepted lane; UI02 shell sampled where listed in report |
| `/management-reports` | Shared-design-system updated | UI02 shell, context and focus only |
| `/mobilisations` | Redesigned | UI06 accepted lane; UI02 shell sampled where listed in report |
| `/mobilisations/[id]` | Redesigned | UI06 accepted lane; UI02 shell sampled where listed in report |
| `/my-attendance` | Redesigned | UI04 accepted lane; UI02 shell sampled where listed in report |
| `/my-availability` | Redesigned | UI05 accepted lane; UI02 shell sampled where listed in report |
| `/my-deployments` | Redesigned | UI03 accepted lane; UI02 shell sampled where listed in report |
| `/my-equipment` | Redesigned | UI07 accepted lane; UI02 shell sampled where listed in report |
| `/my-schedule` | Redesigned | UI03 accepted lane; UI02 shell sampled where listed in report |
| `/my-time-away` | Redesigned | UI05 accepted lane; UI02 shell sampled where listed in report |
| `/my-work-time` | Deliberately retained | Source-specific workflow retained under UI02 shell |
| `/onboarding` | Deliberately retained | Source-specific workflow retained under UI02 shell |
| `/onboarding/[id]` | Deliberately retained | Source-specific workflow retained under UI02 shell |
| `/onboarding/new` | Deliberately retained | Source-specific workflow retained under UI02 shell |
| `/operational-contacts` | Redesigned | UI07 accepted lane; UI02 shell sampled where listed in report |
| `/operational-contacts/manage` | Redesigned | UI07 accepted lane; UI02 shell sampled where listed in report |
| `/people` | Redesigned | UI05 accepted lane; UI02 shell sampled where listed in report |
| `/people/[id]` | Redesigned | UI05 accepted lane; UI02 shell sampled where listed in report |
| `/profile` | Redesigned | UI05 accepted lane; UI02 shell sampled where listed in report |
| `/service-delivery` | Redesigned | UI07 accepted lane; UI02 shell sampled where listed in report |
| `/service-delivery/[id]` | Redesigned | UI07 accepted lane; UI02 shell sampled where listed in report |
| `/site-book` | Redesigned | UI04 accepted lane; UI02 shell sampled where listed in report |
| `/site-book/[serviceId]` | Redesigned | UI04 accepted lane; UI02 shell sampled where listed in report |
| `/site-book/access` | Redesigned | UI04 accepted lane; UI02 shell sampled where listed in report |
| `/sites` | Redesigned | UI06 accepted lane; UI02 shell sampled where listed in report |
| `/sites/[siteId]/services` | Redesigned | UI06 accepted lane; UI02 shell sampled where listed in report |
| `/sites/[siteId]/services/[serviceId]` | Redesigned | UI06 accepted lane; UI02 shell sampled where listed in report |
| `/sites/[siteId]/services/[serviceId]/attendance` | Redesigned | UI04 accepted lane; UI02 shell sampled where listed in report |
| `/time-away` | Redesigned | UI05 accepted lane; UI02 shell sampled where listed in report |
| `/training` | Redesigned | UI05 accepted lane; UI02 shell sampled where listed in report |
| `/training-admin` | Redesigned | UI05 accepted lane; UI02 shell sampled where listed in report |
| `/training-admin/assessments` | Redesigned | UI05 accepted lane; UI02 shell sampled where listed in report |
| `/training-admin/assignments` | Redesigned | UI05 accepted lane; UI02 shell sampled where listed in report |
| `/training/[courseId]` | Redesigned | UI05 accepted lane; UI02 shell sampled where listed in report |
| `/training/my-learning` | Redesigned | UI05 accepted lane; UI02 shell sampled where listed in report |
| `/training/my-learning/[assignmentId]` | Redesigned | UI05 accepted lane; UI02 shell sampled where listed in report |
| `/training/my-learning/[assignmentId]/assessment` | Redesigned | UI05 accepted lane; UI02 shell sampled where listed in report |
| `/training/my-learning/[assignmentId]/history` | Redesigned | UI05 accepted lane; UI02 shell sampled where listed in report |
| `/work` | Deliberately retained | Source-specific workflow retained under UI02 shell |
| `/work/[taskId]` | Deliberately retained | Source-specific workflow retained under UI02 shell |
| `/workforce` | Redesigned | UI03 accepted lane; UI02 shell sampled where listed in report |

Current baseline: **57 enterprise routes**. UI01 inventory: **58**.

| Original UI01 route absent from this baseline | Classification | Source evidence |
|---|---|---|
| `/operational-documents` | **Deferred — source not present in current canonical UI02 baseline (TASK-19A dependency)** | UI01 product inventory line 37 lists it; line 70 says it existed only in then-untracked TASK-19A work. No placeholder route is created. Review it through the accepted UI02 shell once accepted 19A application source is integrated. |

No route in the current 57-route tree is silently dropped. This tracker classifies page files, not every modal, tab, action or API endpoint. Browser sampling and limitations are in `TASK-UI02-DESIGN-SYSTEM-REPORT.md`.
