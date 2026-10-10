import type { MetadataRoute } from "next";
import { urlDelSitio } from "@/config/site";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: ["/", "/login"],
      disallow: ["/panel", "/carnet", "/cambiar-password"],
    },
    sitemap: `${urlDelSitio()}/sitemap.xml`,
  };
}
