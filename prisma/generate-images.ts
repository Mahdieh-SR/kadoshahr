/**
 * تولید تصاویر نمونه‌ی محصولات به صورت SVG.
 *
 * چرا SVG محلی و نه عکس از اینترنت؟ چون بدون نیاز به اینترنت کار می‌کند،
 * حجم بسیار کمی دارد و با تم فلت سایت هماهنگ است.
 * بعداً کافی است در پنل ادمین به‌جای این‌ها آدرس تصویر واقعی گذاشته شود.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { catalog } from "./catalog.js";

const projectRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
const outDir = join(projectRoot, "public", "products");

const BG = "#14122a";
const INK = "#0b0917";

function escapeXml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function frame(inner: string): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 600" width="800" height="600" role="img">
  <rect width="800" height="600" fill="${BG}"/>
  ${inner}
</svg>
`;
}

function label(text: string, x: number, y: number, size = 46, fill = "#ffffff", anchor = "middle") {
  return `<text x="${x}" y="${y}" font-family="Segoe UI, Arial, sans-serif" font-size="${size}" font-weight="700" fill="${fill}" text-anchor="${anchor}">${escapeXml(text)}</text>`;
}

/** نمای اول: کارت روبه‌رو با نوار تاکیدی */
function artFront(name: string, tint: string): string {
  return frame(`
  <circle cx="660" cy="90" r="190" fill="${tint}" opacity="0.10"/>
  <circle cx="120" cy="540" r="150" fill="${tint}" opacity="0.07"/>
  <rect x="160" y="150" width="480" height="300" rx="26" fill="${INK}" stroke="${tint}" stroke-width="2" opacity="0.98"/>
  <rect x="160" y="150" width="480" height="10" rx="5" fill="${tint}"/>
  <rect x="196" y="356" width="150" height="14" rx="7" fill="${tint}" opacity="0.55"/>
  <rect x="196" y="386" width="96" height="14" rx="7" fill="#ffffff" opacity="0.16"/>
  <circle cx="576" cy="378" r="30" fill="${tint}" opacity="0.85"/>
  ${label(name, 400, 290, 44)}
`);
}

/** نمای دوم: کارت زاویه‌دار روی شبکه‌ی نقطه‌چین */
function artAngle(name: string, tint: string): string {
  const dots: string[] = [];
  for (let x = 60; x <= 760; x += 50) {
    for (let y = 60; y <= 560; y += 50) {
      dots.push(`<circle cx="${x}" cy="${y}" r="2.5" fill="#ffffff" opacity="0.07"/>`);
    }
  }
  return frame(`
  ${dots.join("")}
  <g transform="rotate(-8 400 300)">
    <rect x="170" y="175" width="460" height="250" rx="24" fill="${tint}"/>
    <rect x="186" y="191" width="428" height="218" rx="16" fill="${INK}"/>
    <rect x="216" y="336" width="120" height="12" rx="6" fill="${tint}" opacity="0.7"/>
    ${label(name, 400, 292, 42)}
  </g>
`);
}

/** نمای سوم: ترکیب انتزاعی نواری */
function artStripes(name: string, tint: string): string {
  return frame(`
  <g opacity="0.85">
    <rect x="70" y="120" width="70" height="360" rx="35" fill="${tint}" opacity="0.25"/>
    <rect x="170" y="170" width="70" height="260" rx="35" fill="${tint}" opacity="0.45"/>
    <rect x="270" y="210" width="70" height="180" rx="35" fill="${tint}" opacity="0.7"/>
    <rect x="370" y="170" width="70" height="260" rx="35" fill="${tint}" opacity="0.45"/>
    <rect x="470" y="120" width="70" height="360" rx="35" fill="${tint}" opacity="0.25"/>
  </g>
  <rect x="600" y="120" width="130" height="360" rx="28" fill="${INK}" stroke="${tint}" stroke-width="2"/>
  <circle cx="665" cy="300" r="34" fill="${tint}"/>
  <rect x="0" y="500" width="800" height="100" fill="${INK}"/>
  ${label(name, 40, 562, 40, "#ffffff", "start")}
`);
}

export function generateProductImages(): Map<string, string[]> {
  mkdirSync(outDir, { recursive: true });
  const result = new Map<string, string[]>();

  for (const category of catalog) {
    for (const product of category.products) {
      const files = [
        [`${product.slug}-1.svg`, artFront(product.art, product.tint)],
        [`${product.slug}-2.svg`, artAngle(product.art, product.tint)],
        [`${product.slug}-3.svg`, artStripes(product.art, product.tint)],
      ] as const;

      for (const [name, svg] of files) {
        writeFileSync(join(outDir, name), svg, "utf8");
      }
      result.set(
        product.slug,
        files.map(([name]) => `/products/${name}`)
      );
    }
  }

  return result;
}

// اجرای مستقیم: tsx prisma/generate-images.ts
if (process.argv[1] && process.argv[1].endsWith("generate-images.ts")) {
  const map = generateProductImages();
  console.log(`${map.size * 3} تصویر نمونه در public/products ساخته شد.`);
}
