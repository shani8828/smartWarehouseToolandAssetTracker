"use client";

import { useEffect, useRef, useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import JsBarcode from "jsbarcode";

export type LabelItem = { assetTag: string; name: string; lab?: string };

function Barcode({ value }: { value: string }) {
  const ref = useRef<SVGSVGElement>(null);
  useEffect(() => {
    if (ref.current) {
      JsBarcode(ref.current, value, { format: "CODE128", height: 42, width: 1.6, fontSize: 12, margin: 0, displayValue: true });
    }
  }, [value]);
  return <svg ref={ref} aria-label={`Code 128 barcode ${value}`} />;
}

function Label({ item }: { item: LabelItem }) {
  return (
    <div className="flex break-inside-avoid items-center gap-4 rounded-md border border-slate-300 bg-white p-3">
      <QRCodeSVG value={item.assetTag} size={96} level="M" marginSize={0} />
      <div className="min-w-0 flex-1">
        <p className="font-mono text-sm font-bold">{item.assetTag}</p>
        <p className="truncate text-xs text-slate-600">{item.name}</p>
        {item.lab && <p className="truncate text-xs text-slate-500">{item.lab}</p>}
        <div className="mt-2">
          <Barcode value={item.assetTag} />
        </div>
      </div>
    </div>
  );
}

export default function LabelSheet({ items }: { items: LabelItem[] }) {
  const [custom, setCustom] = useState("");
  const shown = custom.trim() ? [{ assetTag: custom.trim().toUpperCase(), name: "Custom test label" }, ...items] : items;

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-end gap-3 print:hidden">
        <label className="text-sm">
          <span className="mb-1 block text-slate-600">Test label for any text</span>
          <input
            value={custom}
            onChange={(e) => setCustom(e.target.value)}
            placeholder="e.g. ISE-MM-999"
            className="w-56 rounded-md border border-slate-300 px-3 py-2 font-mono text-sm"
          />
        </label>
        <button onClick={() => window.print()} className="btn-primary">Print labels</button>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 print:grid-cols-2">
        {shown.map((item) => (
          <Label key={item.assetTag + item.name} item={item} />
        ))}
      </div>
    </div>
  );
}
