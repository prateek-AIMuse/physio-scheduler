/* Phone numbers are stored as digits with the country code (919876543210). A number typed without
   one (a local number, or with a leading 0) takes the practice's country code. */
export function normalizePhone(input: string, countryCode = "91"): string | null {
  const raw = input.trim();
  let d = raw.replace(/\D/g, "");
  if (raw.startsWith("+")) return /^[1-9]\d{7,14}$/.test(d) ? d : null;
  if (d.startsWith("00")) d = d.slice(2);
  else if (countryCode === "91" && d.length === 12 && d.startsWith("91")) { /* already has India's code */ }
  else if (countryCode === "91" && d.length === 10) d = `91${d}`;
  else if (countryCode === "91" && d.length === 11 && d.startsWith("0")) d = `91${d.slice(1)}`;
  else if (countryCode !== "91" && !d.startsWith(countryCode)) d = `${countryCode}${d.replace(/^0+/, "")}`;
  return /^[1-9]\d{7,14}$/.test(d) ? d : null;
}

export function formatPhone(digits: string): string {
  return digits.startsWith("91") && digits.length === 12 ? `+91 ${digits.slice(2, 7)} ${digits.slice(7)}` : `+${digits}`;
}

/* Amounts in the practice's currency: ₹7,500 · $120 · £85.50 */
export function money(n: number, currency = "INR") {
  const value = Number(n);
  try {
    return new Intl.NumberFormat(currency === "INR" ? "en-IN" : "en", {
      style: "currency", currency, minimumFractionDigits: value % 1 ? 2 : 0, maximumFractionDigits: 2,
    }).format(value);
  } catch {
    return `${currency} ${value.toFixed(2)}`;
  }
}

/* A Google Maps link for a patient: the one the physio pasted, or a search for the address */
export const mapsLink = (address: string, mapsUrl: string) =>
  mapsUrl || (address ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}` : "");
