/**
 * ساخت تصاویر کارت محصول.
 *
 * جدا از seed-catalog نگه داشته شده تا بشود بدون اتصال به دیتابیس اجرا و
 * پیش‌نمایشش را دید — وگرنه برای بررسی یک تغییر ظاهری هم باید به دیتابیس
 * وصل می‌شدیم.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const outDir = join(process.cwd(), "public", "products");
/**
 * ⚠️ پس‌زمینه عمداً سفید است، نه تیره.
 *
 * قبلاً یک بنفش تیره بود — تقریباً همان رنگ خودِ سایت. نتیجه این شد که تصویر
 * محصول داخل کارت تیره‌ی فروشگاه محو می‌شد و عملاً دیده نمی‌شد.
 * سفید هم روی سایت تیره «می‌درخشد» و هم چیزی است که بازارگاه‌هایی مثل ترب و
 * گوگل شاپینگ ترجیح می‌دهند.
 */
const BG = "#ffffff";
const INK = "#0b0917";
/** لکه‌ها و نقطه‌های تزئینی روی پس‌زمینه‌ی روشن — تیره، نه سفید */
const SOFT = "#0b0917";

const escapeXml = (s) =>
  String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

const frame = (inner) =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 600" width="800" height="600" role="img">
  <rect width="800" height="600" fill="${BG}"/>
  ${inner}
</svg>
`;

const label = (text, x, y, size = 46, fill = "#ffffff", anchor = "middle") =>
  `<text x="${x}" y="${y}" font-family="Segoe UI, Arial, sans-serif" font-size="${size}" font-weight="700" fill="${fill}" text-anchor="${anchor}">${escapeXml(text)}</text>`;

/* ─────────────────── لوگوی برندها ─────────────────── */

const brandsDir = join(process.cwd(), "public", "brands");
const logoCache = new Map();

/**
 * لوگوی برند را به صورت data URI برمی‌گرداند، یا null اگر فایلش نباشد.
 *
 * ⚠️ چرا data URI داخل `<image>` و نه چسباندن مستقیم مسیرها؟
 * لوگوهای رسمی معمولاً `<style>` با نام کلاس‌های عمومی مثل `.st0` دارند.
 * اگر مستقیم داخل کارت inline شوند، کلاس‌های دو لوگوی مختلف با هم تداخل
 * می‌کنند و رنگ‌ها به هم می‌ریزند. `<image>` هر لوگو را در فضای مستقل خودش
 * رندر می‌کند و این مشکل کاملاً از بین می‌رود.
 */
function brandLogo(name) {
  if (!name) return null;
  if (logoCache.has(name)) return logoCache.get(name);

  const path = join(brandsDir, `${name}.svg`);
  let logo = null;

  if (existsSync(path)) {
    const svg = readFileSync(path, "utf8");
    /**
     * آیکون‌های Simple Icons عمداً هیچ `fill` ای ندارند تا مصرف‌کننده رنگش
     * را تعیین کند — یعنی اگر دست نزنیم **سیاه** رندر می‌شوند. لوگوهای رسمی
     * برندها برعکس، رنگ خودشان را داخل فایل دارند.
     * این تفاوت، شکل نمایششان روی کارت را هم تعیین می‌کند.
     */
    const monochrome = !/fill\s*[=:]/.test(svg);
    logo = { svg, monochrome };
  }

  logoCache.set(name, logo);
  return logo;
}

const toDataUri = (svg) =>
  `data:image/svg+xml;base64,${Buffer.from(svg, "utf8").toString("base64")}`;

/**
 * نشان برند روی کارت: لوگوی واقعی اگر باشد، وگرنه همان متن قبلی.
 *
 * لوگو روی یک صفحه‌ی سفید می‌نشیند، چون بعضی لوگوها (مثل آمازون) متن تیره
 * دارند و روی کارت تیره‌ی ما اصلاً دیده نمی‌شوند. صفحه‌ی روشن تضمین می‌کند
 * هر برندی، با هر رنگی، خوانا بماند.
 */
function brandMark(
  product,
  cx,
  cy,
  boxW,
  boxH,
  textSize,
  showName = true,
  // رنگ نام محصول. دو طرح اول نشان را روی کارت تیره می‌گذارند (متن سفید)،
  // طرح سوم روی پس‌زمینه‌ی سفید (متن تیره). بدون این پارامتر، متن در یکی از
  // دو حالت نامرئی می‌شد.
  textColor = "#ffffff"
) {
  const logo = brandLogo(product.logo);
  if (!logo) return label(product.art, cx, cy, textSize, textColor);

  /* آیکون تک‌رنگ: با رنگ برند رنگ می‌شود و مستقیم روی کارت تیره می‌نشیند. */
  if (logo.monochrome) {
    // رنگ روی خود تگ svg گذاشته می‌شود؛ path که fill ندارد آن را به ارث می‌برد
    const uri = toDataUri(logo.svg.replace("<svg ", `<svg fill="${product.tint}" `));
    const size = 76;
    const icon = `<image href="${uri}" x="${cx - size / 2}" y="${cy - size - 16}" width="${size}" height="${size}"/>`;
    return showName
      ? `${icon}\n  ${label(product.art, cx, cy + 40, textSize, textColor)}`
      : icon;
  }

  /**
   * لوگوی تمام‌رنگ روی صفحه‌ی روشن می‌نشیند.
   * چون رنگ خودش را دارد و بعضی‌شان (مثل آمازون) متن تقریباً سیاه دارند،
   * روی کارت تیره‌ی ما نامرئی می‌شدند. صفحه‌ی روشن این را تضمین می‌کند.
   * اینجا نام محصول نوشته نمی‌شود، چون خود لوگو نوشتاری است.
   */
  const x = cx - boxW / 2;
  const y = cy - boxH / 2;
  const pad = 22;
  const uri = toDataUri(logo.svg);

  return `<rect x="${x}" y="${y}" width="${boxW}" height="${boxH}" rx="18" fill="#ffffff"/>
  <image href="${uri}" x="${x + pad}" y="${y + pad}" width="${boxW - pad * 2}" height="${boxH - pad * 2}" preserveAspectRatio="xMidYMid meet"/>`;
}

const artFront = (p, tint) =>
  frame(`
  <circle cx="660" cy="90" r="190" fill="${tint}" opacity="0.16"/>
  <circle cx="120" cy="540" r="150" fill="${tint}" opacity="0.12"/>
  <rect x="160" y="150" width="480" height="300" rx="26" fill="${INK}" stroke="${tint}" stroke-width="2" opacity="0.98"/>
  <rect x="160" y="150" width="480" height="10" rx="5" fill="${tint}"/>
  <rect x="196" y="356" width="150" height="14" rx="7" fill="${tint}" opacity="0.55"/>
  <rect x="196" y="386" width="96" height="14" rx="7" fill="#ffffff" opacity="0.16"/>
  <circle cx="576" cy="378" r="30" fill="${tint}" opacity="0.85"/>
  ${brandMark(p, 400, 275, 340, 116, 44)}
