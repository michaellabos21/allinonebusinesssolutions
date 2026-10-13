import type { MetadataRoute } from "next";

import { PRODUCT_DESCRIPTION, PRODUCT_NAME } from "@/config/app";

/** Lets people add the app to their phone's home screen with its own icon. */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: PRODUCT_NAME,
    short_name: "Kasama",
    description: PRODUCT_DESCRIPTION,
    start_url: "/",
    display: "standalone",
    background_color: "#f5f4f0",
    theme_color: "#34479e",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
      {
        src: "/icons/icon-maskable-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
