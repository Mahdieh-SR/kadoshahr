/**
 * وارد کردن گروهی محصولات از یک فایل CSV.
 *
 * چرا: پر کردن فروشگاه با ده‌ها یا صدها محصول از پنل ادمین منطقی نیست.
 *
 * استفاده:
 *   npm run products:check                   فقط بررسی فایل، بدون هیچ تغییری در دیتابیس
 *   npm run products:import                  وارد کردن واقعی
 *   npm run products:import -- data/x.csv    با فایل دلخواه
 *   npm run products:import -- --prune       نسخه‌هایی که در فایل نیستند هم پاک/غیرفعال شوند
 *
 * قواعد:
 *   • هر سطر فایل = یک «نسخه» (variant). سطرهای با slug یکسان زیر یک محصول جمع می‌شوند.
 *   • برای محصولی که از قبل در دیتابیس هست، خانه‌ی خالی یعنی «دست نزن».
 *   • برای محصول جدید، ستون‌های اجباری باید پر باشند.
 *   • اگر حتی یک خطا در فایل باشد، هیچ چیزی نوشته نمی‌شود.
 *   • نسخه‌ای که در سفارشی استفاده شده هرگز حذف نمی‌شود، فقط غیرفعال می‌شود.
 *     (همان منطق saveProduct در src/app/actions/admin.ts)
 *
 * چرا pg خام و نه Prisma؟ مثل بقیه‌ی اسکریپت‌های پوشه‌ی scripts/ —
 * تا لازم نباشد بعد از هر prisma generate نگران کلاینت قدیمی باشیم.
 */
import "dotenv/config";
import { readFileSync, existsSync } from "node:fs";
import { Client } from "pg";

/* ────────────────────────── ورودی خط فرمان ────────────────────────── */

const argv = process.argv.slice(2);
const DRY_RUN = argv.includes("--dry-run");
const PRUNE = argv.includes("--prune");
const filePath = argv.find((a) => !a.startsWith("--")) ?? "data/products.csv";

/* ────────────────────────── کمک‌کارهای متن و عدد ────────────────────────── */

const DIGITS = {};
"۰۱۲۳۴۵۶۷۸۹".split("").forEach((d, i) => (DIGITS[d] = String(i)));
"٠١٢٣٤٥٦٧٨٩".split("").forEach((d, i) => (DIGITS[d] = String(i)));

/** ارقام فارسی/عربی را به انگلیسی تبدیل می‌کند */
const latinDigits = (s) => String(s).replace(/[۰-۹٠-٩]/g, (d) => DIGITS[d]);

/**
 * فاصله‌های اضافی را تمیز می‌کند.
 * نیم‌فاصله عمداً دست‌نخورده می‌ماند — بخشی از املای درست فارسی است
 * («گیفت‌کارت» نباید بشود «گیفت کارت»).
 */
const clean = (s) => String(s ?? "").replace(/\s+/g, " ").trim();

/**
 * کلید مقایسه — تا «Steam» و «steam»، «ي» و «ی»، و «گیفت‌کارت» و «گیفت کارت»
 * یکی حساب شوند. فقط برای تطبیق است، نه برای ذخیره.
 */
const key = (...parts) =>
  parts
    .map((p) =>
      latinDigits(String(p ?? "").replace(/‌/g, " "))
        .replace(/\s+/g, " ")
        .trim()
        .replace(/[يى]/g, "ی")
        .replace(/ك/g, "ک")
        .toLowerCase()
    )
    .join("¦");

/** نام ستون را برای تطبیق ساده می‌کند: بدون فاصله، خط تیره، زیرخط و نیم‌فاصله */
const headerKey = (h) =>
  String(h ?? "")
    .replace(/‌/g, "")
    .replace(/[\s_\-.]/g, "")
    .replace(/[يى]/g, "ی")
    .replace(/ك/g, "ک")
    .toLowerCase();

/** خانه‌ی خالی یا علامت «پاک کن» */
const CLEAR_MARKS = new Set(["-", "—", "–", "خالی", "هیچ", "none"]);
const isClear = (v) => CLEAR_MARKS.has(clean(v).toLowerCase());

function readNumber(raw) {
  const s = latinDigits(String(raw ?? "")).replace(/[,٬،\s]/g, "").replace(/^\+/, "");
  if (s === "") return { empty: true };
  if (!/^-?\d+$/.test(s)) return { bad: true };
  return { value: Number(s) };
}

