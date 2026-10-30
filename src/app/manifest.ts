import type { MetadataRoute } from "next";

/* Lets Android (and desktop Chrome/Edge) install the app; iOS uses the apple-touch icon and appleWebApp metadata */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Physio Scheduler",
    short_name: "Physio",
    description: "Physio sessions, packages, payments and WhatsApp reminders.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#06101E",
    theme_color: "#0B3A6E",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