`);

const artAngle = (p, tint) => {
  const dots = [];
  for (let x = 60; x <= 760; x += 50) {
    for (let y = 60; y <= 560; y += 50) {
      dots.push(`<circle cx="${x}" cy="${y}" r="2.5" fill="${SOFT}" opacity="0.07"/>`);
    }
  }
  return frame(`
  ${dots.join("")}
  <g transform="rotate(-8 400 300)">
    <rect x="170" y="175" width="460" height="250" rx="24" fill="${tint}"/>
    <rect x="186" y="191" width="428" height="218" rx="16" fill="${INK}"/>
    <rect x="216" y="336" width="120" height="12" rx="6" fill="${tint}" opacity="0.7"/>
    ${brandMark(p, 400, 278, 300, 104, 42)}
  </g>
`);
};

/**
 * طرح سوم — نشان برند بالا، نوارها پایین.
 *
 * قبلاً نوارها وسط بودند و لوگو دقیقاً رویشان می‌افتاد؛ و یک نوار تیره هم
 * ته تصویر بود که چون رنگش با پس‌زمینه‌ی سایت یکی است، به‌جای کادر بسته،
 * ناتمام به نظر می‌رسید. حالا هیچ‌کدام روی هم نمی‌افتند و کل تصویر یک
 * مستطیل سفید تمام است.
 */
const artStripes = (p, tint) =>
  frame(`
  ${brandMark(p, 400, 250, 340, 120, 44, true, INK)}
  <g opacity="0.95">
    <rect x="250" y="400" width="44" height="90" rx="22" fill="${tint}" opacity="0.35"/>
    <rect x="312" y="370" width="44" height="120" rx="22" fill="${tint}" opacity="0.55"/>
    <rect x="374" y="340" width="44" height="150" rx="22" fill="${tint}" opacity="0.9"/>
    <rect x="436" y="370" width="44" height="120" rx="22" fill="${tint}" opacity="0.55"/>
    <rect x="498" y="400" width="44" height="90" rx="22" fill="${tint}" opacity="0.35"/>
  </g>
`);

export function writeImages(product, { dryRun = false } = {}) {
  mkdirSync(outDir, { recursive: true });
  const files = [
    [`${product.slug}-1.svg`, artFront(product, product.tint)],
    [`${product.slug}-2.svg`, artAngle(product, product.tint)],
    [`${product.slug}-3.svg`, artStripes(product, product.tint)],
  ];
  if (!dryRun) {
    for (const [name, svg] of files) writeFileSync(join(outDir, name), svg, "utf8");
  }
  return files.map(([name]) => `/products/${name}`);
}
