"use client";

/**
 * آخرین لایه‌ی محافظ — وقتی خطا حتی در layout اصلی رخ دهد.
 * چون جایگزین کل صفحه می‌شود، باید تگ html و body خودش را داشته باشد
 * و نمی‌تواند به استایل‌های سایت تکیه کند.
 */
export default function GlobalError({ reset }: { reset: () => void }) {
  return (
    <html lang="fa" dir="rtl">
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#08070f",
          color: "#edeaf7",
          fontFamily: "Vazirmatn, Tahoma, sans-serif",
          textAlign: "center",
          padding: "24px",
        }}
      >
        <div>
          <h1 style={{ fontSize: "20px", marginBottom: "12px" }}>
            سایت موقتاً در دسترس نیست
          </h1>
          <p style={{ fontSize: "14px", color: "#9a93b8", lineHeight: 2 }}>
            لطفاً چند لحظه دیگر دوباره تلاش کنید.
          </p>
          <button
            onClick={reset}
            style={{
              marginTop: "24px",
              padding: "12px 28px",
              borderRadius: "12px",
              border: "none",
              background: "#3de9c0",
              color: "#08070f",
              fontSize: "14px",
              fontWeight: 700,
              cursor: "pointer",
              fontFamily: "inherit",
            }}
          >
            تلاش دوباره
          </button>
        </div>
      </body>
    </html>
  );
}
