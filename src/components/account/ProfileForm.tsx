"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import { updateProfile, type ProfileState } from "@/app/actions/profile";
import { Button } from "@/components/ui/Button";
import {
  AddressFields,
  type AddressValue,
} from "@/components/form/AddressFields";

const initialState: ProfileState = { ok: false };

export function ProfileForm({
  phone,
  name,
  email,
  address: initialAddress,
}: {
  phone: string;
  name: string;
  email: string;
  address: AddressValue;
}) {
  const [state, formAction] = useActionState(updateProfile, initialState);
  const [address, setAddress] = useState<AddressValue>(initialAddress);

  return (
    <form action={formAction} className="flex flex-col gap-6">
      <Field label="شماره موبایل" htmlFor="phone">
        <input
          id="phone"
          type="text"
          dir="ltr"
          value={phone}
          readOnly
          disabled
          className="h-12 w-full cursor-not-allowed rounded-xl border border-ink-800 bg-ink-950 px-4 text-start text-sm text-muted"
        />
        <p className="mt-2 text-xs text-muted">
          شماره موبایل قابل تغییر نیست، چون شناسه‌ی ورود شماست.
        </p>
      </Field>

      <Field label="نام و نام خانوادگی" htmlFor="name">
        <input
          id="name"
          name="name"
          type="text"
          defaultValue={name}
          maxLength={80}
          placeholder="مثلاً: سارا محمدی"
          className={inputClass}
        />
      </Field>

      <Field label="ایمیل" htmlFor="email">
        <input
          id="email"
          name="email"
          type="email"
          dir="ltr"
          defaultValue={email}
          maxLength={120}
          placeholder="you@example.com"
          className={`${inputClass} text-start`}
        />
        <p className="mt-2 text-xs text-muted">
          کد سفارش و اطلاعات خرید به این ایمیل هم فرستاده می‌شود.
        </p>
      </Field>

      <div className="border-t border-ink-800 pt-6">
        <h3 className="mb-1 text-sm font-bold">آدرس پستی</h3>
        <p className="mb-5 text-xs leading-6 text-muted">
          سفارش‌ها به این آدرس ارسال می‌شوند. اگر اینجا کامل پرش کنید، موقع خرید
          خودکار پر می‌شود و لازم نیست دوباره بنویسید.
        </p>
        <AddressFields value={address} onChange={setAddress} />
      </div>

      {state.error && (
        <p
          role="alert"
          className="rounded-xl border border-danger/40 bg-danger/10 px-4 py-3 text-sm leading-6 text-danger"
        >
          {state.error}
        </p>
      )}

      {state.ok && state.message && (
        <p
          role="status"
          className="rounded-xl border border-success/40 bg-success/10 px-4 py-3 text-sm text-success"
        >
          {state.message}
        </p>
      )}

      <SubmitButton />
    </form>
  );
}

const inputClass =
  "h-12 w-full rounded-xl border border-ink-700 bg-ink-900 px-4 text-sm text-fg placeholder:text-muted/60 hover:border-ink-600";

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" size="lg" disabled={pending} className="self-start">
      {pending ? "در حال ذخیره…" : "ذخیره تغییرات"}
    </Button>
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