/** قیمت دلاری با اعشار («۹.۹۹» یا «۹٫۹۹») → سِنت (۹۹۹) */
function readUsdCents(raw) {
  const s = latinDigits(String(raw ?? ""))
    .replace(/٫/g, ".")
    .replace(/[,٬،\s]/g, "");
  if (s === "") return { empty: true };
  if (!/^\d+(\.\d{1,2})?$/.test(s)) return { bad: true };
  return { value: Math.round(Number(s) * 100) };
}

const TRUE_WORDS = new Set(["1", "true", "yes", "y", "بله", "بلی", "اره", "آره", "فعال", "دارد", "درست"]);
const FALSE_WORDS = new Set(["0", "false", "no", "n", "خیر", "نه", "غیرفعال", "ندارد", "نادرست"]);

function readBool(raw) {
  const s = latinDigits(clean(raw)).toLowerCase();
  if (s === "") return { empty: true };
  if (TRUE_WORDS.has(s)) return { value: true };
  if (FALSE_WORDS.has(s)) return { value: false };
  return { bad: true };
}

/* ────────────────────────── خواندن CSV ────────────────────────── */

function detectDelimiter(text) {
  const firstLine = text.split(/\r?\n/, 1)[0] ?? "";
  const counts = [
    [",", (firstLine.match(/,/g) ?? []).length],
    [";", (firstLine.match(/;/g) ?? []).length],
    ["\t", (firstLine.match(/\t/g) ?? []).length],
  ];
  counts.sort((a, b) => b[1] - a[1]);
  return counts[0][1] > 0 ? counts[0][0] : ",";
}

/** خواننده‌ی CSV مطابق RFC 4180 — گیومه، ویرگول داخل متن و متن چندخطی را می‌فهمد */
function parseCsv(text) {
  if (text.charCodeAt(0) === 0xfeff) text = text.slice(1); // BOM اکسل
  const delimiter = detectDelimiter(text);

  const rows = [];
  let row = [];
  let field = "";
  let quoted = false;
  let started = false;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else quoted = false;
      } else field += ch;
      continue;
    }
    if (ch === '"' && field === "") {
      quoted = true;
      started = true;
    } else if (ch === delimiter) {
      row.push(field);
      field = "";
      started = true;
    } else if (ch === "\r") {
      // نادیده — پایان خط ویندوزی
    } else if (ch === "\n") {
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
      started = false;
    } else {
      field += ch;
      started = true;
    }
  }
  if (started || field !== "" || row.length) {
    row.push(field);
    rows.push(row);
  }
  return { rows, delimiter };
}

/* ────────────────────────── ستون‌ها ────────────────────────── */

const COLUMN_ALIASES = {
  slug: ["slug", "نشانی", "آدرس", "ادرس", "کد"],
  title: ["title", "name", "عنوان", "نام"],
  category: ["category", "categoryslug", "cat", "دسته", "دستهبندی", "گروه"],
  description: ["description", "desc", "توضیحات", "توضیح"],
  images: ["images", "image", "img", "تصویر", "تصاویر", "عکس"],
  specs: ["specs", "spec", "مشخصات", "ویژگیها"],
  isActive: ["isactive", "active", "productactive", "فعال", "نمایش"],
  isFeatured: ["isfeatured", "featured", "ویژه", "پرفروش", "منتخب"],
  platform: ["platform", "پلتفرم", "سرویس"],
  region: ["region", "ریجن", "منطقه", "کشور"],
  capacity: ["capacity", "حجم", "مقدار", "مبلغ"],
  price: ["price", "قیمت", "قیمتفروش"],
  compareAtPrice: ["compareatprice", "compareprice", "oldprice", "قیمتقبل", "قیمتقبلی", "قیمتقبلازتخفیف"],
  priceUsd: ["priceusd", "usd", "usdprice", "قیمتدلاری", "قیمتدلار", "دلار"],
  compareAtUsd: ["compareatusd", "compareusd", "oldusd", "قیمتقبلیدلار", "قیمتقبلدلار"],
  stock: ["stock", "qty", "quantity", "موجودی", "تعداد"],
  variantActive: ["variantactive", "نسخهفعال", "فعالنسخه", "موجود"],
};

const ALIAS_TO_FIELD = new Map();
for (const [field, aliases] of Object.entries(COLUMN_ALIASES)) {
  for (const a of aliases) ALIAS_TO_FIELD.set(headerKey(a), field);
}

const REQUIRED_COLUMNS = ["slug", "platform", "region", "capacity"];

/* ────────────────────────── گزارش خطا ────────────────────────── */

const errors = [];
const warnings = [];
const addError = (row, message) => errors.push({ row, message });
const addWarning = (row, message) => warnings.push({ row, message });

