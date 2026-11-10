"use client";

import { useRef } from "react";
import { useFormState } from "react-dom";
import { login, type LoginState } from "@/app/actions/auth";
import { SubmitButton } from "@/components/forms";
import { Field, inputCls } from "@/components/ui";

// Accounts created by `npm run seed` (local demo data only)
const DEMO = [
  { label: "Admin", email: "admin.iselab@example.com", password: "admin123" },
  { label: "Lab staff", email: "staff.iselab@example.com", password: "staff123" },
  { label: "Student", email: "priya.n@example.com", password: "student123" },
];

export default function LoginForm({ next }: { next?: string }) {
  const [state, action] = useFormState<LoginState, FormData>(login, {});
  const email = useRef<HTMLInputElement>(null);
  const password = useRef<HTMLInputElement>(null);

  return (
    <>
      <form action={action} className="space-y-4">
        <input type="hidden" name="next" value={next ?? ""} />
        <Field label="Email">
          <input ref={email} name="email" type="email" autoComplete="username" required className={inputCls} />
        </Field>
        <Field label="Password">
          <input ref={password} name="password" type="password" autoComplete="current-password" required className={inputCls} />
        </Field>
        {state.error && (
          <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
            {state.error}
          </p>
        )}
        <SubmitButton className="w-full">Sign in</SubmitButton>
      </form>

      <div className="mt-8 rounded-xl border border-slate-200 p-4">
        <p className="text-xs font-medium text-slate-500">Demo accounts</p>
        <div className="mt-2 grid grid-cols-3 gap-2">
          {DEMO.map((d) => (
            <button
              key={d.label}
              type="button"
              onClick={() => {
                if (email.current && password.current) {
                  email.current.value = d.email;
                  password.current.value = d.password;
                }
              }}
              className="rounded-lg border border-slate-200 px-2 py-1.5 text-xs font-medium text-slate-700 transition hover:border-navy hover:text-navy"
            >
              {d.label}
            </button>
          ))}
        </div>
      </div>
    </>
  );
}
