/* Photos used around the app, served from public/images. Each sits on a blue–teal gradient, so the
   layout still looks finished if a file is missing. Replace a file to change the photo; keep the name. */
export const PHOTOS = {
  hero: { src: "/images/hero.jpg", alt: "A physiotherapist treating a patient's shoulder" },
  clinic: { src: "/images/clinic.jpg", alt: "A patient exercising with the physio at the clinic" },
  home: { src: "/images/home-visit.jpg", alt: "A physiotherapist on a home visit" },
  rehab: { src: "/images/rehab.jpg", alt: "Knee rehabilitation exercise with a physiotherapist" },
  login: { src: "/images/login.jpg", alt: "A physiotherapist guiding a stretch" },
} as const;

export type PhotoKey = keyof typeof PHOTOS;
