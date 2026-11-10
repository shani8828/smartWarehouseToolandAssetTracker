"use client";

import { useEffect, useState } from "react";
import { useFormStatus } from "react-dom";
import { CircleAlert, CircleCheck, LoaderCircle } from "lucide-react";
import type { ActionState } from "@/app/actions/custody";

export function SubmitButton({
  children,
  variant = "primary",
  className = "",
  disabled = false,
}: {
  children: React.ReactNode;
  variant?: "primary" | "secondary" | "danger";
  className?: string;
  disabled?: boolean;
}) {
  const { pending } = useFormStatus();
  const v = variant === "primary" ? "btn-primary" : variant === "danger" ? "btn-danger" : "btn-secondary";
  return (
    <button type="submit" disabled={pending || disabled} className={`${v} ${className}`}>
      {pending && <LoaderCircle className="h-4 w-4 animate-spin" />}
      {children}
    </button>
  );
}

// Inline result banner for a form action; fades out success messages.
export function FormMessage({ state }: { state: ActionState }) {
  const [visible, setVisible] = useState(true);
  useEffect(() => {
    setVisible(true);
    if (state.ok) {
      const t = setTimeout(() => setVisible(false), 6000);
      return () => clearTimeout(t);
    }
  }, [state.at, state.ok]);
  if (!visible || (!state.error && !state.message)) return null;
  return state.error ? (
    <p role="alert" className="animate-fade-in flex items-start gap-2 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
      <CircleAlert className="mt-0.5 h-4 w-4 shrink-0" /> {state.error}
    </p>
  ) : (
    <p role="status" className="animate-fade-in flex items-start gap-2 rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
      <CircleCheck className="mt-0.5 h-4 w-4 shrink-0" /> {state.message}
    </p>
  );
}
