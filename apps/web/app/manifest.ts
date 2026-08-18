import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Divyaloka — certified Rudraksha & puja booking",
    short_name: "Divyaloka",
    description: "X-ray verified Rudraksha, spiritual jewellery, and verified pandits for online or at-home puja.",
    start_url: "/",
    display: "standalone",
    background_color: "#FBF6EC",
    theme_color: "#E0801B",
    orientation: "portrait",
    categories: ["shopping", "lifestyle"],
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
