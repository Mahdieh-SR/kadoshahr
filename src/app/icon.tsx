import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { ImageResponse } from "next/og";

/** آیکون تب مرورگر — «ک» روی مربع نعنایی، هماهنگ با لوگوی سایت */
export const size = { width: 32, height: 32 };
export const contentType = "image/png";

export default async function Icon() {
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
          alignItems: "center",
          justifyContent: "center",
          background: "#3de9c0",
          color: "#08070f",
          fontSize: 21,
          borderRadius: 7,
        }}
      >
        ک
      </div>
    ),
    {
      ...size,
      fonts: [{ name: "Vazirmatn", data: font, style: "normal", weight: 700 }],
    }
  );
}
