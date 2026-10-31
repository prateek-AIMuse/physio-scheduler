/* Choices for a practice's region: phone country, currency and time zone */
export const CURRENCIES = ["INR", "USD", "GBP", "EUR", "AED", "SAR", "QAR", "KWD", "OMR", "BHD", "AUD", "NZD", "CAD", "SGD", "MYR", "ZAR", "KES", "NGN", "LKR", "NPR", "BDT", "PKR"];

/* Countries with their calling code and usual currency and time zone, most likely first */
export const COUNTRIES: { code: string; name: string; currency: string; tz: string }[] = [
  { code: "91", name: "India", currency: "INR", tz: "Asia/Kolkata" },
  { code: "1", name: "United States / Canada", currency: "USD", tz: "America/New_York" },
  { code: "44", name: "United Kingdom", currency: "GBP", tz: "Europe/London" },
  { code: "971", name: "United Arab Emirates", currency: "AED", tz: "Asia/Dubai" },
  { code: "966", name: "Saudi Arabia", currency: "SAR", tz: "Asia/Riyadh" },
  { code: "974", name: "Qatar", currency: "QAR", tz: "Asia/Qatar" },
  { code: "965", name: "Kuwait", currency: "KWD", tz: "Asia/Kuwait" },
  { code: "968", name: "Oman", currency: "OMR", tz: "Asia/Muscat" },
  { code: "973", name: "Bahrain", currency: "BHD", tz: "Asia/Bahrain" },
  { code: "61", name: "Australia", currency: "AUD", tz: "Australia/Sydney" },
  { code: "64", name: "New Zealand", currency: "NZD", tz: "Pacific/Auckland" },
  { code: "65", name: "Singapore", currency: "SGD", tz: "Asia/Singapore" },
  { code: "60", name: "Malaysia", currency: "MYR", tz: "Asia/Kuala_Lumpur" },
  { code: "353", name: "Ireland", currency: "EUR", tz: "Europe/Dublin" },
  { code: "49", name: "Germany", currency: "EUR", tz: "Europe/Berlin" },
  { code: "33", name: "France", currency: "EUR", tz: "Europe/Paris" },
  { code: "31", name: "Netherlands", currency: "EUR", tz: "Europe/Amsterdam" },
  { code: "27", name: "South Africa", currency: "ZAR", tz: "Africa/Johannesburg" },
  { code: "254", name: "Kenya", currency: "KES", tz: "Africa/Nairobi" },
  { code: "234", name: "Nigeria", currency: "NGN", tz: "Africa/Lagos" },
  { code: "94", name: "Sri Lanka", currency: "LKR", tz: "Asia/Colombo" },
  { code: "977", name: "Nepal", currency: "NPR", tz: "Asia/Kathmandu" },
  { code: "880", name: "Bangladesh", currency: "BDT", tz: "Asia/Dhaka" },
  { code: "92", name: "Pakistan", currency: "PKR", tz: "Asia/Karachi" },
];

export const countryByCode = (code: string) => COUNTRIES.find((c) => c.code === code) ?? COUNTRIES[0];

/* Every IANA time zone the runtime knows, e.g. Asia/Kolkata, Europe/London */
export function timeZones(): string[] {
  try { return Intl.supportedValuesOf("timeZone"); } catch { return COUNTRIES.map((c) => c.tz); }
}
