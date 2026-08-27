import Link from "next/link";
import { cn } from "@/lib/cn";

type Variant = "primary" | "secondary" | "ghost" | "danger";
type Size = "sm" | "md" | "lg";

const base =
  "inline-flex items-center justify-center gap-2 rounded-xl font-medium transition-colors select-none disabled:opacity-45 disabled:cursor-not-allowed";

const variants: Record<Variant, string> = {
  // تنها دکمه‌ی «پررنگ» سایت — برای اقدام اصلی هر صفحه
  primary:
    "bg-accent-400 text-ink-950 hover:bg-accent-500 disabled:hover:bg-accent-400",
  secondary:
    "border border-ink-700 bg-ink-900 text-fg hover:border-ink-600 hover:bg-ink-800",
  ghost: "text-muted hover:text-fg hover:bg-ink-800",
  danger: "border border-danger/40 text-danger hover:bg-danger/10",
};

const sizes: Record<Size, string> = {
  sm: "h-9 px-3 text-sm",
  md: "h-11 px-5 text-sm",
  lg: "h-13 px-7 text-base",
};

export function buttonClass(
  variant: Variant = "primary",
  size: Size = "md",
  extra?: string
) {
  return cn(base, variants[variant], sizes[size], extra);
}

type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant;
  size?: Size;
};

export function Button({
  variant = "primary",
  size = "md",
  className,
  ...props
}: ButtonProps) {
  return <button className={buttonClass(variant, size, className)} {...props} />;
}

type ButtonLinkProps = React.ComponentProps<typeof Link> & {
  variant?: Variant;
  size?: Size;
};

export function ButtonLink({
  variant = "primary",
  size = "md",
  className,
  ...props
}: ButtonLinkProps) {
  return <Link className={buttonClass(variant, size, className)} {...props} />;
}