function die(message) {
  console.error(`\n✖ ${message}\n`);
  process.exit(1);
}

/* ────────────────────────── شروع ────────────────────────── */

if (!existsSync(filePath)) {
  die(
    `فایل «${filePath}» پیدا نشد.\n` +
      `  قالب خالی در data/products-template.csv است؛ آن را کپی کنید،\n` +
      `  در اکسل پر کنید و با نام data/products.csv ذخیره کنید.\n` +
      `  (هنگام ذخیره حتماً «CSV UTF-8» را انتخاب کنید تا فارسی خراب نشود.)`
  );
}

const connectionString = process.env.DATABASE_URL;
if (!connectionString || connectionString.includes("USER:PASSWORD")) {
  die("DATABASE_URL در فایل .env تنظیم نشده است.");
}

const raw = readFileSync(filePath, "utf8");
const { rows: csvRows, delimiter } = parseCsv(raw);

if (csvRows.length < 2) {
  die("فایل خالی است یا فقط سطر عنوان دارد.");
}

/* ── نگاشت ستون‌ها ── */
const headerCells = csvRows[0];
const columnOf = {};
headerCells.forEach((h, index) => {
  const name = headerKey(h);
  if (!name) return;
  const field = ALIAS_TO_FIELD.get(name);
  if (!field) {
    addWarning(1, `ستون ناشناخته‌ی «${clean(h)}» نادیده گرفته شد.`);
    return;
  }
  if (columnOf[field] !== undefined) {
    addWarning(1, `ستون «${clean(h)}» تکراری است؛ اولی استفاده می‌شود.`);
    return;
  }
  columnOf[field] = index;
});

const missingColumns = REQUIRED_COLUMNS.filter((c) => columnOf[c] === undefined);
if (missingColumns.length) {
  die(
    `این ستون‌ها در فایل نیستند: ${missingColumns.join("، ")}\n` +
      `  سطر اول فایل باید عنوان ستون‌ها باشد. نمونه در data/products-template.csv`
  );
}

const cell = (row, field) => {
  const i = columnOf[field];
  return i === undefined ? "" : clean(row[i] ?? "");
};
const rawCell = (row, field) => {
  const i = columnOf[field];
  return i === undefined ? "" : String(row[i] ?? "").trim();
};

/* ────────────────────────── خواندن دیتابیس ────────────────────────── */

const db = new Client({ connectionString });
await db.connect();

const { rows: categoryRows } = await db.query(
  `SELECT id, name, slug FROM "Category" ORDER BY "sortOrder"`
);
const categoryByKey = new Map();
for (const c of categoryRows) {
  categoryByKey.set(key(c.slug), c);
  categoryByKey.set(key(c.name), c);
}

// تنظیمات نرخ دلار — برای سطرهایی که قیمتشان دلاری است
const { rows: pricingRows } = await db.query(
  `SELECT "usdRate", "marginPercent", "roundTo" FROM "PricingSettings" WHERE id = 1`
);
const pricing = pricingRows[0] ?? { usdRate: 0, marginPercent: 0, roundTo: 1000 };

/** همان فرمول src/lib/exchange-rate.ts — رند همیشه به بالا */
function tomanFromUsd(cents) {
  const step = pricing.roundTo > 0 ? Math.floor(pricing.roundTo) : 1;
  const raw = (cents * pricing.usdRate * (100 + pricing.marginPercent)) / 10000;
  return Math.max(1000, Math.ceil(raw / step) * step);
}

const { rows: productRows } = await db.query(
  `SELECT id, slug, title, "categoryId" FROM "Product"`
);
const productBySlug = new Map(productRows.map((p) => [p.slug, p]));

const { rows: variantRows } = await db.query(`
  SELECT v.id, v."productId", v.platform, v.region, v.capacity, v."isActive", v."usdPriced",
         (SELECT count(*)::int FROM "OrderItem" oi WHERE oi."variantId" = v.id) AS used
    FROM "ProductVariant" v
`);
const variantsByProduct = new Map();
for (const v of variantRows) {
  if (!variantsByProduct.has(v.productId)) variantsByProduct.set(v.productId, new Map());
  variantsByProduct.get(v.productId).set(key(v.platform, v.region, v.capacity), v);
}

/* ────────────────────────── گروه‌بندی سطرها زیر محصول ────────────────────────── */

const groups = new Map();

