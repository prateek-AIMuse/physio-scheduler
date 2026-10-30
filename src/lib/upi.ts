import QRCode from "qrcode";

/* A UPI payment link (NPCI deep-link format). Opens GPay, PhonePe, Paytm or any UPI app with the amount filled in. */
export function upiLink(opts: { upiId: string; payee: string; amount: number; note: string }): string {
  const q = new URLSearchParams({ pa: opts.upiId, pn: opts.payee || opts.upiId, am: Number(opts.amount).toFixed(2), cu: "INR", tn: opts.note.slice(0, 50) });
  return `upi://pay?${q.toString().replace(/\+/g, "%20")}`;
}

export const upiQrSvg = (link: string) => QRCode.toString(link, { type: "svg", margin: 1, errorCorrectionLevel: "M" });
