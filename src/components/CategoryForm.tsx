"use client";

import { useEffect, useRef } from "react";
import { useFormState } from "react-dom";
import { createCategoryAction } from "@/app/actions/admin";
import type { ActionState } from "@/app/actions/custody";
import { FormMessage, SubmitButton } from "./forms";
import { Field, inputCls } from "./ui";

export default function CategoryForm() {
  const [state, action] = useFormState<ActionState, FormData>(createCategoryAction, {});
  const ref = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (state.ok) ref.current?.reset();
  }, [state]);
  return (
    <form ref={ref} action={action} className="space-y-3">
      <Field label="Name">
        <input name="name" required placeholder="e.g. Torque Wrenches" className={inputCls} />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Code">
          <input name="code" required maxLength={4} placeholder="TW" className={`${inputCls} font-mono uppercase`} />
        </Field>
        <Field label="Loan days">
          <input name="defaultLoanDays" type="number" min={1} max={90} defaultValue={7} required className={inputCls} />
        </Field>
      </div>
      <FormMessage state={state} />
      <SubmitButton variant="secondary" className="w-full">
        Add category
      </SubmitButton>
    </form>
  );
}