for (let i = 1; i < csvRows.length; i++) {
  const row = csvRows[i];
  const rowNumber = i + 1; // شماره‌ای که کاربر در اکسل می‌بیند
  if (row.every((c) => clean(c) === "")) continue; // سطر خالی

  const slug = cell(row, "slug").toLowerCase();
  if (!slug) {
    addError(rowNumber, "ستون slug خالی است.");
    continue;
  }
  if (!groups.has(slug)) groups.set(slug, { slug, firstRow: rowNumber, rows: [] });
  groups.get(slug).rows.push({ n: rowNumber, row });
}

if (groups.size === 0 && errors.length === 0) {
  die("هیچ سطر داده‌ای در فایل نبود.");
}

/* ────────────────────────── اعتبارسنجی و ساخت نقشه‌ی کار ────────────────────────── */

/**
 * برای فیلدهای سطحِ محصول: اولین مقدار غیرخالی برنده است.
 * اگر سطر دیگری مقدار متفاوتی داشت، فقط هشدار می‌دهیم و اولی را نگه می‌داریم.
 */
function pickProductField(group, field, label) {
  let chosen = null;
  for (const { n, row } of group.rows) {
    const value = rawCell(row, field);
    if (value === "") continue;
    if (chosen === null) chosen = { value, row: n };
    else if (key(chosen.value) !== key(value)) {
      addWarning(n, `«${label}» با سطر ${chosen.row} فرق دارد؛ مقدار سطر ${chosen.row} استفاده شد.`);
    }
  }
  return chosen;
}

function parseImages(value) {
  return value
    .split(/[|\n]/)
    .map((s) => s.trim())
    .filter(Boolean);
}

function parseSpecs(value, rowNumber) {
  const out = [];
  for (const part of value.split(/[|\n]/)) {
    const piece = part.trim();
    if (!piece) continue;
    const at = piece.indexOf("=") >= 0 ? piece.indexOf("=") : piece.indexOf(":");
    if (at <= 0) {
      addError(rowNumber, `مشخصات باید به شکل «عنوان=مقدار» باشد، ولی «${piece}» این شکل را ندارد.`);
      continue;
    }
    out.push({ key: piece.slice(0, at).trim(), value: piece.slice(at + 1).trim() });
  }
  return out;
}

const plan = [];

