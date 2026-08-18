import { randomBytes } from 'crypto';

const ALPHABET = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';

function code(len: number): string {
  const bytes = randomBytes(len);
  let out = '';
  for (let i = 0; i < len; i++) out += ALPHABET[bytes[i] % ALPHABET.length];
  return out;
}

export const orderNumber = () => 'DV' + code(8);
export const bookingReference = () => 'PJ' + code(8);
export const invoiceNumber = (seq: number) => `DV-INV-${new Date().getFullYear()}-${String(seq).padStart(6, '0')}`;
export const referralCode = (name?: string) =>
  ((name || 'SADHAK').split(' ')[0].toUpperCase().replace(/[^A-Z]/g, '').slice(0, 6) || 'SADHAK') + code(3);
export const certificateNumber = (kind: string) => `${kind === 'LAB_REPORT' ? 'IGI' : 'DV'}-${code(8)}`;
export const ticketNumber = () => '#' + code(6);
