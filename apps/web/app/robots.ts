import type { MetadataRoute } from "next";

const SITE = process.env.NEXT_PUBLIC_SITE_URL || "https://divyaloka.com";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      { userAgent: "*", allow: "/", disallow: ["/account", "/checkout", "/admin", "/pandit", "/api/"] },
      // Answer engines are welcome on the catalogue and the explainers.
      { userAgent: ["GPTBot", "PerplexityBot", "ClaudeBot", "Google-Extended"], allow: ["/", "/blog", "/shop", "/verify"] },
    ],
    sitemap: `${SITE}/sitemap.xml`,
    host: SITE,
  };
}