for (const group of groups.values()) {
  const { slug } = group;
  const existing = productBySlug.get(slug) ?? null;
  const isNew = !existing;
  const firstRow = group.firstRow;

  if (!/^[a-z0-9-]+$/.test(slug)) {
    addError(firstRow, `نشانی «${slug}» معتبر نیست — فقط حروف کوچک انگلیسی، عدد و خط تیره.`);
    continue;
  }
  if (slug.length > 120) addError(firstRow, `نشانی «${slug}» بیش از ۱۲۰ کاراکتر است.`);

  /* ── فیلدهای محصول ── */
  const product = { slug, id: existing?.id ?? null, isNew, changes: {} };

  const titlePick = pickProductField(group, "title", "عنوان");
  if (titlePick) {
    const title = clean(titlePick.value);
    if (title.length < 2) addError(titlePick.row, "عنوان محصول باید حداقل ۲ کاراکتر باشد.");
    else if (title.length > 120) addError(titlePick.row, "عنوان محصول بیش از ۱۲۰ کاراکتر است.");
    else product.changes.title = title;
  } else if (isNew) {
    addError(firstRow, `محصول «${slug}» جدید است، پس ستون عنوان باید پر باشد.`);
  }

  const descPick = pickProductField(group, "description", "توضیحات");
  if (descPick) {
    const description = clean(descPick.value);
    if (description.length < 10) addError(descPick.row, "توضیحات باید حداقل ۱۰ کاراکتر باشد.");
    else if (description.length > 5000) addError(descPick.row, "توضیحات بیش از ۵۰۰۰ کاراکتر است.");
    else product.changes.description = description;
  } else if (isNew) {
    addError(firstRow, `محصول «${slug}» جدید است، پس ستون توضیحات باید پر باشد.`);
  }

  const catPick = pickProductField(group, "category", "دسته‌بندی");
  if (catPick) {
    const category = categoryByKey.get(key(catPick.value));
    if (!category) {
      addError(
        catPick.row,
        `دسته‌بندی «${clean(catPick.value)}» وجود ندارد. ` +
          `دسته‌های موجود: ${categoryRows.map((c) => `${c.slug} (${c.name})`).join("، ")}`
      );
    } else product.changes.categoryId = category.id;
  } else if (isNew) {
    addError(firstRow, `محصول «${slug}» جدید است، پس ستون دسته‌بندی باید پر باشد.`);
  }

  const imagesPick = pickProductField(group, "images", "تصاویر");
  if (imagesPick) {
    if (isClear(imagesPick.value)) product.changes.images = [];
    else {
      const images = parseImages(imagesPick.value);
      if (images.length > 8) addError(imagesPick.row, `حداکثر ۸ تصویر مجاز است (${images.length} تا داده شده).`);
      else if (images.some((u) => u.length > 500)) addError(imagesPick.row, "آدرس تصویر بیش از ۵۰۰ کاراکتر است.");
      else product.changes.images = images;
    }
  } else if (isNew) {
    product.changes.images = [];
  }

  const specsPick = pickProductField(group, "specs", "مشخصات");
  if (specsPick) {
    if (isClear(specsPick.value)) product.changes.specs = [];
    else {
      const specs = parseSpecs(specsPick.value, specsPick.row);
      if (specs.length > 20) addError(specsPick.row, `حداکثر ۲۰ ردیف مشخصات مجاز است (${specs.length} تا داده شده).`);
      else product.changes.specs = specs;
    }
  } else if (isNew) {
    product.changes.specs = [];
  }

  const activePick = pickProductField(group, "isActive", "فعال");
  if (activePick) {
    const parsed = readBool(activePick.value);
    if (parsed.bad) {
      addError(activePick.row, `مقدار «${clean(activePick.value)}» برای ستون فعال قابل فهم نیست — ۱ یا ۰ بنویسید.`);
    } else product.changes.isActive = parsed.value;
  } else if (isNew) {
    product.changes.isActive = true;
  }

  const featuredPick = pickProductField(group, "isFeatured", "ویژه");
  if (featuredPick) {
    const parsed = readBool(featuredPick.value);
    if (parsed.bad) {
      addError(featuredPick.row, `مقدار «${clean(featuredPick.value)}» برای ستون ویژه قابل فهم نیست — ۱ یا ۰ بنویسید.`);
    } else product.changes.isFeatured = parsed.value;
  } else if (isNew) {
    product.changes.isFeatured = false;
  }

  /* ── نسخه‌ها ── */
  const existingVariants = existing ? variantsByProduct.get(existing.id) ?? new Map() : new Map();
  const seen = new Map(); // کلید نسخه → شماره سطر، برای پیدا کردن تکراری‌ها
  const variants = [];

  for (const { n, row } of group.rows) {
    const platform = cell(row, "platform");
    const region = cell(row, "region");
    const capacity = cell(row, "capacity");

    if (!platform || !region || !capacity) {
      addError(n, "پلتفرم، ریجن و حجم هر سه باید پر باشند — هر سطر یک نسخه است.");
      continue;
    }
    for (const [value, label] of [[platform, "پلتفرم"], [region, "ریجن"], [capacity, "حجم"]]) {
      if (value.length > 40) addError(n, `${label} بیش از ۴۰ کاراکتر است.`);
    }

    const variantKey = key(platform, region, capacity);
    if (seen.has(variantKey)) {
      addError(n, `این نسخه در سطر ${seen.get(variantKey)} هم آمده است (پلتفرم/ریجن/حجم تکراری).`);
      continue;
    }
    seen.set(variantKey, n);

    const current = existingVariants.get(variantKey) ?? null;
    const variant = {
      row: n,
      id: current?.id ?? null,
      isNew: !current,
      label: `${platform} — ${region} — ${capacity}`,
      platform,
      region,
      capacity,
      changes: {},
    };

    /* ── قیمت: دلاری یا تومانی ── */
    const usd = readUsdCents(rawCell(row, "priceUsd"));
    const tomanPrice = readNumber(rawCell(row, "price"));

    if (usd.bad) addError(n, `قیمت دلاری «${cell(row, "priceUsd")}» عدد نیست.`);

    // ستون دلار پر است → این نسخه دلاری می‌شود و قیمت تومانی حساب می‌شود
    if (usd.value) {
      if (pricing.usdRate <= 0) {
        addError(
          n,
          "برای قیمت دلاری، اول باید نرخ دلار تنظیم شود — صفحه‌ی «نرخ دلار» در پنل ادمین."
        );
      } else if (usd.value > 10_000_000) {
        addError(n, "قیمت دلاری بیش از حد بزرگ است.");
      } else {
        if (!tomanPrice.empty && !tomanPrice.bad) {
          addWarning(n, "هم قیمت دلاری و هم تومانی نوشته شده؛ قیمت دلاری ملاک است.");
        }
        variant.changes.usdPriced = true;
        variant.changes.priceUsd = usd.value;
        variant.changes.price = tomanFromUsd(usd.value);
      }

      const compareUsd = rawCell(row, "compareAtUsd");
      if (isClear(compareUsd)) {
        variant.changes.compareAtUsd = null;
        variant.changes.compareAtPrice = null;
      } else {
        const parsed = readUsdCents(compareUsd);
        if (parsed.bad) addError(n, `قیمت قبلیِ دلاری «${clean(compareUsd)}» عدد نیست.`);
        else if (parsed.empty) {
          if (!current) {
            variant.changes.compareAtUsd = null;
            variant.changes.compareAtPrice = null;
          }
        } else if (parsed.value > 10_000_000) {
          addError(n, "قیمت قبلیِ دلاری بیش از حد بزرگ است.");
        } else if (pricing.usdRate > 0) {
          variant.changes.compareAtUsd = parsed.value > 0 ? parsed.value : null;
          variant.changes.compareAtPrice =
            parsed.value > 0 ? tomanFromUsd(parsed.value) : null;
          if (parsed.value > 0 && usd.value && parsed.value <= usd.value) {
            addWarning(n, "قیمت قبلی از قیمت فروش بیشتر نیست، پس تخفیفی نمایش داده نمی‌شود.");
          }
        }
      }
    } else {
      /* ── قیمت تومانی ثابت ── */
      if (tomanPrice.bad) addError(n, `قیمت «${cell(row, "price")}» عدد نیست.`);
      else if (tomanPrice.empty) {
        if (!current) addError(n, "این نسخه جدید است، پس قیمت باید پر باشد.");
      } else if (tomanPrice.value < 1000) addError(n, "قیمت باید حداقل ۱٬۰۰۰ تومان باشد.");
      else if (tomanPrice.value > 1_000_000_000) addError(n, "قیمت بیش از حد بزرگ است.");
      else {
        variant.changes.price = tomanPrice.value;
        // نوشتن قیمت تومانی روی نسخه‌ای که دلاری بود، عمداً از حالت دلاری خارجش می‌کند
        if (current?.usdPriced) {
          addWarning(n, "این نسخه دلاری بود؛ با نوشتن قیمت تومانی، دیگر با نرخ دلار به‌روز نمی‌شود.");
          variant.changes.usdPriced = false;
          variant.changes.priceUsd = null;
          variant.changes.compareAtUsd = null;
        }
      }

      const compare = rawCell(row, "compareAtPrice");
      if (isClear(compare)) variant.changes.compareAtPrice = null;
      else {
        const parsed = readNumber(compare);
        if (parsed.bad) addError(n, `قیمت قبل از تخفیف «${clean(compare)}» عدد نیست.`);
        else if (parsed.empty) {
          if (!current) variant.changes.compareAtPrice = null;
        } else if (parsed.value < 0 || parsed.value > 1_000_000_000) {
          addError(n, "قیمت قبل از تخفیف خارج از محدوده‌ی مجاز است.");
        } else {
          variant.changes.compareAtPrice = parsed.value > 0 ? parsed.value : null;
          const finalPrice = variant.changes.price ?? null;
          if (parsed.value > 0 && finalPrice !== null && parsed.value <= finalPrice) {
            addWarning(n, "قیمت قبل از تخفیف از قیمت فروش بیشتر نیست، پس تخفیفی نمایش داده نمی‌شود.");
          }
        }
      }
    }

    const stock = readNumber(rawCell(row, "stock"));
    if (stock.bad) addError(n, `موجودی «${cell(row, "stock")}» عدد نیست.`);
    else if (stock.empty) {
      if (!current) variant.changes.stock = 0;
    } else if (stock.value < 0 || stock.value > 100000) addError(n, "موجودی باید بین ۰ تا ۱۰۰۰۰۰ باشد.");
    else variant.changes.stock = stock.value;

    const vActive = readBool(rawCell(row, "variantActive"));
    if (vActive.bad) addError(n, "مقدار ستون «نسخه فعال» قابل فهم نیست — ۱ یا ۰ بنویسید.");
    else if (vActive.empty) {
      if (!current) variant.changes.isActive = true;
    } else variant.changes.isActive = vActive.value;

    variants.push(variant);
  }

  if (variants.length === 0) {
    addError(firstRow, `محصول «${slug}» هیچ نسخه‌ی سالمی ندارد.`);
  } else if (variants.length > 40) {
    addError(firstRow, `محصول «${slug}» ${variants.length} نسخه دارد؛ حداکثر ۴۰ نسخه مجاز است.`);
  }

  /* ── نسخه‌هایی که در فایل نیامده‌اند ── */
  const leftovers = [];
  for (const [k, v] of existingVariants) {
    if (seen.has(k)) continue;
    leftovers.push({ ...v, action: v.used > 0 ? "deactivate" : "delete" });
  }

  plan.push({ product, variants, leftovers });
}

