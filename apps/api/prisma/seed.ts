/**
 * Seeds a working shop: catalogue, pujas, pandits with 30 days of open slots,
 * coupons, blog posts and one demo account per role.
 *
 *   npm run seed
 */
import { PrismaClient, Role, CouponType, BookingMode, PanditStatus, SlotStatus } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const rs = (rupees: number) => rupees * 100; // paise

const CATEGORIES: Array<[string, string]> = [
  ['Rudraksha Mala', 'Rudraksha'],
  ['Rudraksha Bracelet', 'Rudraksha'],
  ['Rudraksha Pendant', 'Rudraksha'],
  ['Collector Beads', 'Rudraksha'],
  ['Tulsi Mala', 'Mala & Jewellery'],
  ['Gemstone Mala', 'Mala & Jewellery'],
  ['Sphatik Mala', 'Mala & Jewellery'],
  ['Crystal Bracelet', 'Mala & Jewellery'],
  ['Spiritual Jewellery', 'Mala & Jewellery'],
  ['Puja Samagri', 'Puja & Meditation'],
  ['Incense', 'Puja & Meditation'],
  ['Temple Essentials', 'Puja & Meditation'],
  ['Meditation Accessories', 'Puja & Meditation'],
  ['Yantras', 'Puja & Meditation'],
  ['Idols', 'Puja & Meditation'],
  ['Kurta', 'Clothing & Gifting'],
  ['Dhoti', 'Clothing & Gifting'],
  ['Shawl', 'Clothing & Gifting'],
  ['Meditation Wear', 'Clothing & Gifting'],
  ['Books', 'Clothing & Gifting'],
  ['Gift Boxes', 'Clothing & Gifting'],
];

type P = {
  name: string; category: string; price: number; mrp: number; kind: string; tone: string;
  mukhi?: number; stock: number; badge?: string; origin?: string; material?: string;
  weight?: number; featured?: boolean; desc: string; benefits: string[];
};

