import QRCode from "qrcode";

/* A UPI payment link (NPCI deep-link format). Opens GPay, PhonePe, Paytm or any UPI app with the amount filled in.
   The UPI ID stays unencoded (some apps don't decode %40); the other values are encoded. */
export function upiLink(opts: { upiId: string; payee: string; amount: number; note: string }): string {
  const enc = encodeURIComponent;
  return `upi://pay?pa=${opts.upiId}&pn=${enc(opts.payee || opts.upiId)}&am=${Number(opts.amount).toFixed(2)}&cu=INR&tn=${enc(opts.note.slice(0, 50))}`;
}

export const upiQrSvg = (link: string) => QRCode.toString(link, { type: "svg", margin: 1, errorCorrectionLevel: "M" });