/* ────────────────────────── گزارش خطاها ────────────────────────── */

const byRow = (a, b) => a.row - b.row;

if (warnings.length) {
  console.log(`\n⚠ ${warnings.length} هشدار:`);
  for (const w of [...warnings].sort(byRow)) console.log(`   سطر ${w.row}: ${w.message}`);
}

if (errors.length) {
  console.log(`\n✖ ${errors.length} خطا در فایل «${filePath}» پیدا شد. هیچ چیزی نوشته نشد.\n`);
  for (const e of [...errors].sort(byRow)) console.log(`   سطر ${e.row}: ${e.message}`);
  console.log("\n  خطاها را در اکسل درست کنید و دوباره اجرا کنید.\n");
  await db.end();
  process.exit(1);
}

/* ────────────────────────── خلاصه‌ی کار ────────────────────────── */

const summary = {
  newProducts: plan.filter((p) => p.product.isNew).length,
  updatedProducts: plan.filter((p) => !p.product.isNew).length,
  newVariants: 0,
  updatedVariants: 0,
  deletedVariants: 0,
  deactivatedVariants: 0,
};

console.log(
  `\n${DRY_RUN ? "بررسی فایل" : "وارد کردن"} «${filePath}» — ` +
    `${plan.length} محصول، ${plan.reduce((n, p) => n + p.variants.length, 0)} نسخه` +
    (delimiter !== "," ? `  (جداکننده: «${delimiter === "\t" ? "تب" : delimiter}»)` : "")
);
console.log("");

