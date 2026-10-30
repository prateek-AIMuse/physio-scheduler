import type { NextConfig } from "next";
import { initOpenNextCloudflareForDev } from "@opennextjs/cloudflare";

const nextConfig: NextConfig = {
  reactCompiler: true,
  /* Photos are pre-sized WebP files in public/images; Workers has no image optimiser configured */
  images: { unoptimized: true },
};

export default nextConfig;

/* Lets `next dev` read Cloudflare bindings and request.cf, as in production */
initOpenNextCloudflareForDev();
