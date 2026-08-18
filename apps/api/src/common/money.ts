/** Everything server-side is paise. These helpers keep that honest. */
export const rupees = (paise: number) => paise / 100;
export const toPaise = (rupees: number) => Math.round(rupees * 100);

export const formatINR = (paise: number) =>
  '₹' + (paise / 100).toLocaleString('en-IN', { maximumFractionDigits: 2 });

/** GST is inclusive in the listed price; this extracts the tax component. */
export function taxComponent(grossPaise: number, ratePct: number): number {
  return Math.round(grossPaise - grossPaise / (1 + ratePct / 100));
}

export function percentOff(mrp: number, price: number): number {
  if (!mrp || mrp <= price) return 0;
  return Math.round(((mrp - price) / mrp) * 100);
}
