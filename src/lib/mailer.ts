import "server-only";
import nodemailer, { type Transporter } from "nodemailer";

export type MailResult = { ok: true; transport: "smtp" | "preview" } | { ok: false; transport: "smtp"; error: string };

let transporter: Transporter | null = null;
let mode: "smtp" | "preview" = "preview";

// SMTP when configured, otherwise a JSON transport: the email is fully built
// but only stored on the alert and shown on the Alerts page.
function getTransport() {
  if (transporter) return transporter;
  const host = process.env.SMTP_HOST;
  if (host) {
    mode = "smtp";
    transporter = nodemailer.createTransport({
      host,
      port: Number(process.env.SMTP_PORT ?? 587),
      secure: Number(process.env.SMTP_PORT) === 465,
      auth: process.env.SMTP_USER ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS } : undefined,
    });
  } else {
    mode = "preview";
    transporter = nodemailer.createTransport({ jsonTransport: true });
  }
  return transporter;
}

export async function sendMail(to: string, subject: string, text: string): Promise<MailResult> {
  const t = getTransport();
  try {
    await t.sendMail({ from: process.env.MAIL_FROM ?? "Smart Warehouse <no-reply@example.com>", to, subject, text });
    return { ok: true, transport: mode };
  } catch (err) {
    return { ok: false, transport: "smtp", error: err instanceof Error ? err.message : String(err) };
  }
}
