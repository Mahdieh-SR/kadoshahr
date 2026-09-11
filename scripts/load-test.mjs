/**
 * سنجش ظرفیت سایت زنده — چند درخواست هم‌زمان را با چه سرعتی جواب می‌دهد.
 *
 * عمداً کوتاه و پله‌ای است: از یک درخواست شروع می‌کند و بالا می‌رود، تا
 * نقطه‌ای که تاخیر بترکد پیدا شود بدون اینکه سایت واقعاً زمین بخورد.
 *
 * اجرا: LIVE_URL=https://… node scripts/load-test.mjs
 */
const BASE = (process.env.LIVE_URL ?? "").replace(/\/+$/, "");
if (!BASE) {
  console.error("LIVE_URL تنظیم نشده است.");
  process.exit(1);
}

/** صفحه‌های سنگین‌تر عمداً انتخاب شده‌اند — هرکدام چند کوئری به دیتابیس می‌زنند */
const PATHS = ["/", "/products", "/category/subscriptions"];

const pct = (sorted, p) => sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * p))];

async function one(path) {
  const t = performance.now();
  try {
    const res = await fetch(BASE + path);
    await res.arrayBuffer();
    return { ms: performance.now() - t, ok: res.ok, status: res.status };
  } catch (e) {
    return { ms: performance.now() - t, ok: false, status: e.cause?.code ?? "ERR" };
  }
}

async function burst(concurrency, rounds) {
  const samples = [];
  const started = performance.now();

  for (let r = 0; r < rounds; r++) {
    const batch = Array.from({ length: concurrency }, (_, i) =>
      one(PATHS[(r * concurrency + i) % PATHS.length])
    );
    samples.push(...(await Promise.all(batch)));
  }

  const wall = (performance.now() - started) / 1000;
  const times = samples.map((s) => s.ms).sort((a, b) => a - b);
  const failed = samples.filter((s) => !s.ok);

  return {
    concurrency,
    total: samples.length,
    rps: samples.length / wall,
    p50: pct(times, 0.5),
    p95: pct(times, 0.95),
    max: times[times.length - 1],
    failed: failed.length,
    codes: [...new Set(failed.map((f) => f.status))].join("، "),
  };
}

console.log(`\nهدف: ${BASE}`);
console.log("گرم کردن …");
await Promise.all(PATHS.map(one));

console.log(
  "\n" +
    "هم‌زمان".padEnd(9) +
    "درخواست".padEnd(9) +
    "req/s".padEnd(8) +
    "میانه".padEnd(9) +
    "p95".padEnd(9) +
    "بیشینه".padEnd(9) +
    "خطا"
);
console.log("─".repeat(62));

for (const c of [1, 5, 10, 20, 40]) {
  const r = await burst(c, 3);
  console.log(
    String(r.concurrency).padEnd(9) +
      String(r.total).padEnd(9) +
      r.rps.toFixed(1).padEnd(8) +
      (Math.round(r.p50) + "ms").padEnd(9) +
      (Math.round(r.p95) + "ms").padEnd(9) +
      (Math.round(r.max) + "ms").padEnd(9) +
      (r.failed ? `${r.failed} (${r.codes})` : "—")
  );
  // فرصت بازیابی، تا اندازه‌گیری پله‌ی بعد آلوده‌ی صف قبلی نشود
  await new Promise((res) => setTimeout(res, 2000));
}

console.log("");
