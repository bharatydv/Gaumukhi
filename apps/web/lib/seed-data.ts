import type { Product, Puja, Pandit } from "./types";

/* ============================ DATA ============================ */

const money = (n: number) => "₹" + n.toLocaleString("en-IN");

const CATEGORY_TREE = [
  { group: "Rudraksha", items: ["Rudraksha Mala", "Rudraksha Bracelet", "Rudraksha Pendant", "Collector Beads"] },
  { group: "Mala & Jewellery", items: ["Tulsi Mala", "Gemstone Mala", "Sphatik Mala", "Crystal Bracelet", "Spiritual Jewellery"] },
  { group: "Puja & Meditation", items: ["Puja Samagri", "Incense", "Temple Essentials", "Meditation Accessories", "Yantras", "Idols"] },
  { group: "Clothing & Gifting", items: ["Kurta", "Dhoti", "Shawl", "Meditation Wear", "Books", "Gift Boxes"] },
];

const P = (id: number, name: string, category: string, price: number, mrp: number, kind: string, tone: string, mukhi: number, extra: any = {}) => ({
  id, name, category, price, mrp, kind, tone, mukhi,
  slug: name.toLowerCase().replace(/[^a-z0-9]+/g, "-"),
  rating: extra.rating ?? 4.6, reviews: extra.reviews ?? 84, stock: extra.stock ?? 24,
  origin: extra.origin ?? "Nepal (Himalayan belt)",
  weight: extra.weight ?? "18 g", size: extra.size ?? "Adjustable",
  material: extra.material ?? "Natural Rudraksha, gold-plated brass cap",
  badge: extra.badge, sub: extra.sub ?? "Lab certified · X-ray verified",
  desc: extra.desc ?? "Hand-selected, energised at Kashi Vishwanath and dispatched with a tamper-proof authenticity seal.",
  benefits: extra.benefits ?? ["Calms the nervous system and steadies the breath", "Traditionally worn for clarity of thought", "Supports a consistent daily japa practice"],
  wear: extra.wear ?? "Wear after a morning bath. Chant the associated beej mantra 9 times before the first wear.",
  care: extra.care ?? "Oil with mustard or olive oil once a month. Keep away from soap, chlorine and perfume.",
  ...extra,
});