const PRODUCTS: P[] = [
  {
    name: 'Panchmukhi Rudraksha Mala', category: 'Rudraksha Mala', price: rs(4499), mrp: rs(6999),
    kind: 'mala', tone: 'rudraksha', mukhi: 5, stock: 42, badge: 'Best seller', featured: true,
    origin: 'Nepal (Himalayan belt)', material: 'Natural Rudraksha on double-braided silk', weight: 42,
    desc: '108 beads plus a guru bead, matched by hand to within 0.3 mm. Knotted between each bead so a single break never scatters the mala. Ships with its X-ray scan and a tamper seal you break yourself.',
    benefits: ['Calms the nervous system and steadies the breath', 'Traditionally worn for clarity of thought', 'Supports a consistent daily japa practice'],
  },
  {
    name: 'Ek Mukhi Collector Bead', category: 'Collector Beads', price: rs(84999), mrp: rs(119000),
    kind: 'bead', tone: 'rudraksha', mukhi: 1, stock: 2, badge: 'Rare',
    origin: 'Java, Indonesia', material: 'Single Ek Mukhi bead in a 22K gold capsule', weight: 6,
    desc: 'A genuine single-faced bead, photographed, weighed and X-rayed before listing. Nearly every Ek Mukhi sold online is a carved Bhadraksha; the scan in the box shows the internal chamber that proves this one is not.',
    benefits: ['The most sought-after bead in the tradition', 'Sold with full provenance and lab documentation', 'Single-owner piece, never restocked'],
  },
  {
    name: 'Gauri Shankar Bracelet', category: 'Rudraksha Bracelet', price: rs(2899), mrp: rs(3999),
    kind: 'bracelet', tone: 'rudraksha', mukhi: 4, stock: 68, featured: true,
    material: 'Naturally joined twin beads on elastic', weight: 18,
    desc: 'Naturally fused twin beads, worn for harmony between partners. Sized 7.0–8.5 inch on a doubled elastic core that survives daily wear.',
    benefits: ['Worn traditionally for harmony in relationships', 'Comfortable enough for continuous daily wear', 'Each pair is naturally joined, never glued'],
  },
  {
    name: 'Sphatik Crystal Mala', category: 'Sphatik Mala', price: rs(3299), mrp: rs(4799),
    kind: 'mala', tone: 'sphatik', mukhi: 3, stock: 31,
    origin: 'Manikaran, Himachal Pradesh', material: 'A-grade natural quartz', weight: 38,
    desc: 'Clear quartz cut and polished in Manikaran. Cool to the touch even in summer, which is why it is the traditional choice for long sits in warm months.',
    benefits: ['Stays cool against the skin during long practice', 'Favoured for Lakshmi and Saraswati mantras', 'Every bead hand-checked for internal fractures'],
  },
  {
    name: 'Tulsi Kanthi Mala', category: 'Tulsi Mala', price: rs(899), mrp: rs(1499),
    kind: 'mala', tone: 'tulsi', mukhi: 3, stock: 120,
    origin: 'Vrindavan, Uttar Pradesh', material: 'Vrindavan tulsi wood', weight: 12,
    desc: 'Turned from mature tulsi wood in Vrindavan. The grain darkens with wear, which is the point — a two-year-old kanthi looks nothing like a new one.',
    benefits: ['The traditional kanthi for Vaishnava practice', 'Light enough to be forgotten while worn', 'Deepens in colour and character over years'],
  },
  {
    name: 'Navratna Gemstone Mala', category: 'Gemstone Mala', price: rs(12999), mrp: rs(17500),
    kind: 'mala', tone: 'ruby', mukhi: 4, stock: 9, badge: 'New',
    material: 'Nine certified gemstones with silver spacers', weight: 46,
    desc: 'Nine stones for the nine grahas, each one certified individually. The certificates are in the box, numbered to match the stones.',
    benefits: ['One stone for each of the nine planets', 'Every stone individually lab-certified', 'Set in silver so the stones sit against skin'],
  },
  {
    name: 'Amethyst Calm Bracelet', category: 'Crystal Bracelet', price: rs(1799), mrp: rs(2599),
    kind: 'bracelet', tone: 'amethyst', mukhi: 3, stock: 54,
    material: 'Natural amethyst, 8 mm', weight: 22,
    desc: 'Deep-toned Brazilian amethyst, graded for even colour rather than maximum saturation, so the beads match each other.',
    benefits: ['Chosen for evening practice and sleep routines', 'Colour-matched across the full strand', 'Elastic core rated for daily wear'],
  },
  {
    name: 'Trimukhi Silver Pendant', category: 'Rudraksha Pendant', price: rs(3999), mrp: rs(5499),
    kind: 'pendant', tone: 'rudraksha', mukhi: 3, stock: 27,
    material: 'Teen Mukhi bead in 925 silver', weight: 14,
    desc: 'A three-faced bead in a hallmarked silver cap, on a 20-inch chain. The cap is open-backed so the bead still touches skin.',
    benefits: ['Worn traditionally to release the weight of the past', 'Open-backed setting keeps bead against skin', '925 hallmarked silver, not plate'],
  },
  {
    name: 'Shri Yantra — Brass', category: 'Yantras', price: rs(2499), mrp: rs(3400),
    kind: 'yantra', tone: 'gold', stock: 38,
    material: 'Cast brass, hand-engraved', weight: 420,
    desc: 'Cast then engraved by hand in Moradabad, 6 × 6 inch. The nine interlocking triangles are cut to traditional proportion, not stamped.',
    benefits: ['Engraved to traditional proportion', 'Sits flat on any altar or desk', 'Weight and finish improve with age'],
  },
  {
    name: 'Temple Brass Diya Set', category: 'Temple Essentials', price: rs(1599), mrp: rs(2299),
    kind: 'samagri', tone: 'gold', stock: 76,
    material: 'Brass, set of five', weight: 640,
    desc: 'Five diyas in graduated sizes, spun from a single sheet so the wall thickness is even and they do not tip when full.',
    benefits: ['Even wall thickness means they never tip', 'Graduated sizes for a full altar', 'Cleans back to a shine with tamarind'],
  },
  {
    name: 'Saffron Meditation Kurta', category: 'Kurta', price: rs(2299), mrp: rs(3199),
    kind: 'cloth', tone: 'saffronCloth', stock: 44,
    material: 'Handloom khadi cotton', weight: 320,
    desc: 'Cut wide through the hip so you can sit cross-legged without the fabric pulling. Handloom khadi, dyed with a colour-fast saffron.',
    benefits: ['Cut for sitting, not for standing', 'Breathes through a two-hour session', 'Softens with every wash'],
  },
  {
    name: 'Cream Dhyana Shawl', category: 'Shawl', price: rs(3499), mrp: rs(4799),
    kind: 'cloth', tone: 'cream', stock: 22,
    material: 'Merino–pashmina blend, 200 × 90 cm', weight: 380,
    desc: 'Warm enough for a 4am sit in December without the bulk that makes you shift position.',
    benefits: ['Warm without weight', 'Large enough to sit inside fully', 'Blend resists pilling at the shoulders'],
  },
  {
    name: 'Sandal & Loban Incense', category: 'Incense', price: rs(649), mrp: rs(899),
    kind: 'incense', tone: 'rudraksha', stock: 210, badge: 'Refill',
    material: 'Natural resin, bamboo-free', weight: 120,
    desc: 'Bamboo-free sticks, so there is no burnt-wood note underneath the sandal. Rolled in small batches in Mysuru.',
    benefits: ['No bamboo core, so no burnt undertone', 'Burns evenly for 40 minutes', 'Natural resin, no synthetic fragrance'],
  },
  {
    name: 'Ganesha Idol — Panchdhatu', category: 'Idols', price: rs(5999), mrp: rs(8200),
    kind: 'idol', tone: 'gold', stock: 12,
    material: 'Panchdhatu five-metal alloy', weight: 1100,
    desc: 'Cast in the traditional five-metal alloy by a Swamimalai workshop, using lost-wax. Weight and proportion follow the shilpa shastra measures.',
    benefits: ['Traditional lost-wax casting', 'Proportioned to shilpa shastra measures', 'Develops a patina rather than tarnishing'],
  },
  {
    name: 'Meditation Cushion & Mat', category: 'Meditation Accessories', price: rs(2799), mrp: rs(3899),
    kind: 'cloth', tone: 'saffronCloth', stock: 35,
    material: 'Buckwheat fill, cotton canvas', weight: 2400,
    desc: 'Buckwheat hull fill that holds its shape under you instead of flattening, with a zip so you can remove hulls to lower the seat.',
    benefits: ['Adjustable height via the fill zip', 'Holds shape through a long sit', 'Cover washes separately'],
  },
  {
    name: 'Shiva Puja Samagri Kit', category: 'Puja Samagri', price: rs(1899), mrp: rs(2600),
    kind: 'samagri', tone: 'gold', stock: 88, badge: 'Kit',
    material: '27 items on a ritual-ordered tray', weight: 1800,
    desc: 'Twenty-seven items laid out in the order a pandit will ask for them, with a printed vidhi card. Removes the scramble mid-ritual.',
    benefits: ['Arranged in the order of use', 'Printed vidhi card included', 'Everything sourced fresh, dated on the box'],
  },
  {
    name: 'Rudraksha Siddha Kavach', category: 'Spiritual Jewellery', price: rs(15999), mrp: rs(21000),
    kind: 'pendant', tone: 'rudraksha', mukhi: 6, stock: 6, badge: 'Signature', featured: true,
    material: '1–14 mukhi combination set in silver', weight: 68,
    desc: 'The full one-to-fourteen mukhi set in a single silver kavach, each bead X-rayed and numbered against its position in the certificate.',
    benefits: ['Complete 1–14 mukhi combination', 'Every bead individually X-rayed and numbered', 'Assembled and strung to order'],
  },
  {
    name: 'Bhagavad Gita — Deluxe', category: 'Books', price: rs(1299), mrp: rs(1799),
    kind: 'book', tone: 'cream', stock: 140,
    material: 'Hardbound, gilt edge, Sanskrit with English', weight: 900,
    desc: 'Devanagari and English on facing pages, with word-by-word transliteration underneath. Sewn binding that opens flat.',
    benefits: ['Facing-page Sanskrit and English', 'Sewn to open flat at any page', 'Word-by-word transliteration throughout'],
  },
  {
    name: 'Sadhaka Gift Box', category: 'Gift Boxes', price: rs(4999), mrp: rs(6999),
    kind: 'gift', tone: 'gold', stock: 48, badge: 'Gifting', featured: true,
    material: 'Mala, incense, diya, journal', weight: 1200,
    desc: 'A mala, incense, a brass diya and a japa journal in a hand-tied box, with a card you can have written in Devanagari.',
    benefits: ['Complete starter set for a new practice', 'Hand-tied with a written sankalp card', 'Ships gift-ready, no invoice inside'],
  },
  {
    name: 'Handloom Dhoti — Ivory', category: 'Dhoti', price: rs(1899), mrp: rs(2499),
    kind: 'cloth', tone: 'cream', stock: 40,
    material: 'Pure cotton with zari border', weight: 280,
    desc: 'Four and a half metres of pure handloom cotton with a narrow zari border that does not scratch.',
    benefits: ['Full 4.5 m traditional length', 'Narrow border sits flat when tied', 'Pre-washed so it does not shrink'],
  },
  {
    name: 'Emerald Japa Mala', category: 'Gemstone Mala', price: rs(18999), mrp: rs(24500),
    kind: 'mala', tone: 'emerald', mukhi: 4, stock: 4,
    material: 'Certified panna beads', weight: 52,
    desc: 'Certified emerald beads graded for transparency over size. Comes with the lab report for the parcel the beads were cut from.',
    benefits: ['Graded for transparency, not carat weight', 'Lab report for the source parcel included', 'Strung on silk, re-knotted free for life'],
  },
  {
    name: 'Dasmukhi Protection Bracelet', category: 'Rudraksha Bracelet', price: rs(4299), mrp: rs(5899),
    kind: 'bracelet', tone: 'rudraksha', mukhi: 6, stock: 19,
    material: 'Das Mukhi beads on elastic', weight: 24,
    desc: 'Ten-faced beads, the traditional choice for travel and unsettled periods. Each bead scanned before stringing.',
    benefits: ['Traditionally worn during travel', 'Every bead scanned before stringing', 'Sized to order at no extra cost'],
  },
  {
    name: 'Copper Kalash & Thali', category: 'Temple Essentials', price: rs(2199), mrp: rs(2999),
    kind: 'samagri', tone: 'gold', stock: 52,
    material: 'Pure copper, hand-beaten', weight: 850,
    desc: 'Hand-beaten pure copper, unlacquered so it can be cleaned traditionally and used for water.',
    benefits: ['Unlacquered, safe for storing water', 'Hand-beaten, no two identical', 'Cleans with lemon and salt'],
  },
  {
    name: 'Sattva Meditation Set', category: 'Meditation Wear', price: rs(3799), mrp: rs(4999),
    kind: 'cloth', tone: 'saffronCloth', stock: 26, badge: 'New',
    material: 'Kurta and pyjama in organic cotton', weight: 520,
    desc: 'Kurta and pyjama cut from the same organic cotton, with a drawstring that sits below the navel so it does not press when you sit.',
    benefits: ['Drawstring sits clear of the navel', 'Organic cotton, GOTS certified', 'Matched dye lot across both pieces'],
  },
];

