export function availabilityError(message: string) {
  if (message.includes("Stale")) return { status: 409, error: "Availability changed. Reload and review the current ranges." };
  if (message.includes("replacement confirmation")) return { status: 409, error: "Confirm the ranges this declaration will replace." };
  if (message.includes("Deployment conflict acknowledgement")) return { status: 409, error: "Acknowledge that this change does not cancel your deployment." };
  return { status: 400, error: "Availability could not be saved. Check the future dates and your access." };
}
