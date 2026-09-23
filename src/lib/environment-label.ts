export const isStaging = process.env.NEXT_PUBLIC_KSS_STAGE === "staging";

export const environmentLabel = isStaging ? "Staging · Synthetic data" : "Development";
