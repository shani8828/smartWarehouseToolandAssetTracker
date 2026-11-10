"use server";

import { runSearch, type SearchResult } from "@/lib/search";
import { requireSession } from "@/lib/session";

export async function searchAction(query: string): Promise<SearchResult | { error: string }> {
  await requireSession();
  const q = query.trim().slice(0, 300);
  if (!q) return { error: "Type a question" };
  try {
    return await runSearch(q);
  } catch (err) {
    console.error(err);
    return { error: "Search failed. Please try again." };
  }
}
