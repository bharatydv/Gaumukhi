/**
 * Display helpers. Values reaching these are already rupees — the paise → rupee
 * conversion happens once, in lib/normalise.ts, at the API boundary.
 */

export const money = (n: number) => "₹" + Number(n || 0).toLocaleString("en-IN");
