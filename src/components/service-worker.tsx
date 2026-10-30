"use client";
import { useEffect } from "react";

/* Registers public/sw.js, which shows an offline page when there's no signal. It never caches
   pages with patient data. */
export function ServiceWorker() {
  useEffect(() => {
    if ("serviceWorker" in navigator && location.protocol === "https:") {
      navigator.serviceWorker.register("/sw.js").catch(() => {});
    }
  }, []);
  return null;
}
