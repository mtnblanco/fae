import type { MetadataRoute } from "next";
import { urlDelSitio } from "@/config/site";

export default function sitemap(): MetadataRoute.Sitemap {
  const base = urlDelSitio();
  return [
    { url: `${base}/`, changeFrequency: "monthly", priority: 1 },
    { url: `${base}/login`, changeFrequency: "yearly", priority: 0.5 },
  ];
}
