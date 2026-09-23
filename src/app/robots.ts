import type { MetadataRoute } from "next";
import { isStaging } from "@/lib/environment-label";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: isStaging ? { userAgent: "*", disallow: "/" } : { userAgent: "*", allow: "/" },
  };
}
