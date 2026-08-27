import Link from "next/link";
import { ButtonLink } from "@/components/ui/Button";
import { ProductCard } from "@/components/product/ProductCard";
import { getCategories, getProductCards } from "@/lib/products";
import {
  BoltIcon,
  HeadsetIcon,
  ShieldIcon,
  SparkIcon,
  categoryIcons,
} from "@/components/ui/icons";
import { formatNumber } from "@/lib/format";
import { homeContent } from "@/content/home";

export const dynamic = "force-dynamic";

// نگاشت نام آیکون در فایل متن‌ها به کامپوننت واقعی
const trustIcons = {
  bolt: BoltIcon,
  shield: ShieldIcon,
  headset: HeadsetIcon,
  spark: SparkIcon,
} as const;

export default async function HomePage() {
  const { hero, trustPoints, sections, stats, testimonials } = homeContent;

  const [categories, bestsellers, newest] = await Promise.all([
    getCategories(),
    getProductCards({ sort: "bestselling", take: 4 }),
    getProductCards({ sort: "newest", take: 4 }),
  ]);

  return (
    <>
      {/* ── هیرو: یک پیام، یک دکمه‌ی اصلی ── */}
      <section className="border-b border-ink-800">
        <div className="container-page grid gap-12 py-20 lg:grid-cols-[1.1fr_1fr] lg:items-center lg:py-28">
          <div>
            <span className="inline-flex items-center gap-2 rounded-full border border-ink-700 px-3 py-1.5 text-xs text-muted">
              <span className="h-1.5 w-1.5 rounded-full bg-accent-400" />
              {hero.badge}
            </span>

            <h1 className="mt-6 text-4xl leading-[1.35] font-black text-fg sm:text-5xl sm:leading-[1.3]">
              {hero.titleLine1}
              <br />
              <span className="text-accent-400">{hero.titleLine2}</span>
            </h1>

            <p className="mt-6 max-w-lg text-base leading-8 text-muted">
              {hero.description}
            </p>

            <div className="mt-9">
              <ButtonLink href={hero.ctaHref} size="lg">
                {hero.ctaLabel}
              </ButtonLink>
            </div>
          </div>

          {/* کارت‌های اعتماد — بدون گرادینت، فقط خط و فاصله */}
          <ul className="flex flex-col gap-3">
            {trustPoints.map((point) => {
              const Icon = trustIcons[point.icon] ?? BoltIcon;
              return (
                <li
                  key={point.title}
                  className="flex items-start gap-4 rounded-card border border-ink-800 bg-ink-900 p-5"
                >
                  <span className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-ink-800 text-accent-400">
                    <Icon />
                  </span>
                  <div>
                    <h3 className="text-sm font-bold">{point.title}</h3>
                    <p className="mt-1.5 text-sm leading-6 text-muted">
                      {point.text}
                    </p>
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      </section>

      {/* ── دسته‌بندی‌ها ── */}
      <section className="container-page py-20">
        <SectionHeading
          title={sections.categories}
          href="/products"
          linkLabel="همه محصولات"
        />

        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {categories.map((cat) => {
            const Icon = categoryIcons[cat.icon ?? ""] ?? categoryIcons.bag!;
            return (
              <Link
                key={cat.id}
                href={`/category/${cat.slug}`}
                className="group flex items-center gap-4 rounded-card border border-ink-800 bg-ink-900 p-5 transition-colors hover:border-ink-600"
              >
                <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-ink-800 text-brand-400 transition-colors group-hover:text-accent-400">
                  <Icon width={24} height={24} />
                </span>
                <span className="min-w-0">
                  <span className="block truncate text-sm font-bold">
                    {cat.name}
                  </span>
                  <span className="mt-1 block text-xs text-muted">
                    {formatNumber(cat._count.products)} محصول
                  </span>
                </span>
              </Link>
            );
          })}
        </div>
      </section>

      {/* ── پرفروش‌ترین‌ها ── */}
      {bestsellers.length > 0 && (
        <section className="container-page pb-20">
          <SectionHeading
            title={sections.bestsellers}
            href="/products?sort=bestselling"
            linkLabel="دیدن همه"
          />
          <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {bestsellers.map((p) => (
              <ProductCard key={p.id} product={p} />
            ))}
          </div>
        </section>
      )}

      {/* ── جدیدترین‌ها ── */}
      {newest.length > 0 && (
        <section className="container-page pb-20">
          <SectionHeading
            title={sections.newest}
            href="/products?sort=newest"
            linkLabel="دیدن همه"
          />
          <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {newest.map((p) => (
              <ProductCard key={p.id} product={p} />
            ))}
          </div>
        </section>
      )}

      {/* ── اعتمادسازی ── */}
      <section className="border-y border-ink-800 bg-ink-900">
        <div className="container-page py-16">
          <dl className="grid gap-8 sm:grid-cols-3">
            {stats.map((s) => (
              <div key={s.label}>
                <dt className="text-sm text-muted">{s.label}</dt>
                <dd className="mt-2 text-3xl font-black text-accent-400">
                  {formatNumber(s.value)}
                  {s.suffix}
                </dd>
              </div>
            ))}
          </dl>

          <ul className="mt-14 grid gap-4 lg:grid-cols-3">
            {testimonials.map((t) => (
              <li
                key={t.name}
                className="rounded-card border border-ink-800 bg-ink-950 p-6"
              >
                <p className="text-sm leading-7 text-muted">«{t.text}»</p>
                <span className="mt-4 block text-xs font-bold text-fg">
                  {t.name}
                </span>
              </li>
            ))}
          </ul>
        </div>
      </section>
    </>
  );
}

function SectionHeading({
  title,
  href,
  linkLabel,
}: {
  title: string;
  href: string;
  linkLabel: string;
}) {
  return (
    <div className="flex items-baseline justify-between gap-4">
      <h2 className="text-xl font-bold sm:text-2xl">{title}</h2>
      <Link
        href={href}
        className="shrink-0 text-sm text-muted transition-colors hover:text-accent-400"
      >
        {linkLabel}
      </Link>
    </div>
  );
}
