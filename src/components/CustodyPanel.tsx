"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useFormState } from "react-dom";
import { checkoutAction, maintenanceAction, repairedAction, returnAction, type ActionState } from "@/app/actions/custody";
import { CONDITIONS, CONDITION_LABEL, ROLE_LABEL, type AssetStatus, type Role } from "@/lib/constants";
import { addDays, daysOverdue, fmtDate, toInputDate } from "@/lib/format";
import { FormMessage, SubmitButton } from "./forms";
import { Field, inputCls } from "./ui";

export type PanelAsset = {
  id: string;
  assetTag: string;
  status: AssetStatus;
  defaultLoanDays: number;
  custodian?: string;
  dueAt?: string;
  checkoutAt?: string;
};
export type Borrower = { id: string; name: string; department: string; role: Role; rollNumber?: string };

// Context-aware actions for one asset: what you can do depends on its state and your role.
export default function CustodyPanel({
  asset,
  role,
  userId,
  borrowers,
  onDone,
}: {
  asset: PanelAsset;
  role: Role;
  userId: string;
  borrowers: Borrower[];
  onDone?: () => void;
}) {
  const staff = role === "ADMIN" || role === "LAB_STAFF";
  const [co, coAction] = useFormState<ActionState, FormData>(checkoutAction, {});
  const [rt, rtAction] = useFormState<ActionState, FormData>(returnAction, {});
  const [mt, mtAction] = useFormState<ActionState, FormData>(maintenanceAction, {});
  const [rp, rpAction] = useFormState<ActionState, FormData>(repairedAction, {});
  const latest = [co, rt, mt, rp].reduce((a, b) => ((b.at ?? 0) > (a.at ?? 0) ? b : a), {} as ActionState);

  // Tell the parent (e.g. the scanner) when an action succeeded
  const seen = useRef(0);
  useEffect(() => {
    if (latest.ok && latest.at && latest.at !== seen.current) {
      seen.current = latest.at;
      onDone?.();
    }
  }, [latest, onDone]);

  const [who, setWho] = useState("");
  // Controlled so no borrower is ever pre-selected (an uncontrolled listbox
  // re-selects its first row when the form resets after an action).
  const [borrowerId, setBorrowerId] = useState("");
  useEffect(() => {
    setBorrowerId("");
    setWho("");
  }, [asset.id, asset.status]);
  const chosen = borrowers.find((b) => b.id === borrowerId);
  // Browsers highlight the first row of a listbox whose value matches no
  // option; clear it so the list never looks pre-selected.
  const listRef = useRef<HTMLSelectElement>(null);
  useEffect(() => {
    if (listRef.current && listRef.current.value !== borrowerId) listRef.current.selectedIndex = -1;
  });
  const [showMaint, setShowMaint] = useState(false);
  const defaultDue = useMemo(() => toInputDate(addDays(new Date(), asset.defaultLoanDays)), [asset.defaultLoanDays]);
  const minDue = toInputDate(addDays(new Date(), 0));
  const filtered = borrowers.filter((b) => {
    const n = who.trim().toLowerCase();
    return !n || b.name.toLowerCase().includes(n) || b.department.toLowerCase() === n || b.rollNumber?.toLowerCase().includes(n);
  });

  return (
    <div className="space-y-4">
      <FormMessage state={latest} />

      {asset.status === "AVAILABLE" && (
        <form action={coAction} className="space-y-3">
          <input type="hidden" name="assetId" value={asset.id} />
          {staff ? (
            <Field label="Issue to">
              <input value={who} onChange={(e) => setWho(e.target.value)} placeholder="Filter by name, dept or roll no." className={`${inputCls} mb-2`} />
              <input type="hidden" name="borrowerId" value={borrowerId} />
              <select
                ref={listRef}
                aria-label="Borrower"
                className={inputCls}
                value={borrowerId}
                onChange={(e) => setBorrowerId(e.target.value)}
                size={Math.min(5, Math.max(2, filtered.length))}
              >
                {filtered.map((b) => (
                  <option key={b.id} value={b.id} className="py-1">
                    {b.name} ({b.department}
                    {b.role !== "BORROWER" ? `, ${ROLE_LABEL[b.role]}` : ""})
                  </option>
                ))}
              </select>
            </Field>
          ) : (
            <input type="hidden" name="borrowerId" value={userId} />
          )}
          <Field label="Due back on" hint={`Default loan period for this category is ${asset.defaultLoanDays} days`}>
            <input type="date" name="dueDate" defaultValue={defaultDue} min={minDue} required className={inputCls} />
          </Field>
          <Field label="Remarks (optional)">
            <input name="remarks" maxLength={300} placeholder="e.g. for IM39007 lab session" className={inputCls} />
          </Field>
          <SubmitButton className="w-full" disabled={staff && !chosen}>
            {!staff ? "Borrow this tool" : chosen ? `Check out to ${chosen.name}` : "Select a borrower"}
          </SubmitButton>
        </form>
      )}

      {(asset.status === "CHECKED_OUT" || asset.status === "OVERDUE") && (
        <div className="space-y-3">
          <div className={`rounded-lg px-4 py-3 text-sm ${asset.status === "OVERDUE" ? "bg-red-50 text-red-800" : "bg-sky-50 text-sky-900"}`}>
            With <span className="font-semibold">{asset.custodian}</span>
            {asset.checkoutAt && <> since {fmtDate(asset.checkoutAt)}</>}
            {asset.dueAt && (
              <>
                {", "}
                {asset.status === "OVERDUE" || new Date(asset.dueAt) < new Date() ? (
                  <span className="font-semibold">{daysOverdue(asset.dueAt, new Date())} days overdue</span>
                ) : (
                  <>due {fmtDate(asset.dueAt)}</>
                )}
              </>
            )}
          </div>
          {staff ? (
            <form action={rtAction} className="space-y-3">
              <input type="hidden" name="assetId" value={asset.id} />
              <fieldset>
                <legend className="mb-1 text-sm font-medium text-slate-700">Condition on return</legend>
                <div className="grid grid-cols-3 gap-2">
                  {CONDITIONS.map((c) => (
                    <label key={c} className="cursor-pointer">
                      <input type="radio" name="conditionIn" value={c} defaultChecked={c === "GOOD"} className="peer sr-only" />
                      <span
                        className={`block rounded-lg border px-3 py-2 text-center text-sm transition peer-checked:font-medium peer-focus-visible:ring-2 peer-focus-visible:ring-navy/30 ${
                          c === "DAMAGED"
                            ? "border-slate-300 peer-checked:border-red-500 peer-checked:bg-red-50 peer-checked:text-red-700"
                            : "border-slate-300 peer-checked:border-navy peer-checked:bg-navy-50 peer-checked:text-navy"
                        }`}
                      >
                        {CONDITION_LABEL[c]}
                      </span>
                    </label>
                  ))}
                </div>
              </fieldset>
              <Field label="Remarks (optional)">
                <input name="remarks" maxLength={300} className={inputCls} />
              </Field>
              <SubmitButton className="w-full">Receive return</SubmitButton>
            </form>
          ) : (
            <p className="text-sm text-slate-500">Hand the tool back at the lab counter; staff will scan it in.</p>
          )}
        </div>
      )}

      {asset.status === "UNDER_MAINTENANCE" && (
        <div className="space-y-3">
          <p className="rounded-lg bg-amber-50 px-4 py-3 text-sm text-amber-900">This tool is under maintenance and cannot be issued.</p>
          {staff && (
            <form action={rpAction}>
              <input type="hidden" name="assetId" value={asset.id} />
              <SubmitButton className="w-full">Mark repaired and available</SubmitButton>
            </form>
          )}
        </div>
      )}

      {staff && asset.status === "AVAILABLE" && (
        <div className="border-t border-slate-100 pt-3">
          {showMaint ? (
            <form action={mtAction} className="space-y-2">
              <input type="hidden" name="assetId" value={asset.id} />
              <input name="note" placeholder="What is wrong? (optional)" className={inputCls} />
              <div className="flex gap-2">
                <SubmitButton variant="secondary">Send to maintenance</SubmitButton>
                <button type="button" onClick={() => setShowMaint(false)} className="btn text-slate-500 hover:bg-slate-50">
                  Cancel
                </button>
              </div>
            </form>
          ) : (
            <button onClick={() => setShowMaint(true)} className="text-sm text-slate-500 hover:text-slate-900">
              Send to maintenance…
            </button>
          )}
        </div>
      )}
    </div>
  );
}
