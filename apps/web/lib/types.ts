export interface Product {
  id: string | number;
  slug: string;
  name: string;
  category: string;
  price: number;
  mrp: number;
  discountPct?: number;
  mukhi?: number;
  artKind?: string;
  artTone?: string;
  kind?: string;
  tone?: string;
  badge?: string;
  rating: number;
  reviews?: number;
  reviewCount?: number;
  stock: number;
  desc?: string;
  description?: string;
  benefits?: string[];
  material?: string;
  origin?: string;
  weight?: string;
  size?: string;
  wear?: string;
  care?: string;
  sub?: string;
}

export interface Puja {
  id: string;
  name: string;
  dur?: string;
  durationMin?: number;
  price?: number;
  baseFee?: number;
  note?: string;
  description?: string;
  pandits?: number;
}

export interface Pandit {
  id: string;
  name?: string;
  displayName?: string;
  city: string;
  exp?: number;
  experienceYrs?: number;
  rating: number;
  reviews?: number;
  langs?: string[];
  languages?: string[];
  fee?: number;
  dakshina?: number;
  veda: string;
  slots: string[];
}
