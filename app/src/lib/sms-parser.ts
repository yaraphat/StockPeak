/**
 * SMS parser for bKash and Nagad payment confirmation messages.
 *
 * IMPORTANT: verify these regexes against REAL SMS samples before relying on them.
 * Format may differ by bKash/Nagad version. Tests in #33 will include fixtures.
 */

export type SmsProvider = "bkash" | "nagad";

export interface ParsedSms {
  provider: SmsProvider | null;
  amount: number | null;
  senderPhone: string | null;
  trxid: string | null;
}

// bKash examples:
// "Cash In Tk 260.00 from 01712345678 successful. Fee Tk 0.00. Balance Tk 1260.00. TrxID ABC123XYZ at 15/04/2026 14:23"
// "You have received Tk 260.00 from 01712345678. TrxID CDE456 at 15/04/2026 14:23."
const BKASH_PATTERNS = [
  /(?:received|cash\s*in)\s+Tk\s*([\d,]+\.?\d*)\s+from\s+(01\d{9}).*?TrxID\s+([A-Z0-9]+)/i,
  /received\s+Tk\s*([\d,]+\.?\d*)\s+from\s+(01\d{9}).*?Ref\s*(?:TrxID)?\s*([A-Z0-9]+)/i,
];

// Nagad examples:
// "Money Received. Amount: Tk 260.00. Sender: 01712345678. TxnID: XYZ789. Balance: Tk 1260.00"
// "You received Tk 260.00 from 01712345678. TxnID: ABC999."
const NAGAD_PATTERNS = [
  /(?:received|money\s*received).*?Tk\s*([\d,]+\.?\d*).*?(?:from|sender:?)\s*(01\d{9}).*?(?:TxnID|TrxID):?\s*([A-Z0-9]+)/i,
  /Tk\s*([\d,]+\.?\d*)\s+received\s+from\s+(01\d{9}).*?(?:TxnID|TrxID):?\s*([A-Z0-9]+)/i,
];

export function parseSms(senderName: string, body: string): ParsedSms {
  const lowerSender = senderName.toLowerCase();
  const lowerBody = body.toLowerCase();

  let provider: SmsProvider | null = null;
  if (lowerSender.includes("bkash") || lowerBody.includes("bkash")) provider = "bkash";
  else if (lowerSender.includes("nagad") || lowerBody.includes("nagad")) provider = "nagad";

  const patterns = provider === "bkash" ? BKASH_PATTERNS : provider === "nagad" ? NAGAD_PATTERNS : [];

  for (const re of patterns) {
    const m = body.match(re);
    if (m) {
      const amount = parseFloat(m[1].replace(/,/g, ""));
      const senderPhone = m[2];
      const trxid = m[3];
      if (!isNaN(amount) && senderPhone && trxid) {
        return { provider, amount, senderPhone, trxid };
      }
    }
  }

  return { provider, amount: null, senderPhone: null, trxid: null };
}

export function normalizePhone(phone: string): string {
  // Strip non-digits. Accept: 01XXXXXXXXX (11 digit local), +8801XXXXXXXXX, 8801XXXXXXXXX
  const digits = phone.replace(/\D/g, "");
  if (digits.startsWith("88") && digits.length === 13) return digits.slice(2);
  if (digits.startsWith("8801") && digits.length === 14) return digits.slice(3);
  return digits;
}

export function isValidBdMobile(phone: string): boolean {
  const n = normalizePhone(phone);
  return /^01[3-9]\d{8}$/.test(n);
}
