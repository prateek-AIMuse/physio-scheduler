/* Phone numbers are stored as digits with the country code (919876543210). A 10-digit number is taken as Indian. */
export function normalizePhone(input: string): string | null {
  let d = input.replace(/\D/g, "");
  if (d.startsWith("00")) d = d.slice(2);
  if (d.length === 11 && d.startsWith("0")) d = d.slice(1);
  if (d.length === 10) d = `91${d}`;
  return /^[1-9]\d{7,14}$/.test(d) ? d : null;
}

export function formatPhone(digits: string): string {
  return digits.startsWith("91") && digits.length === 12 ? `+91 ${digits.slice(2, 7)} ${digits.slice(7)}` : `+${digits}`;
}

export const rupees = (n: number) =>
  `₹${Number(n).toLocaleString("en-IN", { minimumFractionDigits: Number(n) % 1 ? 2 : 0, maximumFractionDigits: 2 })}`;

/* A Google Maps link for a patient: the one the physio pasted, or a search for the address */
export const mapsLink = (address: string, mapsUrl: string) =>
  mapsUrl || (address ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}` : "");