for (const item of plan) {
  const { product, variants, leftovers } = item;
  const fresh = variants.filter((v) => v.isNew).length;
  const touched = variants.length - fresh;
  summary.newVariants += fresh;
  summary.updatedVariants += touched;

  const parts = [];
  if (fresh) parts.push(`${fresh} نسخه‌ی جدید`);
  if (touched) parts.push(`${touched} نسخه‌ی به‌روزرسانی`);
  if (PRUNE) {
    const del = leftovers.filter((l) => l.action === "delete").length;
    const off = leftovers.filter((l) => l.action === "deactivate").length;
    if (del) parts.push(`${del} نسخه حذف`);
    if (off) parts.push(`${off} نسخه غیرفعال (در سفارش استفاده شده)`);
    summary.deletedVariants += del;
    summary.deactivatedVariants += off;
  } else if (leftovers.length) {
    parts.push(`${leftovers.length} نسخه‌ی قدیمی دست‌نخورده`);
  }

  console.log(
    `  ${product.isNew ? "＋" : "↻"} ${product.slug}` +
      `${product.changes.title ? ` — ${product.changes.title}` : ""}` +
      `  (${parts.join("، ")})`
  );
}

if (DRY_RUN) {
  console.log(
    `\n✔ فایل سالم است. هیچ تغییری در دیتابیس داده نشد.\n` +
      `  برای وارد کردن واقعی:  npm run products:import` +
      `${filePath === "data/products.csv" ? "" : ` -- ${filePath}`}\n`
  );
  await db.end();
  process.exit(0);
}

/* ────────────────────────── نوشتن در دیتابیس ────────────────────────── */

console.log("\n→ در حال نوشتن…");

/**
 * هر محصول در یک تراکنش کوتاه و جدا نوشته می‌شود.
 * دلیل: Neon در فرانکفورت است و تراکنش طولانی مهلتش تمام می‌شود
 * (دام شماره ۳ در HANDOFF.md).
 */
