"use client";

import { useState, useTransition } from "react";
import { LoaderCircle, Play } from "lucide-react";
import { runAuditAction } from "@/app/actions/admin";
import type { ActionState } from "@/app/actions/custody";
import { FormMessage } from "./forms";

export default function AuditButton() {
  const [pending, start] = useTransition();
  const [state, setState] = useState<ActionState>({});
  return (
    <div className="flex flex-col items-end gap-2">
      <button onClick={() => start(async () => setState(await runAuditAction()))} disabled={pending} className="btn-secondary">
        {pending ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
        Run overdue audit
      </button>
      <FormMessage state={state} />
    </div>
  );
}
