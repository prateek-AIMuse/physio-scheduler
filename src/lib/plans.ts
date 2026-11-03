/* Subscription plans for physios, shown on the home page. Prices are monthly, in rupees; yearly billing
   charges ten months for twelve. Edit here to change what the home page shows. */
export type Plan = {
  id: "starter" | "pro" | "clinic";
  name: string;
  monthly: number; // 0 = free
  blurb: string;
  limit: string;
  features: string[];
  cta: string;
  featured?: boolean;
};

export const YEARLY_MONTHS_CHARGED = 10;
export const TRIAL_DAYS = 30;

export const PLANS: Plan[] = [
  {
    id: "starter",
    name: "Starter",
    monthly: 0,
    blurb: "For physios just getting started or moving off a notebook.",
    limit: "Up to 15 active patients",
    features: [
      "Calendar, working hours and one-tap week planner",
      "Prepaid packages with automatic session counter",
      "UPI payment requests with QR code",
      "One-tap WhatsApp reminders and weekly schedules",
      "Your practice page at movera.app/your-name",
    ],
    cta: "Start free",
  },
  {
    id: "pro",
    name: "Professional",
    monthly: 799,
    blurb: "For independent physios running a full clinic and home-visit practice.",
    limit: "Unlimited patients",
    features: [
      "Everything in Starter",
      "Your own mini website: profile, services, prices and online booking",
      "Patient self-booking, rescheduling and cancellation rules",
      "Home exercise programmes with daily tracking",
      "Online payments through your own Razorpay or Stripe",
      "Automatic WhatsApp sending (with your WhatsApp Business number)",
    ],
    cta: `Try free for ${TRIAL_DAYS} days`,
    featured: true,
  },
  {
    id: "clinic",
    name: "Clinic",
    monthly: 1999,
    blurb: "For clinics with a small team of physios and more than one location.",
    limit: "Up to 5 physios, unlimited patients",
    features: [
      "Everything in Professional",
      "Mini website on your own domain, with your logo and colours",
      "A calendar per physio and per location",
      "Practice reports: visits, revenue and outstanding payments",
      "Priority onboarding: we move your patient list in for you",
    ],
    cta: "Talk to us",
  },
];

export function formatRupees(n: number) {
  return `₹${n.toLocaleString("en-IN")}`;
}
