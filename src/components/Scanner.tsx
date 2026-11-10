"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { Html5Qrcode } from "html5-qrcode";
import { Camera, CameraOff, ImageUp, LoaderCircle } from "lucide-react";

const READER_ID = "qr-reader";
const DUPLICATE_WINDOW_MS = 2500; // ignore the same code while it stays in frame

type Cam = { id: string; label: string };
export type ScanSource = "camera" | "image";

// Short confirmation tone + vibration so the user knows a scan registered.
function confirmScan() {
  try {
    const ctx = new AudioContext();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.frequency.value = 880;
    gain.gain.value = 0.08;
    osc.connect(gain).connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.12);
    osc.onended = () => ctx.close();
  } catch {
    // audio not available
  }
  navigator.vibrate?.(80);
}

// In-browser QR / 1D barcode decoder on the device camera (html5-qrcode / ZXing).
export default function Scanner({ onScan }: { onScan: (text: string, format: string, source: ScanSource) => void }) {
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const lastRef = useRef<{ text: string; at: number } | null>(null);
  const onScanRef = useRef(onScan);
  onScanRef.current = onScan;

  const [cameras, setCameras] = useState<Cam[]>([]);
  const [cameraId, setCameraId] = useState("");
  const [running, setRunning] = useState(false);
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const record = useCallback((text: string, format: string, source: ScanSource) => {
    const now = Date.now();
    const last = lastRef.current;
    if (source === "camera" && last && last.text === text && now - last.at < DUPLICATE_WINDOW_MS) return;
    lastRef.current = { text, at: now };
    confirmScan();
    onScanRef.current(text, format, source);
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { Html5Qrcode, Html5QrcodeSupportedFormats: F } = await import("html5-qrcode");
      if (cancelled) return;
      scannerRef.current = new Html5Qrcode(READER_ID, {
        verbose: false,
        formatsToSupport: [F.QR_CODE, F.CODE_128, F.CODE_39, F.EAN_13, F.EAN_8, F.UPC_A, F.UPC_E, F.ITF, F.DATA_MATRIX],
        // Native BarcodeDetector when the browser has it (fast on Android Chrome)
        experimentalFeatures: { useBarCodeDetectorIfSupported: true },
      });
    })();
    return () => {
      cancelled = true;
      const s = scannerRef.current;
      if (s?.isScanning) s.stop().catch(() => {});
    };
  }, []);

  async function start() {
    const s = scannerRef.current;
    if (!s) return;
    setError(null);
    setStarting(true);
    try {
      // Ask for permission and list cameras on first start, preferring the back camera
      let id = cameraId;
      if (!cameras.length) {
        const { Html5Qrcode } = await import("html5-qrcode");
        const cams = await Html5Qrcode.getCameras();
        setCameras(cams);
        id = (cams.find((c) => /back|rear|environment/i.test(c.label)) ?? cams[0])?.id ?? "";
        setCameraId(id);
      }
      await s.start(
        id ? { deviceId: { exact: id } } : { facingMode: "environment" },
        { fps: 12, qrbox: (w, h) => ({ width: Math.floor(w * 0.8), height: Math.floor(Math.min(h * 0.6, w * 0.8)) }) },
        (text, result) => record(text, result.result.format?.formatName ?? "UNKNOWN", "camera"),
        () => {}, // "nothing found in this frame" is expected; ignore
      );
      setRunning(true);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setError(/permission|notallowed|denied/i.test(msg) ? "Camera permission was denied. Allow it in the browser, or scan from an image." : msg || "Could not start the camera.");
    } finally {
      setStarting(false);
    }
  }

  async function stop() {
    const s = scannerRef.current;
    if (s?.isScanning) await s.stop();
    setRunning(false);
  }

  async function scanImage(file: File) {
    const s = scannerRef.current;
    if (!s) return;
    if (s.isScanning) await stop();
    setError(null);
    try {
      const r = await s.scanFileV2(file, false);
      record(r.decodedText, r.result.format?.formatName ?? "UNKNOWN", "image");
    } catch {
      setError("No QR code or barcode found in that image.");
    }
  }

  return (
    <div>
      <div className="relative aspect-[4/3] overflow-hidden rounded-2xl bg-navy-950 sm:aspect-video">
        <div id={READER_ID} className="h-full w-full [&_video]:h-full [&_video]:w-full [&_video]:object-cover" />
        {!running && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-slate-400">
            <Camera className="h-8 w-8" />
            <span className="text-sm">Camera is off</span>
          </div>
        )}
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        {running ? (
          <button onClick={stop} className="btn-secondary">
            <CameraOff className="h-4 w-4" /> Stop camera
          </button>
        ) : (
          <button onClick={start} disabled={starting} className="btn-primary">
            {starting ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Camera className="h-4 w-4" />}
            Start camera
          </button>
        )}
        {cameras.length > 1 && (
          <select
            value={cameraId}
            onChange={(e) => setCameraId(e.target.value)}
            disabled={running}
            className="rounded-lg border border-slate-300 bg-white px-2 py-2 text-sm"
            aria-label="Camera"
          >
            {cameras.map((c) => (
              <option key={c.id} value={c.id}>
                {c.label || `Camera ${c.id.slice(0, 6)}`}
              </option>
            ))}
          </select>
        )}
        <label className="btn-secondary cursor-pointer">
          <ImageUp className="h-4 w-4" /> From image
          <input
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void scanImage(f);
              e.target.value = "";
            }}
          />
        </label>
      </div>
      {error && <p className="mt-2 text-sm text-red-700">{error}</p>}
    </div>
  );
}