const PRODUCTS = [
  P(1, "Panchmukhi Rudraksha Mala", "Rudraksha Mala", 4499, 6999, "mala", "rudraksha", 5, { badge: "Best seller", rating: 4.8, reviews: 412, weight: "42 g", size: "108 + 1 beads, 8 mm", origin: "Nepal (Himalayan belt)" }),
  P(2, "Ek Mukhi Collector Bead", "Collector Beads", 84999, 119000, "bead", "rudraksha", 1, { badge: "Rare", rating: 4.9, reviews: 37, stock: 2, weight: "6 g", size: "24 mm", material: "Single Ek Mukhi bead, 22K gold capsule" }),
  P(3, "Gauri Shankar Bracelet", "Rudraksha Bracelet", 2899, 3999, "bracelet", "rudraksha", 4, { rating: 4.7, reviews: 268, size: "7.0–8.5 inch elastic" }),
  P(4, "Sphatik Crystal Mala", "Sphatik Mala", 3299, 4799, "mala", "sphatik", 3, { rating: 4.6, reviews: 191, material: "A-grade natural quartz", origin: "Manikaran, Himachal" }),
  P(5, "Tulsi Kanthi Mala", "Tulsi Mala", 899, 1499, "mala", "tulsi", 3, { rating: 4.5, reviews: 322, material: "Vrindavan tulsi wood", origin: "Vrindavan, UP", weight: "12 g" }),
  P(6, "Navratna Gemstone Mala", "Gemstone Mala", 12999, 17500, "mala", "ruby", 4, { badge: "New", rating: 4.7, reviews: 58, material: "Nine certified gemstones, silver spacer" }),
  P(7, "Amethyst Calm Bracelet", "Crystal Bracelet", 1799, 2599, "bracelet", "amethyst", 3, { rating: 4.5, reviews: 240, material: "Natural amethyst, 8 mm" }),
  P(8, "Trimukhi Silver Pendant", "Rudraksha Pendant", 3999, 5499, "pendant", "rudraksha", 3, { rating: 4.8, reviews: 143, material: "Teen Mukhi bead, 925 silver" }),
  P(9, "Shri Yantra — Brass", "Yantras", 2499, 3400, "yantra", "gold", 4, { rating: 4.8, reviews: 96, material: "Cast brass, hand-engraved", size: "6 × 6 inch", weight: "420 g" }),
  P(10, "Temple Brass Diya Set", "Temple Essentials", 1599, 2299, "samagri", "gold", 4, { rating: 4.6, reviews: 130, material: "Brass, set of 5" }),
  P(11, "Saffron Meditation Kurta", "Kurta", 2299, 3199, "cloth", "saffronCloth", 4, { rating: 4.5, reviews: 88, material: "Handloom khadi cotton", size: "S–XXL", weight: "320 g", care: "Cold hand wash. Dry in shade to hold the dye." }),
  P(12, "Cream Dhyana Shawl", "Shawl", 3499, 4799, "cloth", "cream", 4, { rating: 4.7, reviews: 64, material: "Merino–pashmina blend", size: "200 × 90 cm" }),
  P(13, "Sandal & Loban Incense", "Incense", 649, 899, "incense", "rudraksha", 4, { badge: "Refill", rating: 4.4, reviews: 510, material: "Natural resin, bamboo-free" }),
  P(14, "Ganesha Idol — Panchdhatu", "Idols", 5999, 8200, "idol", "gold", 4, { rating: 4.9, reviews: 72, material: "Panchdhatu alloy", weight: "1.1 kg" }),
  P(15, "Meditation Cushion & Mat", "Meditation Accessories", 2799, 3899, "cloth", "saffronCloth", 4, { rating: 4.6, reviews: 156, material: "Buckwheat fill, cotton canvas" }),
  P(16, "Shiva Puja Samagri Kit", "Puja Samagri", 1899, 2600, "samagri", "gold", 4, { badge: "Kit", rating: 4.7, reviews: 204, material: "27 items, ritual-ordered tray" }),
  P(17, "Rudraksha Siddha Kavach", "Spiritual Jewellery", 15999, 21000, "pendant", "rudraksha", 6, { badge: "Signature", rating: 4.9, reviews: 41, material: "1–14 mukhi combination in silver" }),
  P(18, "Bhagavad Gita — Deluxe", "Books", 1299, 1799, "book", "cream", 4, { rating: 4.9, reviews: 388, material: "Hardbound, gilt edge, Sanskrit + English" }),
  P(19, "Sadhaka Gift Box", "Gift Boxes", 4999, 6999, "gift", "gold", 4, { badge: "Gifting", rating: 4.8, reviews: 112, material: "Mala, incense, diya, journal" }),
  P(20, "Handloom Dhoti — Ivory", "Dhoti", 1899, 2499, "cloth", "cream", 4, { rating: 4.4, reviews: 76, material: "Pure cotton, zari border" }),
  P(21, "Emerald Japa Mala", "Gemstone Mala", 18999, 24500, "mala", "emerald", 4, { rating: 4.8, reviews: 29, material: "Certified panna beads" }),
  P(22, "Dasmukhi Protection Bracelet", "Rudraksha Bracelet", 4299, 5899, "bracelet", "rudraksha", 6, { rating: 4.7, reviews: 97 }),
  P(23, "Copper Kalash & Thali", "Temple Essentials", 2199, 2999, "samagri", "gold", 4, { rating: 4.5, reviews: 143, material: "Pure copper" }),
  P(24, "Sattva Meditation Set", "Meditation Wear", 3799, 4999, "cloth", "saffronCloth", 4, { badge: "New", rating: 4.6, reviews: 51, material: "Kurta + pyjama, organic cotton" }),
];

const PUJAS = [
  { id: "griha", name: "Griha Pravesh", dur: "3–4 hrs", price: 11000, note: "House warming, vastu shanti and kalash sthapana", pandits: 2 },
  { id: "satya", name: "Satyanarayan Katha", dur: "2–3 hrs", price: 7500, note: "Full katha with prasad vidhi and havan", pandits: 1 },
  { id: "rudra", name: "Rudrabhishek", dur: "2 hrs", price: 9500, note: "Abhishek with panchamrit and Rudri paath", pandits: 2 },
  { id: "maha", name: "Mahamrityunjaya Jaap", dur: "4–5 hrs", price: 21000, note: "1.25 lakh jaap with havan and purnahuti", pandits: 4 },
  { id: "navgraha", name: "Navgraha Puja", dur: "3 hrs", price: 12500, note: "Nine-planet shanti with individual mantras", pandits: 2 },
  { id: "lakshmi", name: "Lakshmi Puja", dur: "2 hrs", price: 8500, note: "Shree sukta paath and kuber sthapana", pandits: 1 },
  { id: "ganesh", name: "Ganesh Puja", dur: "1.5 hrs", price: 6500, note: "Prathama pujan before any new beginning", pandits: 1 },
  { id: "wedding", name: "Wedding Puja", dur: "5–6 hrs", price: 35000, note: "Complete vivah sanskar with all rituals", pandits: 3 },
  { id: "birthday", name: "Birthday Puja", dur: "1 hr", price: 5500, note: "Ayushya homam and janma nakshatra pujan", pandits: 1 },
  { id: "mundan", name: "Mundan Sanskar", dur: "2 hrs", price: 9000, note: "First tonsure with traditional sankalp", pandits: 1 },
  { id: "vastu", name: "Vastu Puja", dur: "3 hrs", price: 14000, note: "Vastu dosh nivaran for home or office", pandits: 2 },
  { id: "custom", name: "Customized Puja", dur: "Flexible", price: 0, note: "Tell us the sankalp — we build the vidhi", pandits: 1 },
];

