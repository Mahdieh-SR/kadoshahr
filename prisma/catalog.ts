/**
 * منبع واحد داده‌های نمونه.
 * هم اسکریپت seed از آن می‌خواند، هم تولیدکننده‌ی تصاویر نمونه.
 */

export type SeedVariant = {
  platform: string;
  region: string;
  capacity: string;
  price: number;
  compareAtPrice?: number;
  stock?: number;
};

export type SeedProduct = {
  slug: string;
  title: string;
  /** نام کوتاه لاتین که روی تصویر نمونه چاپ می‌شود */
  art: string;
  /** رنگ اصلی تصویر نمونه */
  tint: string;
  description: string;
  specs: { key: string; value: string }[];
  featured?: boolean;
  soldCount?: number;
  variants: SeedVariant[];
};

export type SeedCategory = {
  slug: string;
  name: string;
  icon: string;
  products: SeedProduct[];
};

/** ساخت سریع چند وردایانت با ترکیب ریجن و مقدار */
function combos(
  platform: string,
  regions: { region: string; factor: number }[],
  caps: { capacity: string; price: number; compareAtPrice?: number }[]
): SeedVariant[] {
  const out: SeedVariant[] = [];
  for (const r of regions) {
    for (const c of caps) {
      out.push({
        platform,
        region: r.region,
        capacity: c.capacity,
        price: Math.round((c.price * r.factor) / 1000) * 1000,
        compareAtPrice: c.compareAtPrice
          ? Math.round((c.compareAtPrice * r.factor) / 1000) * 1000
          : undefined,
        stock: 25,
      });
    }
  }
  return out;
}

