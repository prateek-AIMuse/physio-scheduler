import { PHOTOS, type PhotoKey } from "@/lib/photos";

/* A photo as a background layer over the brand gradient (see .photo in globals.css) */
export function Photo({ name, zoom = false, className = "" }: { name: PhotoKey; zoom?: boolean; className?: string }) {
  const p = PHOTOS[name];
  return <div className={`photo ${zoom ? "zoom" : ""} ${className}`} role="img" aria-label={p.alt} style={{ "--img": `url(${p.src})` } as React.CSSProperties} />;
}
