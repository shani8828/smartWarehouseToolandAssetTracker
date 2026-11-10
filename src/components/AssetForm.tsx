"use client";

import Link from "next/link";
import { useFormState } from "react-dom";
import { saveAssetAction } from "@/app/actions/admin";
import type { ActionState } from "@/app/actions/custody";
import { CONDITIONS, CONDITION_LABEL, type Condition } from "@/lib/constants";
import { FormMessage, SubmitButton } from "./forms";
import { Field, inputCls } from "./ui";

export type AssetFormValues = {
  id?: string;
  assetTag?: string;
  name?: string;
  categoryId?: string;
  manufacturer?: string;
  serialNumber?: string;
  condition?: Condition;
  lab?: string;
  shelf?: string;
  purchaseDate?: string;
  purchaseCost?: number;
  notes?: string;
};

export default function AssetForm({
  values = {},
  categories,
  labs,
}: {
  values?: AssetFormValues;
  categories: { id: string; name: string; code: string }[];
  labs: string[];
}) {
  const [state, action] = useFormState<ActionState, FormData>(saveAssetAction, {});
  return (
    <form action={action} className="max-w-2xl space-y-5">
      {values.id && <input type="hidden" name="id" value={values.id} />}
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Name">
          <input name="name" defaultValue={values.name} required placeholder="e.g. Fluke 117 Digital Multimeter" className={inputCls} />
        </Field>
        <Field label="Category">
          <select name="categoryId" defaultValue={values.categoryId ?? ""} required className={inputCls}>
            <option value="" disabled>
              Choose…
            </option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name} ({c.code})
              </option>
            ))}
          </select>
        </Field>
        <Field label="Asset tag" hint={values.id ? undefined : "Leave empty to generate the next free tag"}>
          <input name="assetTag" defaultValue={values.assetTag} placeholder="ISE-MM-004" className={`${inputCls} font-mono uppercase placeholder:normal-case`} />
        </Field>
        <Field label="Condition">
          <select name="condition" defaultValue={values.condition ?? "GOOD"} className={inputCls}>
            {CONDITIONS.map((c) => (
              <option key={c} value={c}>
                {CONDITION_LABEL[c]}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Manufacturer">
          <input name="manufacturer" defaultValue={values.manufacturer} className={inputCls} />
        </Field>
        <Field label="Serial number">
          <input name="serialNumber" defaultValue={values.serialNumber} className={inputCls} />
        </Field>
        <Field label="Lab">
          <input name="lab" list="labs" defaultValue={values.lab} required className={inputCls} />
          <datalist id="labs">
            {labs.map((l) => (
              <option key={l} value={l} />
            ))}
          </datalist>
        </Field>
        <Field label="Shelf / bin">
          <input name="shelf" defaultValue={values.shelf} className={inputCls} />
        </Field>
        <Field label="Purchase date">
          <input type="date" name="purchaseDate" defaultValue={values.purchaseDate} className={inputCls} />
        </Field>
        <Field label="Purchase cost (₹)">
          <input type="number" name="purchaseCost" min={0} step="1" defaultValue={values.purchaseCost} className={inputCls} />
        </Field>
      </div>
      <Field label="Notes">
        <textarea name="notes" rows={3} defaultValue={values.notes} className={inputCls} />
      </Field>
      <FormMessage state={state} />
      <div className="flex gap-2">
        <SubmitButton>{values.id ? "Save changes" : "Add asset"}</SubmitButton>
        <Link href={values.id ? `/assets/${values.id}` : "/assets"} className="btn-secondary">
          Cancel
        </Link>
      </div>
    </form>
  );
}
