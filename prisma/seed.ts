import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client.js";
import { catalog } from "./catalog.js";
import { generateProductImages } from "./generate-images.js";

const connectionString = process.env.DATABASE_URL;
if (!connectionString || connectionString.includes("USER:PASSWORD")) {
  console.error(
    "\n✖ DATABASE_URL در فایل .env تنظیم نشده است.\n" +
      "  رشته اتصال Neon را در .env بگذارید و دوباره اجرا کنید.\n"
  );
  process.exit(1);
}

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString }) });

/** شماره‌ی موبایلی که به‌عنوان ادمین ساخته می‌شود */
const ADMIN_PHONE = process.env.SEED_ADMIN_PHONE ?? "09120000000";

async function main() {
  console.log("→ ساخت تصاویر نمونه…");
  const images = generateProductImages();

  console.log("→ پاک کردن داده‌های نمونه‌ی قبلی…");
  // سفارش‌ها و کاربران دست نمی‌خورند تا داده‌ی واقعی از بین نرود.
  await prisma.orderItem.deleteMany({});
  await prisma.order.deleteMany({});
  await prisma.productVariant.deleteMany({});
  await prisma.product.deleteMany({});
  await prisma.category.deleteMany({});

  console.log("→ ثبت دسته‌بندی‌ها و محصولات…");
  let sortOrder = 0;
  let productCount = 0;
  let variantCount = 0;

  for (const cat of catalog) {
    const category = await prisma.category.create({
      data: {
        name: cat.name,
        slug: cat.slug,
        icon: cat.icon,
        sortOrder: sortOrder++,
      },
    });

    for (const p of cat.products) {
      await prisma.product.create({
        data: {
          title: p.title,
          slug: p.slug,
          description: p.description,
          specs: p.specs,
          images: images.get(p.slug) ?? [],
          isFeatured: p.featured ?? false,
          soldCount: p.soldCount ?? 0,
          categoryId: category.id,
          variants: {
            create: p.variants.map((v) => ({
              label: `${v.platform} — ${v.region} — ${v.capacity}`,
              platform: v.platform,
              region: v.region,
              capacity: v.capacity,
              price: v.price,
              compareAtPrice: v.compareAtPrice ?? null,
              stock: v.stock ?? 25,
            })),
          },
        },
      });
      productCount++;
      variantCount += p.variants.length;
    }
  }

  console.log("→ ساخت کاربر ادمین…");
  const admin = await prisma.user.upsert({
    where: { phone: ADMIN_PHONE },
    update: { role: "ADMIN" },
    create: { phone: ADMIN_PHONE, name: "مدیر فروشگاه", role: "ADMIN" },
  });

  console.log(`
✔ داده‌های نمونه با موفقیت ثبت شد.
   دسته‌بندی: ${catalog.length}
   محصول    : ${productCount}
   وردایانت : ${variantCount}

   شماره ادمین: ${admin.phone}
   (با همین شماره وارد شوید تا به /admin دسترسی داشته باشید)
`);
}

main()
  .catch((e) => {
    console.error("✖ خطا در اجرای seed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