for (const { product, variants, leftovers } of plan) {
  await db.query("BEGIN");
  try {
    let productId = product.id;

    if (product.isNew) {
      const { rows } = await db.query(
        `INSERT INTO "Product"
           (id, title, slug, description, specs, images, "isActive", "isFeatured", "categoryId", "createdAt", "updatedAt")
         VALUES (gen_random_uuid()::text, $1, $2, $3, $4::jsonb, $5::text[], $6, $7, $8, now(), now())
         RETURNING id`,
        [
          product.changes.title,
          product.slug,
          product.changes.description,
          JSON.stringify(product.changes.specs ?? []),
          product.changes.images ?? [],
          product.changes.isActive ?? true,
          product.changes.isFeatured ?? false,
          product.changes.categoryId,
        ]
      );
      productId = rows[0].id;
    } else {
      const sets = [];
      const values = [];
      const set = (column, value, cast = "") => {
        values.push(value);
        sets.push(`"${column}" = $${values.length}${cast}`);
      };
      const c = product.changes;
      if (c.title !== undefined) set("title", c.title);
      if (c.description !== undefined) set("description", c.description);
      if (c.categoryId !== undefined) set("categoryId", c.categoryId);
      if (c.images !== undefined) set("images", c.images, "::text[]");
      if (c.specs !== undefined) set("specs", JSON.stringify(c.specs), "::jsonb");
      if (c.isActive !== undefined) set("isActive", c.isActive);
      if (c.isFeatured !== undefined) set("isFeatured", c.isFeatured);

      if (sets.length) {
        values.push(productId);
        await db.query(
          `UPDATE "Product" SET ${sets.join(", ")}, "updatedAt" = now() WHERE id = $${values.length}`,
          values
        );
      }
    }

    for (const v of variants) {
      if (v.isNew) {
        await db.query(
          `INSERT INTO "ProductVariant"
             (id, label, platform, region, capacity, price, "compareAtPrice",
              "priceUsd", "compareAtUsd", "usdPriced", stock, "isActive", "productId")
           VALUES (gen_random_uuid()::text, $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`,
          [
            v.label,
            v.platform,
            v.region,
            v.capacity,
            v.changes.price,
            v.changes.compareAtPrice ?? null,
            v.changes.priceUsd ?? null,
            v.changes.compareAtUsd ?? null,
            v.changes.usdPriced ?? false,
            v.changes.stock ?? 0,
            v.changes.isActive ?? true,
            productId,
          ]
        );
      } else {
        const sets = ['"label" = $1', '"platform" = $2', '"region" = $3', '"capacity" = $4'];
        const values = [v.label, v.platform, v.region, v.capacity];
        const push = (column, value) => {
          values.push(value);
          sets.push(`"${column}" = $${values.length}`);
        };
        if (v.changes.price !== undefined) push("price", v.changes.price);
        if (v.changes.compareAtPrice !== undefined) push("compareAtPrice", v.changes.compareAtPrice);
        if (v.changes.priceUsd !== undefined) push("priceUsd", v.changes.priceUsd);
        if (v.changes.compareAtUsd !== undefined) push("compareAtUsd", v.changes.compareAtUsd);
        if (v.changes.usdPriced !== undefined) push("usdPriced", v.changes.usdPriced);
        if (v.changes.stock !== undefined) push("stock", v.changes.stock);
        if (v.changes.isActive !== undefined) push("isActive", v.changes.isActive);

        values.push(v.id);
        await db.query(
          `UPDATE "ProductVariant" SET ${sets.join(", ")} WHERE id = $${values.length}`,
          values
        );
      }
    }

    if (PRUNE) {
      for (const l of leftovers) {
        if (l.action === "delete") {
          await db.query(`DELETE FROM "ProductVariant" WHERE id = $1`, [l.id]);
        } else {
          // نسخه‌ای که در سفارشی استفاده شده حذف نمی‌شود — سابقه‌ی سفارش را خراب می‌کند
          await db.query(`UPDATE "ProductVariant" SET "isActive" = false WHERE id = $1`, [l.id]);
        }
      }
    }

    await db.query("COMMIT");
    console.log(`   ✔ ${product.slug}`);
  } catch (e) {
    await db.query("ROLLBACK").catch(() => {});
    console.error(`   ✘ ${product.slug} — ${e.message}`);
    console.error(
      `\n✖ کار نیمه‌کاره متوقف شد. محصولات قبلی ثبت شده‌اند و این محصول دست‌نخورده ماند.\n` +
        `  مشکل را برطرف کنید و همین فایل را دوباره اجرا کنید — محصولات ثبت‌شده دوباره ساخته نمی‌شوند.\n`
    );
    await db.end();
    process.exit(1);
  }
}

console.log(
  `\n✔ تمام شد.\n` +
    `   محصول جدید: ${summary.newProducts}   ·   محصول به‌روزرسانی‌شده: ${summary.updatedProducts}\n` +
    `   نسخه‌ی جدید: ${summary.newVariants}   ·   نسخه‌ی به‌روزرسانی‌شده: ${summary.updatedVariants}` +
    (summary.deletedVariants || summary.deactivatedVariants
      ? `\n   نسخه‌ی حذف‌شده: ${summary.deletedVariants}   ·   نسخه‌ی غیرفعال‌شده: ${summary.deactivatedVariants}`
      : "") +
    `\n\n   حالا سایت را باز کنید:  http://localhost:3000/products\n`
);

await db.end();
