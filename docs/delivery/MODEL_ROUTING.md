# Model routing verification

Status: Partly checked. The installed user config requests `gpt-6-sol` at `low` effort; this is a default, not proof of the active session model. The active lead model/effort and billing route are not exposed to this task. No project model configuration was activated.

| Role | Proposed model | Proposed effort | Actually selected/observed | Availability / source |
|---|---|---|---|---|
| Initial architecture review | gpt-5.6-sol | medium | Not selected | Listed in collaboration controls; no worker launched |
| Everyday lead | gpt-5.6-terra | medium | Active lead setting unavailable | Listed in available controls |
| Narrow reader / routine worker | gpt-5.6-luna | low or medium | Not selected | Listed in app thread controls, not current collaboration spawn controls |
| Implementer | gpt-5.6-terra | medium | Not selected | Listed in available controls |
| Risk reviewer | gpt-5.6-sol | high | Not selected | Listed in available controls |
| Exception | gpt-6-astra | task-specific | Not authorised | Requires explicit approval |

Record authentication/billing route only at a descriptive level, not credentials. Record client version, permitted agent controls and configuration conflicts. Never copy secrets or claim a model switch that is not observed.

The desktop task uses a local workspace. Explicit model and effort are exposed for supported worker launches, but no worker was needed for this planning pass. The available collaboration launch schema lists Terra and Sol but not Luna, while app thread controls list Luna. The supplied Luna worker definitions therefore remain inactive pending an effective-client check. The `configuration-templates/` remain inactive. No global config, sandbox or billing setting changed. Proposed future project default: Terra Medium, with a Sol reviewer selected per task; this would override the current user default only in new project sessions after David accepts it.