const PUJAS = [
  ['Griha Pravesh', 210, 11000, 2400, 2, 'House warming with vastu shanti and kalash sthapana'],
  ['Satyanarayan Katha', 150, 7500, 1800, 1, 'Full katha with prasad vidhi and havan'],
  ['Rudrabhishek', 120, 9500, 2200, 2, 'Abhishek with panchamrit and Rudri paath'],
  ['Mahamrityunjaya Jaap', 270, 21000, 3600, 4, '1.25 lakh jaap with havan and purnahuti'],
  ['Navgraha Puja', 180, 12500, 2600, 2, 'Nine-planet shanti with individual graha mantras'],
  ['Lakshmi Puja', 120, 8500, 1900, 1, 'Shree sukta paath with kuber sthapana'],
  ['Ganesh Puja', 90, 6500, 1400, 1, 'Prathama pujan before any new beginning'],
  ['Wedding Puja', 330, 35000, 6800, 3, 'Complete vivah sanskar with all rituals'],
  ['Birthday Puja', 60, 5500, 1200, 1, 'Ayushya homam with janma nakshatra pujan'],
  ['Mundan Sanskar', 120, 9000, 2100, 1, 'First tonsure with traditional sankalp'],
  ['Vastu Puja', 180, 14000, 2900, 2, 'Vastu dosh nivaran for a home or office'],
  ['Customized Puja', 120, 9000, 2000, 1, 'Tell us the sankalp and we build the vidhi'],
] as const;

