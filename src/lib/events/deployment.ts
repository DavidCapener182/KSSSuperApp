export const canManageDeployment = (roles: string[]) => roles.some((role) =>
  ["SUPER_ADMIN", "OFFICE_ADMIN", "OPERATIONS"].includes(role));

export function deploymentError(message: string) {
  if (message.includes("APPROVED_TIME_AWAY_CONFLICT"))
    return { status: 409, error: "APPROVED_TIME_AWAY_CONFLICT: Approved time away overlaps this duty. Reload the allocation." };
  if (message.includes("capacity") || message.includes("Stale") || message.includes("Reconcile"))
    return { status: 409, error: "The staffing plan or allocation changed. Reload and reconcile the current work." };
  if (message.includes("blocked")) return { status: 409, error: "This Person has a blocking role, clash or synthetic check result." };
  if (message.includes("Warnings")) return { status: 400, error: "Acknowledge the candidate warnings and enter a short reason." };
  return { status: 400, error: "Deployment action denied. Check the Event, Person, state and authority." };
}