const PANDITS = [
  { id: "p1", name: "Pt. Ramesh Chandra Shastri", city: "Varanasi", exp: 24, rating: 4.9, reviews: 612, langs: ["Hindi", "Sanskrit", "Bhojpuri"], fee: 4500, veda: "Yajurveda", slots: ["07:00", "09:30", "16:00"] },
  { id: "p2", name: "Pt. Anand Kumar Trivedi", city: "Ujjain", exp: 17, rating: 4.8, reviews: 388, langs: ["Hindi", "Sanskrit", "English"], fee: 3800, veda: "Rigveda", slots: ["06:30", "11:00", "17:30"] },
  { id: "p3", name: "Acharya Suresh Joshi", city: "Haridwar", exp: 31, rating: 5.0, reviews: 741, langs: ["Hindi", "Sanskrit", "Marathi"], fee: 6200, veda: "Samaveda", slots: ["08:00", "13:00"] },
  { id: "p4", name: "Pt. Vinayak Sharma", city: "Bareilly", exp: 12, rating: 4.7, reviews: 224, langs: ["Hindi", "English"], fee: 3200, veda: "Yajurveda", slots: ["07:30", "10:00", "15:00", "18:00"] },
  { id: "p5", name: "Pt. Krishna Iyer", city: "Chennai", exp: 20, rating: 4.9, reviews: 455, langs: ["Tamil", "Sanskrit", "English"], fee: 5200, veda: "Krishna Yajurveda", slots: ["06:00", "12:30", "17:00"] },
  { id: "p6", name: "Acharya Devendra Mishra", city: "Ayodhya", exp: 27, rating: 4.8, reviews: 529, langs: ["Hindi", "Sanskrit", "Awadhi"], fee: 4800, veda: "Atharvaveda", slots: ["09:00", "14:30"] },
];

const TESTIMONIALS = [
  { n: "Ananya Deshpande", c: "Pune", t: "The X-ray report and the bead both arrived in a sealed box. First time I have felt certain about what I am wearing.", p: "Panchmukhi Mala" },
  { n: "Rohit Malhotra", c: "Gurugram", t: "Booked a Rudrabhishek for my father's recovery. Panditji joined on video at 6am sharp and explained every step in English for my wife.", p: "Rudrabhishek — Online" },
  { n: "Meera Krishnan", c: "Bengaluru", t: "The Sadhaka box was my Diwali gifting solved. Nine of them, each wrapped with a hand-written sankalp card.", p: "Sadhaka Gift Box" },
  { n: "Vikram Singh", c: "Jaipur", t: "Griha pravesh at short notice. Samagri arrived a day early, panditji reached before us, nothing was upsold.", p: "Griha Pravesh — Offline" },
];

const BLOGS = [
  { t: "How to read a Rudraksha X-ray report", c: "Authenticity", d: "6 min", x: "The internal chambers should match the mukhi count on the surface. Here is what a genuine scan looks like." },
  { t: "Ek Mukhi: what makes it rare, and what makes it fake", c: "Rudraksha", d: "9 min", x: "Nearly every 'Ek Mukhi' sold online is a carved Bhadraksha. Four tests you can run yourself." },
  { t: "Choosing a muhurat for Griha Pravesh in 2026", c: "Rituals", d: "7 min", x: "Auspicious dates by month, and why the panchang matters more than the calendar." },
  { t: "Japa for beginners: 108 beads, 21 days", c: "Practice", d: "5 min", x: "A three-week structure that builds the habit without turning it into a chore." },
];

export { money, CATEGORY_TREE, PRODUCTS, PUJAS, PANDITS, TESTIMONIALS, BLOGS };