const PANDITS = [
  ['Pt. Ramesh Chandra Shastri', 'Varanasi', 24, 'Yajurveda', ['Hindi', 'Sanskrit', 'Bhojpuri'], 4500],
  ['Pt. Anand Kumar Trivedi', 'Ujjain', 17, 'Rigveda', ['Hindi', 'Sanskrit', 'English'], 3800],
  ['Acharya Suresh Joshi', 'Haridwar', 31, 'Samaveda', ['Hindi', 'Sanskrit', 'Marathi'], 6200],
  ['Pt. Vinayak Sharma', 'Bareilly', 12, 'Yajurveda', ['Hindi', 'English'], 3200],
  ['Pt. Krishna Iyer', 'Chennai', 20, 'Krishna Yajurveda', ['Tamil', 'Sanskrit', 'English'], 5200],
  ['Acharya Devendra Mishra', 'Ayodhya', 27, 'Atharvaveda', ['Hindi', 'Sanskrit', 'Awadhi'], 4800],
] as const;

const SLOTS = ['06:30', '08:00', '11:00', '14:00', '18:00', '21:00'];

const POSTS = [
  ['How to read a Rudraksha X-ray report', 'Authenticity', 6,
    'The internal chambers should match the mukhi count visible on the surface. Here is what a genuine scan looks like, and the three artefacts that give away a carved bead.'],
  ['Ek Mukhi: what makes it rare, and what makes it fake', 'Rudraksha', 9,
    'Nearly every Ek Mukhi sold online is a carved Bhadraksha. Four tests you can run yourself before you spend anything.'],
  ['Choosing a muhurat for Griha Pravesh in 2026', 'Rituals', 7,
    'Auspicious dates month by month, and why the panchang matters more than the calendar when you are handing over keys.'],
  ['Japa for beginners: 108 beads, 21 days', 'Practice', 5,
    'A three-week structure that builds the habit without turning it into a chore you resent by day nine.'],
] as const;