export const catalog: SeedCategory[] = [
  {
    slug: "gaming",
    name: "گیفت‌کارت گیمینگ",
    icon: "gamepad",
    products: [
      {
        slug: "playstation-gift-card",
        title: "گیفت‌کارت پلی‌استیشن نتورک",
        art: "PlayStation",
        tint: "#4f7cff",
        featured: true,
        soldCount: 1240,
        description:
          "گیفت‌کارت پلی‌استیشن نتورک برای شارژ کیف پول اکانت PSN و خرید بازی، DLC و اشتراک PS Plus. کد بلافاصله بعد از تایید پرداخت برای شما ارسال می‌شود و تا زمان استفاده اعتبار دارد.",
        specs: [
          { key: "نوع کد", value: "کد دیجیتال یک‌بار مصرف" },
          { key: "زمان تحویل", value: "بین ۵ تا ۳۰ دقیقه" },
          { key: "قابلیت استرداد", value: "بعد از ارسال کد، ندارد" },
          { key: "اعتبار کد", value: "بدون تاریخ انقضا" },
        ],
        variants: combos(
          "PlayStation Network",
          [
            { region: "آمریکا", factor: 1 },
            { region: "انگلستان", factor: 1.06 },
            { region: "ترکیه", factor: 0.88 },
          ],
          [
            { capacity: "۱۰ دلاری", price: 780_000, compareAtPrice: 850_000 },
            { capacity: "۲۵ دلاری", price: 1_900_000 },
            { capacity: "۵۰ دلاری", price: 3_750_000 },
            { capacity: "۱۰۰ دلاری", price: 7_400_000 },
          ]
        ),
      },
      {
        slug: "xbox-game-pass",
        title: "اشتراک ایکس‌باکس گیم‌پس",
        art: "Game Pass",
        tint: "#3ddc84",
        featured: true,
        soldCount: 860,
        description:
          "اشتراک گیم‌پس با دسترسی به صدها بازی روی کنسول و کامپیوتر. نسخه‌ی Ultimate علاوه بر کتابخانه‌ی کامل، بازی ابری و Xbox Live Gold را هم شامل می‌شود.",
        specs: [
          { key: "نوع کد", value: "کد فعال‌سازی اشتراک" },
          { key: "زمان تحویل", value: "بین ۵ تا ۳۰ دقیقه" },
          { key: "نیاز به اکانت", value: "اکانت مایکروسافت با ریجن مطابق کد" },
          { key: "تمدید خودکار", value: "ندارد" },
        ],
        variants: [
          ...combos(
            "Ultimate",
            [
              { region: "آمریکا", factor: 1 },
              { region: "ترکیه", factor: 0.72 },
            ],
            [
              { capacity: "۱ ماهه", price: 1_450_000 },
              { capacity: "۳ ماهه", price: 3_900_000, compareAtPrice: 4_350_000 },
              { capacity: "۱۲ ماهه", price: 14_200_000 },
            ]
          ),
          ...combos(
            "PC Game Pass",
            [
              { region: "آمریکا", factor: 1 },
              { region: "ترکیه", factor: 0.72 },
            ],
            [
              { capacity: "۱ ماهه", price: 1_150_000 },
              { capacity: "۳ ماهه", price: 3_100_000 },
            ]
          ),
          ...combos(
            "Console",
            [{ region: "آمریکا", factor: 1 }],
            [
              { capacity: "۱ ماهه", price: 1_050_000 },
              { capacity: "۳ ماهه", price: 2_850_000 },
            ]
          ),
        ],
      },
      {
        slug: "steam-wallet",
        title: "گیفت‌کارت استیم",
        art: "Steam",
        tint: "#7b8ff7",
        soldCount: 2100,
        description:
          "شارژ کیف پول استیم برای خرید بازی، آیتم درون‌بازی و بسته‌های الحاقی. توجه کنید که ریجن کد باید با ریجن اکانت استیم شما یکی باشد.",
        specs: [
          { key: "نوع کد", value: "کد شارژ کیف پول" },
          { key: "زمان تحویل", value: "بین ۵ تا ۳۰ دقیقه" },
          { key: "محدودیت ریجن", value: "دارد — ریجن اکانت باید مطابق باشد" },
          { key: "اعتبار کد", value: "بدون تاریخ انقضا" },
        ],
        variants: combos(
          "Steam",
          [
            { region: "آمریکا", factor: 1 },
            { region: "اروپا", factor: 1.09 },
            { region: "ترکیه", factor: 0.79 },
          ],
          [
            { capacity: "۱۰ دلاری", price: 800_000 },
            { capacity: "۲۰ دلاری", price: 1_560_000 },
            { capacity: "۵۰ دلاری", price: 3_820_000, compareAtPrice: 4_100_000 },
            { capacity: "۱۰۰ دلاری", price: 7_500_000 },
          ]
        ),
      },
    ],
  },

  {
    slug: "subscriptions",
    name: "اشتراک سرویس‌ها",
    icon: "play",
    products: [
      {
        slug: "spotify-premium",
        title: "اشتراک اسپاتیفای پریمیوم",
        art: "Spotify",
        tint: "#1ed760",
        featured: true,
        soldCount: 1530,
        description:
          "اشتراک پریمیوم اسپاتیفای بدون تبلیغ، با امکان دانلود آفلاین و کیفیت بالا. فعال‌سازی روی اکانت خودتان انجام می‌شود و نیازی به تغییر رمز ندارید.",
        specs: [
          { key: "نوع سرویس", value: "فعال‌سازی روی اکانت شما" },
          { key: "زمان تحویل", value: "بین ۱ تا ۶ ساعت" },
          { key: "نیاز به رمز عبور", value: "ندارد" },
          { key: "پشتیبانی", value: "تا پایان دوره‌ی اشتراک" },
        ],
        variants: combos(
          "Individual",
          [
            { region: "آمریکا", factor: 1 },
            { region: "ترکیه", factor: 0.62 },
          ],
          [
            { capacity: "۱ ماهه", price: 690_000 },
            { capacity: "۳ ماهه", price: 1_850_000, compareAtPrice: 2_070_000 },
            { capacity: "۶ ماهه", price: 3_400_000 },
            { capacity: "۱۲ ماهه", price: 6_200_000, compareAtPrice: 8_280_000 },
          ]
        ),
      },
      {
        slug: "netflix-subscription",
        title: "اشتراک نتفلیکس",
        art: "Netflix",
        tint: "#ff4d5a",
        soldCount: 970,
        description:
          "اشتراک نتفلیکس با کیفیت تصویر انتخابی. پلن استاندارد تا دو دستگاه هم‌زمان و پلن پریمیوم تا چهار دستگاه با کیفیت 4K را پشتیبانی می‌کند.",
        specs: [
          { key: "نوع سرویس", value: "فعال‌سازی روی اکانت شما" },
          { key: "زمان تحویل", value: "بین ۱ تا ۶ ساعت" },
          { key: "کیفیت تصویر", value: "بسته به پلن انتخابی — تا 4K" },
          { key: "پشتیبانی", value: "تا پایان دوره‌ی اشتراک" },
        ],
        variants: [
          ...combos(
            "Standard",
            [
              { region: "ترکیه", factor: 1 },
              { region: "آمریکا", factor: 1.45 },
            ],
            [
              { capacity: "۱ ماهه", price: 850_000 },
              { capacity: "۳ ماهه", price: 2_350_000 },
            ]
          ),
          ...combos(
            "Premium",
            [
              { region: "ترکیه", factor: 1 },
              { region: "آمریکا", factor: 1.45 },
            ],
            [
              { capacity: "۱ ماهه", price: 1_250_000 },
              { capacity: "۳ ماهه", price: 3_450_000, compareAtPrice: 3_750_000 },
            ]
          ),
        ],
      },
      {
        slug: "youtube-premium",
        title: "اشتراک یوتیوب پریمیوم",
        art: "YouTube",
        tint: "#ff5252",
        soldCount: 640,
        description:
          "حذف تبلیغات یوتیوب، پخش در پس‌زمینه، دانلود ویدیو و دسترسی کامل به YouTube Music. فعال‌سازی روی اکانت گوگل خودتان انجام می‌شود.",
        specs: [
          { key: "نوع سرویس", value: "فعال‌سازی روی اکانت شما" },
          { key: "زمان تحویل", value: "بین ۱ تا ۶ ساعت" },
          { key: "شامل YouTube Music", value: "بله" },
          { key: "پشتیبانی", value: "تا پایان دوره‌ی اشتراک" },
        ],
        variants: combos(
          "Individual",
          [
            { region: "ترکیه", factor: 1 },
            { region: "هند", factor: 0.7 },
          ],
          [
            { capacity: "۱ ماهه", price: 620_000 },
            { capacity: "۶ ماهه", price: 3_100_000 },
            { capacity: "۱۲ ماهه", price: 5_600_000, compareAtPrice: 7_440_000 },
          ]
        ),
      },
    ],
  },

  {
    slug: "shopping",
    name: "گیفت‌کارت خرید",
    icon: "bag",
    products: [
      {
        slug: "apple-itunes-gift-card",
        title: "گیفت‌کارت اپل آیتونز",
        art: "Apple",
        tint: "#c7cbd6",
        featured: true,
        soldCount: 1810,
        description:
          "گیفت‌کارت اپل برای خرید اپلیکیشن، بازی، موزیک، فیلم و شارژ iCloud. کد را می‌توانید مستقیم روی اپل‌آیدی خودتان اعمال کنید.",
        specs: [
          { key: "نوع کد", value: "کد دیجیتال یک‌بار مصرف" },
          { key: "زمان تحویل", value: "بین ۵ تا ۳۰ دقیقه" },
          { key: "محدودیت ریجن", value: "دارد — اپل‌آیدی باید هم‌ریجن باشد" },
          { key: "اعتبار کد", value: "بدون تاریخ انقضا" },
        ],
        variants: combos(
          "App Store & iTunes",
          [
            { region: "آمریکا", factor: 1 },
            { region: "انگلستان", factor: 1.08 },
          ],
          [
            { capacity: "۱۰ دلاری", price: 810_000 },
            { capacity: "۲۵ دلاری", price: 1_980_000 },
            { capacity: "۵۰ دلاری", price: 3_900_000 },
            { capacity: "۱۰۰ دلاری", price: 7_700_000, compareAtPrice: 8_100_000 },
          ]
        ),
      },
      {
        slug: "google-play-gift-card",
        title: "گیفت‌کارت گوگل‌پلی",
        art: "Google Play",
        tint: "#5ad3a8",
        soldCount: 1120,
        description:
          "شارژ حساب گوگل‌پلی برای خرید اپلیکیشن، بازی، کتاب و پرداخت درون‌برنامه‌ای. مناسب برای کاربران اندروید.",
        specs: [
          { key: "نوع کد", value: "کد دیجیتال یک‌بار مصرف" },
          { key: "زمان تحویل", value: "بین ۵ تا ۳۰ دقیقه" },
          { key: "محدودیت ریجن", value: "دارد — حساب گوگل باید هم‌ریجن باشد" },
          { key: "اعتبار کد", value: "بدون تاریخ انقضا" },
        ],
        variants: combos(
          "Google Play",
          [
            { region: "آمریکا", factor: 1 },
            { region: "ترکیه", factor: 0.85 },
          ],
          [
            { capacity: "۱۰ دلاری", price: 795_000 },
            { capacity: "۲۵ دلاری", price: 1_940_000 },
            { capacity: "۵۰ دلاری", price: 3_830_000 },
          ]
        ),
      },
      {
        slug: "amazon-gift-card",
        title: "گیفت‌کارت آمازون",
        art: "Amazon",
        tint: "#ffb547",
        soldCount: 430,
        description:
          "گیفت‌کارت آمازون برای خرید از فروشگاه آمازون. برای استفاده، ریجن کد باید با دامنه‌ی آمازونی که از آن خرید می‌کنید یکی باشد.",
        specs: [
          { key: "نوع کد", value: "کد دیجیتال یک‌بار مصرف" },
          { key: "زمان تحویل", value: "بین ۵ تا ۳۰ دقیقه" },
          { key: "محدودیت ریجن", value: "دارد — amazon.com یا amazon.de" },
          { key: "اعتبار کد", value: "۱۰ سال" },
        ],
        variants: combos(
          "Amazon",
          [
            { region: "آمریکا", factor: 1 },
            { region: "آلمان", factor: 1.12 },
          ],
          [
            { capacity: "۲۵ دلاری", price: 2_020_000 },
            { capacity: "۵۰ دلاری", price: 3_980_000 },
            { capacity: "۱۰۰ دلاری", price: 7_850_000 },
          ]
        ),
      },
    ],
  },

  {
    slug: "ai-tools",
    name: "سرویس‌های هوش مصنوعی",
    icon: "spark",
    products: [
      {
        slug: "chatgpt-plus",
        title: "اشتراک ChatGPT Plus",
        art: "ChatGPT",
        tint: "#3de9c0",
        featured: true,
        soldCount: 2340,
        description:
          "اشتراک ماهانه‌ی ChatGPT Plus با دسترسی به مدل‌های پیشرفته، سرعت پاسخ بالاتر و امکانات اختصاصی. فعال‌سازی روی اکانت خودتان انجام می‌شود.",
        specs: [
          { key: "نوع سرویس", value: "فعال‌سازی روی اکانت شما" },
          { key: "زمان تحویل", value: "بین ۱ تا ۶ ساعت" },
          { key: "نیاز به تحریم‌شکن", value: "بله، برای استفاده لازم است" },
          { key: "تمدید خودکار", value: "ندارد" },
        ],
        variants: combos(
          "Plus",
          [{ region: "جهانی", factor: 1 }],
          [
            { capacity: "۱ ماهه", price: 2_450_000 },
            { capacity: "۳ ماهه", price: 7_100_000, compareAtPrice: 7_350_000 },
          ]
        ),
      },
      {
        slug: "midjourney-subscription",
        title: "اشتراک میدجرنی",
        art: "Midjourney",
        tint: "#a78bfa",
        soldCount: 380,
        description:
          "اشتراک میدجرنی برای تولید تصویر با هوش مصنوعی. پلن Standard امکان تولید نامحدود در حالت Relax را هم دارد.",
        specs: [
          { key: "نوع سرویس", value: "فعال‌سازی روی اکانت شما" },
          { key: "زمان تحویل", value: "بین ۱ تا ۶ ساعت" },
          { key: "نیاز به دیسکورد", value: "بله" },
          { key: "تمدید خودکار", value: "ندارد" },
        ],
        variants: [
          ...combos(
            "Basic",
            [{ region: "جهانی", factor: 1 }],
            [{ capacity: "۱ ماهه", price: 1_150_000 }]
          ),
          ...combos(
            "Standard",
            [{ region: "جهانی", factor: 1 }],
            [
              { capacity: "۱ ماهه", price: 3_450_000 },
              { capacity: "۳ ماهه", price: 9_800_000, compareAtPrice: 10_350_000 },
            ]
          ),
        ],
      },
    ],
  },
];
