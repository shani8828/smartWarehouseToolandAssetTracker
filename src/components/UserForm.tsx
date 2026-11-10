"use client";

import { useEffect, useRef } from "react";
import { useFormState } from "react-dom";
import { createUserAction } from "@/app/actions/admin";
import type { ActionState } from "@/app/actions/custody";
import { ROLES, ROLE_LABEL } from "@/lib/constants";
import { FormMessage, SubmitButton } from "./forms";
import { Field, inputCls } from "./ui";

export default function UserForm() {
  const [state, action] = useFormState<ActionState, FormData>(createUserAction, {});
  const ref = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (state.ok) ref.current?.reset();
  }, [state]);
  return (
    <form ref={ref} action={action} className="space-y-3">
      <Field label="Full name">
        <input name="name" required className={inputCls} />
      </Field>
      <Field label="Email">
        <input name="email" type="email" required className={inputCls} />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Role">
          <select name="role" defaultValue="BORROWER" className={inputCls}>
            {ROLES.map((r) => (
              <option key={r} value={r}>
                {ROLE_LABEL[r]}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Department">
          <input name="department" required placeholder="ISE" className={`${inputCls} uppercase placeholder:normal-case`} />
        </Field>
      </div>
      <Field label="Roll number (students)">
        <input name="rollNumber" className={inputCls} />
      </Field>
      <Field label="Initial password">
        <input name="password" type="password" minLength={6} required autoComplete="new-password" className={inputCls} />
      </Field>
      <FormMessage state={state} />
      <SubmitButton className="w-full">Add user</SubmitButton>
    </form>
  );
}
