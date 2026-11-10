"use server";

import bcrypt from "bcryptjs";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { SESSION_COOKIE, SESSION_MAX_AGE, signSession } from "@/lib/auth";
import type { Role } from "@/lib/constants";
import { connectDB } from "@/lib/db";
import { User } from "@/models";

const loginInput = z.object({ email: z.string().trim().toLowerCase().email(), password: z.string().min(1) });

export type LoginState = { error?: string };

export async function login(_prev: LoginState, form: FormData): Promise<LoginState> {
  const parsed = loginInput.safeParse({ email: form.get("email"), password: form.get("password") });
  if (!parsed.success) return { error: "Enter your email and password" };

  let token: string;
  try {
    await connectDB();
    const user = await User.findOne({ email: parsed.data.email, isActive: true }).select("+passwordHash").lean();
    const ok = user?.passwordHash && (await bcrypt.compare(parsed.data.password, user.passwordHash));
    if (!user || !ok) return { error: "Incorrect email or password" };

    token = await signSession({
      sub: String(user._id),
      name: user.name,
      email: user.email,
      role: user.role as Role,
      department: user.department,
    });
  } catch (err) {
    // Show a readable message instead of crashing the page, and keep the
    // details in the server logs (e.g. Vercel > Logs).
    console.error("[login] sign-in failed:", err);
    const msg = err instanceof Error ? err.message : String(err);
    if (/SESSION_SECRET/.test(msg)) return { error: "Server is misconfigured: SESSION_SECRET is not set." };
    if (/MONGODB_URI/.test(msg)) return { error: "Server is misconfigured: MONGODB_URI is not set." };
    return { error: "Sign-in is unavailable: the server could not reach the database. Please try again shortly." };
  }
  cookies().set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_MAX_AGE,
  });
  const next = String(form.get("next") ?? "");
  redirect(next.startsWith("/") && !next.startsWith("//") ? next : "/");
}

export async function logout() {
  cookies().delete(SESSION_COOKIE);
  redirect("/login");
}