async function main() {
  console.log('Clearing existing data…');
  await prisma.$transaction([
    prisma.auditLog.deleteMany(), prisma.notification.deleteMany(), prisma.ticket.deleteMany(),
    prisma.pointsEntry.deleteMany(), prisma.couponUsage.deleteMany(), prisma.review.deleteMany(),
    prisma.question.deleteMany(), prisma.payout.deleteMany(), prisma.payment.deleteMany(),
    prisma.webhookEvent.deleteMany(), prisma.refund.deleteMany(), prisma.invoice.deleteMany(),
    prisma.shipment.deleteMany(), prisma.orderItem.deleteMany(), prisma.order.deleteMany(),
    prisma.cartItem.deleteMany(), prisma.cart.deleteMany(), prisma.wishlistItem.deleteMany(),
    prisma.availability.deleteMany(), prisma.booking.deleteMany(), prisma.panditService.deleteMany(),
    prisma.panditCertificate.deleteMany(), prisma.pandit.deleteMany(), prisma.puja.deleteMany(),
    prisma.certificate.deleteMany(), prisma.media.deleteMany(), prisma.inventory.deleteMany(),
    prisma.variant.deleteMany(), prisma.seo.deleteMany(), prisma.product.deleteMany(),
    prisma.category.deleteMany(), prisma.warehouse.deleteMany(), prisma.coupon.deleteMany(),
    prisma.post.deleteMany(), prisma.page.deleteMany(), prisma.banner.deleteMany(),
    prisma.homeSection.deleteMany(), prisma.setting.deleteMany(),
    prisma.refreshToken.deleteMany(), prisma.otpChallenge.deleteMany(), prisma.user.deleteMany(),
  ]);

  // ── warehouses ───────────────────────────────────────────────
  const warehouse = await prisma.warehouse.create({
    data: { code: 'VNS', name: 'Varanasi Main', city: 'Varanasi', pincode: '221001' },
  });
  await prisma.warehouse.create({
    data: { code: 'DEL', name: 'Delhi Forward', city: 'New Delhi', pincode: '110020' },
  });

  // ── categories ───────────────────────────────────────────────
  const categoryMap = new Map<string, string>();
  for (const [i, [name, group]] of CATEGORIES.entries()) {
    const c = await prisma.category.create({
      data: {
        name, groupName: group, slug: slug(name), displayOrder: i,
        description: `${name} — sourced, verified and dispatched from our Varanasi workshop.`,
      },
    });
    categoryMap.set(name, c.id);
  }
  console.log(`Seeded ${CATEGORIES.length} categories`);

  // ── products ─────────────────────────────────────────────────
  for (const p of PRODUCTS) {
    const product = await prisma.product.create({
      data: {
        name: p.name,
        slug: slug(p.name),
        sku: 'DV-' + slug(p.name).toUpperCase().slice(0, 14),
        categoryId: categoryMap.get(p.category)!,
        description: p.desc,
        benefits: p.benefits,
        howToWear: 'Wear after a morning bath. Chant the associated beej mantra nine times before the first wear.',
        careNotes: 'Oil with mustard or olive oil once a month. Keep away from soap, chlorine and perfume.',
        mrp: p.mrp,
        price: p.price,
        gstRate: p.kind === 'cloth' ? 5 : p.kind === 'book' ? 12 : 3,
        mukhi: p.mukhi,
        origin: p.origin ?? 'India',
        material: p.material,
        weightGrams: p.weight,
        artKind: p.kind,
        artTone: p.tone,
        badge: p.badge,
        featured: p.featured ?? false,
        ratingAvg: 4.4 + Math.random() * 0.5,
        ratingCount: Math.floor(20 + Math.random() * 400),
        soldCount: Math.floor(Math.random() * 500),
        seo: {
          create: {
            title: `${p.name} — certified & X-ray verified | Divyaloka`,
            metaDescription: p.desc.slice(0, 155),
          },
        },
        certificates: {
          create: [
            { kind: 'AUTHENTICITY', number: `DV-CERT-${Math.floor(10000 + Math.random() * 89999)}`, issuer: 'Divyaloka Sourcing' },
            { kind: 'LAB_REPORT', number: `IGI-${Math.floor(100000 + Math.random() * 899999)}`, issuer: 'IGI Varanasi' },
          ],
        },
      },
    });

    const variant = await prisma.variant.create({
      data: { productId: product.id, sku: product.sku + '-STD', label: 'Standard', isDefault: true },
    });
    await prisma.inventory.create({
      data: { variantId: variant.id, warehouseId: warehouse.id, onHand: p.stock, reorderPoint: 6 },
    });
  }
  console.log(`Seeded ${PRODUCTS.length} products`);

  // ── pujas ────────────────────────────────────────────────────
  const pujaIds: string[] = [];
  for (const [i, [name, durationMin, baseFee, samagriFee, panditCount, description]] of PUJAS.entries()) {
    const puja = await prisma.puja.create({
      data: {
        name, slug: slug(name), description,
        durationMin, baseFee: rs(baseFee), samagriFee: rs(samagriFee),
        panditCount, displayOrder: i,
      },
    });
    pujaIds.push(puja.id);
  }
  console.log(`Seeded ${PUJAS.length} pujas`);

  // ── users ────────────────────────────────────────────────────
  const password = await bcrypt.hash('divyaloka123', 12);

  const admin = await prisma.user.create({
    data: { email: 'admin@divyaloka.com', name: 'Ops Admin', passwordHash: password, role: Role.SUPER_ADMIN, referralCode: 'ADMIN01' },
  });
  await prisma.user.create({
    data: { email: 'support@divyaloka.com', name: 'Support Desk', passwordHash: password, role: Role.SUPPORT, referralCode: 'SUPP01' },
  });
  await prisma.user.create({
    data: { email: 'puja@divyaloka.com', name: 'Puja Coordinator', passwordHash: password, role: Role.PUJA_COORDINATOR, referralCode: 'PUJA01' },
  });

  const customer = await prisma.user.create({
    data: {
      email: 'aarav@example.com', phone: '9876543210', name: 'Aarav Sharma',
      passwordHash: password, role: Role.CUSTOMER, points: 1240, referralCode: 'AARAV500',
      addresses: {
        create: [
          { label: 'Home', name: 'Aarav Sharma', phone: '9876543210', line1: '12 Civil Lines', city: 'Bareilly', state: 'Uttar Pradesh', pincode: '243001', isDefault: true },
          { label: 'Office', name: 'Aarav Sharma', phone: '9876543210', line1: '4th Floor, Sector 62', city: 'Noida', state: 'Uttar Pradesh', pincode: '201301' },
        ],
      },
    },
  });

  // ── pandits with 30 days of open slots ───────────────────────
  for (const [i, [name, city, exp, veda, languages, dakshina]] of PANDITS.entries()) {
    const user = await prisma.user.create({
      data: {
        email: `pandit${i + 1}@divyaloka.com`,
        phone: `98765432${20 + i}`,
        name,
        passwordHash: password,
        role: Role.PANDIT,
        referralCode: `PANDIT${i + 1}`,
      },
    });

    const pandit = await prisma.pandit.create({
      data: {
        userId: user.id,
        displayName: name,
        city,
        experienceYrs: exp,
        veda,
        languages: [...languages],
        dakshina: rs(dakshina),
        status: PanditStatus.APPROVED,
        ratingAvg: 4.7 + Math.random() * 0.3,
        ratingCount: Math.floor(200 + Math.random() * 550),
        bio: `${exp} years of karmakand practice in ${city}, trained in the ${veda} tradition.`,
        certificates: {
          create: [{ title: 'Karmakand Diploma', issuer: 'Sampurnanand Sanskrit University', verifiedAt: new Date() }],
        },
        services: { create: pujaIds.slice(0, 8).map((pujaId) => ({ pujaId })) },
      },
    });

    // Open a realistic subset of slots across the next 30 days.
    const rows: Array<{ panditId: string; date: Date; slot: string; status: SlotStatus }> = [];
    for (let d = 0; d < 30; d++) {
      const date = new Date();
      date.setUTCHours(0, 0, 0, 0);
      date.setDate(date.getDate() + d);
      for (const s of SLOTS) {
        if (Math.random() < 0.35) continue; // pandits are not free all day
        rows.push({ panditId: pandit.id, date, slot: s, status: SlotStatus.OPEN });
      }
    }
    await prisma.availability.createMany({ data: rows, skipDuplicates: true });
  }
  console.log(`Seeded ${PANDITS.length} pandits with availability`);

  // ── coupons ──────────────────────────────────────────────────
  await prisma.coupon.createMany({
    data: [
      { code: 'SHRAVAN20', type: CouponType.PERCENT, value: 20, maxDiscount: rs(3000), minCart: rs(2000), usageLimit: 1000, appliesToPuja: true, expiresAt: new Date(Date.now() + 6 * 86400000) },
      { code: 'FIRST500', type: CouponType.FLAT, value: rs(500), minCart: rs(2500), perUserLimit: 1 },
      { code: 'DIWALI30', type: CouponType.PERCENT, value: 30, maxDiscount: rs(5000), minCart: rs(5000), usageLimit: 2000, startsAt: new Date('2026-10-15'), expiresAt: new Date('2026-10-25') },
      { code: 'REFER500', type: CouponType.REFERRAL, value: rs(500), minCart: rs(2000) },
    ],
  });

  // ── content ──────────────────────────────────────────────────
  for (const [title, categoryName, readMinutes, excerpt] of POSTS) {
    await prisma.post.create({
      data: {
        title, slug: slug(title), excerpt, categoryName, readMinutes,
        body: `${excerpt}\n\nWritten by the Divyaloka sourcing team in Varanasi. We do not run affiliate links or sponsored placements — if we recommend something, we sell it or we do not stock it at all.`,
        authorName: 'Divyaloka Sourcing', published: true, publishedAt: new Date(),
      },
    });
  }

  await prisma.page.createMany({
    data: [
      { slug: 'about', title: 'Our story', body: 'Divyaloka began in 1974 as a single counter near Dashashwamedh Ghat…' },
      { slug: 'terms', title: 'Terms of service', body: 'These terms govern your use of divyaloka.com…' },
      { slug: 'privacy', title: 'Privacy policy', body: 'We collect only what an order or a booking requires…' },
      { slug: 'refund-policy', title: 'Refund policy', body: 'Seven days from delivery with the seal intact…' },
      { slug: 'shipping-policy', title: 'Shipping policy', body: 'Dispatch within 24 hours from Varanasi…' },
    ],
  });

  await prisma.banner.createMany({
    data: [
      { placement: 'hero', headline: 'The bead you wear should be provable.', subheadline: 'Every Rudraksha ships with its own X-ray scan and a tamper seal you break yourself.', ctaLabel: 'Shop the collection', ctaHref: '/shop', displayOrder: 0 },
      { placement: 'festival', headline: '20% off all Rudrabhishek bookings', subheadline: 'Use code SHRAVAN20. Applies to online and hybrid bookings on Mondays.', ctaLabel: 'Claim the offer', ctaHref: '/puja', displayOrder: 0, endsAt: new Date(Date.now() + 6 * 86400000) },
    ],
  });

  await prisma.homeSection.createMany({
    data: [
      'hero', 'featured_categories', 'best_sellers', 'vault', 'puja_band',
      'latest_collection', 'festival_offer', 'testimonials', 'journal', 'instagram',
    ].map((key, i) => ({ key, label: key.replace(/_/g, ' '), displayOrder: i, visible: true })),
  });

  await prisma.setting.createMany({
    data: [
      { key: 'payments', value: { razorpay: true, stripe: true, upi: true, cod: { enabled: true, maxOrder: rs(10000) } } },
      { key: 'notifications', value: { email: true, sms: true, whatsapp: true, push: false, abandonedCart: true } },
      { key: 'shipping', value: { freeAbove: rs(2999), flatFee: rs(99), expressFee: rs(249) } },
    ],
  });

  await prisma.auditLog.create({
    data: { actorId: admin.id, actorRole: 'SUPER_ADMIN', action: 'system.seed', entity: 'System', entityId: 'seed', diff: { products: PRODUCTS.length } },
  });

  console.log(`
Seed complete.

  Admin        admin@divyaloka.com     / divyaloka123
  Support      support@divyaloka.com   / divyaloka123
  Coordinator  puja@divyaloka.com      / divyaloka123
  Pandit       pandit4@divyaloka.com   / divyaloka123   (Pt. Vinayak Sharma, Bareilly)
  Customer     aarav@example.com       / divyaloka123   (or OTP on 9876543210)
`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
