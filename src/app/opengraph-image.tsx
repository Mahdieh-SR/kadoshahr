import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { ImageResponse } from "next/og";
import { rtlWords } from "@/lib/og-rtl";

/**
 * تصویری که هنگام اشتراک لینک سایت در تلگرام، واتساپ یا شبکه‌های اجتماعی
 * نمایش داده می‌شود.
 *
 * فونت وزیرمتن دستی به موتور تصویرساز داده می‌شود، چون فونت پیش‌فرضش
 * حروف فارسی را نمی‌شناسد.
 */
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const alt = "گیفت‌لند — خرید گیفت‌کارت و اکانت دیجیتال";

/**
 * یک خط متن فارسی؛ هر کلمه یک عنصر جداست.
 * فاصله‌ی بین کلمه‌ها را خود Satori هم کمی اضافه می‌کند و قابل حذف نیست،
 * پس gap کوچک نگه داشته شده تا کلمه‌ها به هم نچسبند.
 */
function Line({
  text,
  gap = 10,
  style,
}: {
  text: string;
  gap?: number;
  style?: React.CSSProperties;
}) {
  return (
    <div style={{ display: "flex", gap, ...style }}>
      {rtlWords(text).map((word, i) => (
        <span key={i}>{word}</span>
      ))}
    </div>
  );
}

export default async function OpengraphImage() {
  const font = await readFile(
    join(process.cwd(), "src/assets/Vazirmatn-Bold.ttf")
  );

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "flex-end",
          justifyContent: "center",
          background: "#08070f",
          padding: "80px",
        }}
      >
        {/* لوگو — آیکون سمت راست، مثل هدر سایت */}
        <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
          <Line text="گیفت‌لند" style={{ color: "#edeaf7", fontSize: 46 }} />
          <div
            style={{
              width: 72,
              height: 72,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              background: "#3de9c0",
              color: "#08070f",
              fontSize: 42,
              borderRadius: 18,
            }}
          >
            گ
          </div>
        </div>

        <div
          style={{
            marginTop: 54,
            display: "flex",
            flexDirection: "column",
            alignItems: "flex-end",
            gap: 14,
          }}
        >
          <Line
            text="گیفت‌کارت و اکانت دیجیتال"
            gap={12}
            style={{ color: "#edeaf7", fontSize: 62 }}
          />
          <Line
            text="بدون دردسر"
            gap={12}
            style={{ color: "#3de9c0", fontSize: 62 }}
          />
        </div>

        <Line
          text="تحویل سریع · پرداخت امن · پشتیبانی واقعی"
          gap={12}
          style={{ marginTop: 48, color: "#9a93b8", fontSize: 28 }}
        />
      </div>
    ),
    {
      ...size,
      fonts: [{ name: "Vazirmatn", data: font, style: "normal", weight: 700 }],
    }
  );
}
