/* Photos used around the app, served from public/images (free Pexels photos; credits in the README). Each sits on a blue–teal gradient, so the
   layout still looks finished if a file is missing. Replace a file to change the photo; keep the name. */
export const PHOTOS = {
  hero: { src: "/images/hero.jpg", alt: "A physiotherapist treating a patient on the treatment table" },
  clinic: { src: "/images/clinic.jpg", alt: "A physiotherapist assessing a patient's shoulder at the clinic" },
  home: { src: "/images/home-visit.jpg", alt: "A physiotherapist helping an older patient stretch at home" },
  rehab: { src: "/images/rehab.jpg", alt: "A physiotherapist applying kinesiology tape to a patient's back" },
  login: { src: "/images/login.jpg", alt: "A physiotherapist guiding an assisted leg stretch" },
} as const;

export type PhotoKey = keyof typeof PHOTOS;
