/**
 * اطلاعات تماس فروشگاه — تنها منبع حقیقت.
 *
 * صفحه‌ی «تماس با ما» و پاورقی هر دو از همین‌جا می‌خوانند، تا با عوض شدن یک
 * شماره لازم نباشد چند فایل را بگردی و یکی را جا بیندازی.
 */

export const contact = {
  phone: "09331960478",
  /** برای href — شماره‌ی ایرانی با کد کشور، بدون صفر ابتدایی */
  phoneHref: "tel:+989331960478",

  email: "mahdiehsrwork@gmail.com",

  telegram: "madi_on_the_shore",
  telegramUrl: "https://t.me/madi_on_the_shore",

  /** نام ثبتی کسب‌وکار — برای صفحه‌های رسمی و بعداً نماد اعتماد الکترونیک */
  legalName: "تجارت الکترونیک کاسپین",
  address: "تهران، خیابان نیاوران، اطلس مال، طبقه اداری",
} as const;

export const emailHref = `mailto:${contact.email}`;
