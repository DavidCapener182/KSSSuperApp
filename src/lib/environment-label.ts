export const isStaging = process.env.NEXT_PUBLIC_KSS_STAGE === "staging";

// Product wording is independent of the internal deployment-safety flag.
export const environmentLabel = "KSS Enterprise";
