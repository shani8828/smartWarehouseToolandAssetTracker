import "server-only";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";
import { SESSION_COOKIE, verifySession, type Session } from "./auth";
import type { Role } from "./constants";

export const getSession = cache(async (): Promise<Session | null> => {
  return verifySession(cookies().get(SESSION_COOKIE)?.value);
});

export async function requireSession(): Promise<Session> {
  const s = await getSession();
  if (!s) redirect("/login");
  return s;
}

export async function requireRole(...roles: Role[]): Promise<Session> {
  const s = await requireSession();
  if (!roles.includes(s.role)) redirect("/");
  return s;
}

export const isStaff = (s: Session) => s.role === "ADMIN" || s.role === "LAB_STAFF";
