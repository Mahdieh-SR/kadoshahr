"use client";

import { useMemo } from "react";
import { ChevronDownIcon } from "@/components/ui/icons";
import { citiesOf, provinceNames } from "@/data/iran-locations";
import { toLatinDigits } from "@/lib/format";
import { cn } from "@/lib/cn";

export type AddressValue = {
  province: string;
  city: string;
  address: string;
  postalCode: string;
};

export const emptyAddress: AddressValue = {
  province: "",
  city: "",
  address: "",
  postalCode: "",
};

/**
 * فیلدهای آدرس پستی — در پروفایل و تسویه‌حساب مشترک است.
 * شهر وابسته به استان است: با تغییر استان، لیست شهرها عوض می‌شود و
 * اگر شهر قبلی در استان جدید نباشد پاک می‌شود.
 */
export function AddressFields({
  value,
  onChange,
  disabled,
}: {
  value: AddressValue;
  onChange: (next: AddressValue) => void;
  disabled?: boolean;
}) {
  const cities = useMemo(() => citiesOf(value.province), [value.province]);

  function setProvince(province: string) {
    const nextCities = citiesOf(province);
    onChange({
      ...value,
      province,
      city: nextCities.includes(value.city) ? value.city : "",
    });
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="استان" htmlFor="province">
          <SelectBox
            id="province"
            name="province"
            value={value.province}
            onChange={setProvince}
            disabled={disabled}
            placeholder="انتخاب استان"
            options={provinceNames}
          />
        </Field>

        <Field label="شهر" htmlFor="city">
          <SelectBox
            id="city"
            name="city"
            value={value.city}
            onChange={(city) => onChange({ ...value, city })}
            disabled={disabled || !value.province}
            placeholder={value.province ? "انتخاب شهر" : "اول استان را انتخاب کنید"}
            options={cities}
          />
        </Field>
      </div>

      <Field label="نشانی کامل پستی" htmlFor="address">
        <textarea
          id="address"
          name="address"
          rows={3}
          maxLength={500}
          disabled={disabled}
          value={value.address}
          onChange={(e) => onChange({ ...value, address: e.target.value })}
          placeholder="خیابان، کوچه، پلاک، واحد"
          className="w-full resize-y rounded-xl border border-ink-700 bg-ink-900 p-4 text-sm leading-7 text-fg placeholder:text-muted/60 hover:border-ink-600 disabled:opacity-50"
        />
        <p className="mt-2 text-xs text-muted">
          هرچه دقیق‌تر بنویسید، بسته مطمئن‌تر به دستتان می‌رسد.
        </p>
      </Field>

      <Field label="کد پستی" htmlFor="postalCode">
        <input
          id="postalCode"
          name="postalCode"
          inputMode="numeric"
          dir="ltr"
          maxLength={10}
          disabled={disabled}
          value={value.postalCode}
          onChange={(e) =>
            onChange({
              ...value,
              postalCode: toLatinDigits(e.target.value).replace(/\D/g, "").slice(0, 10),
            })
          }
          placeholder="۱۰ رقم، بدون خط تیره"
          className="h-12 w-full rounded-xl border border-ink-700 bg-ink-900 px-4 text-start text-sm tracking-[0.2em] text-fg placeholder:tracking-normal placeholder:text-muted/60 hover:border-ink-600 disabled:opacity-50"
        />
        <p className="mt-2 text-xs text-muted">
          {value.postalCode.length > 0 && value.postalCode.length < 10
            ? `${10 - value.postalCode.length} رقم دیگر باقی مانده`
            : "کد پستی ۱۰ رقمی محل تحویل"}
        </p>
      </Field>
    </div>
  );
}

function SelectBox({
  id,
  name,
  value,
  onChange,
  options,
  placeholder,
  disabled,
}: {
  id: string;
  name: string;
  value: string;
  onChange: (v: string) => void;
  options: string[];
  placeholder: string;
  disabled?: boolean;
}) {
  return (
    <span className="relative block">
      <select
        id={id}
        name={name}
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
        className={cn(
          "h-12 w-full appearance-none rounded-xl border border-ink-700 bg-ink-900 ps-4 pe-10 text-sm transition-colors hover:border-ink-600 disabled:opacity-50",
          value ? "text-fg" : "text-muted"
        )}
      >
        <option value="" className="bg-ink-900">
          {placeholder}
        </option>
        {options.map((o) => (
          <option key={o} value={o} className="bg-ink-900 text-fg">
            {o}
          </option>
        ))}
      </select>
      <ChevronDownIcon
        width={18}
        height={18}
        className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-muted"
      />
    </span>
  );
}

function Field({
  label,
  htmlFor,
  children,
}: {
  label: string;
  htmlFor: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label htmlFor={htmlFor} className="mb-2 block text-sm font-bold text-fg">
        {label}
      </label>
      {children}
    </div>
  );
}
