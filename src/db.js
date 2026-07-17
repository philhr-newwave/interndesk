import { createClient } from "@supabase/supabase-js";

/**
 * Shared database layer (Supabase).
 * The anon key is a publishable client key by design; access is governed by
 * row-level-security policies on the Supabase side.
 */
const SUPABASE_URL = "https://wtgpqqesfsxetaazwput.supabase.co";
const SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Ind0Z3BxcWVzZnN4ZXRhYXp3cHV0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODQyMjg5NTAsImV4cCI6MjA5OTgwNDk1MH0.dMuGUi6lZTmkuGuSHxjDrH8UafAI13ajqgUoY7VXDAU";

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

/* Leaves use fromDate/toDate columns; the app uses from/to. Map both ways. */
const leaveFromRow = (r) => ({ ...r, from: r.fromDate, to: r.toDate });
const leaveToRow = ({ from, to, ...rest }) => ({ ...rest, fromDate: from, toDate: to });

export const db = {
  async fetchAll() {
    const tables = ["users", "attendance", "leaves", "coas", "concerns"];
    const results = await Promise.all(tables.map((t) => supabase.from(t).select("*")));
    for (const r of results) if (r.error) throw r.error;
    const [users, attendance, leaves, coas, concerns] = results.map((r) => r.data);
    return { users, attendance, leaves: leaves.map(leaveFromRow), coas, concerns };
  },

  async insert(table, row) {
    const payload = table === "leaves" ? leaveToRow(row) : row;
    const { error } = await supabase.from(table).insert(payload);
    if (error) throw error;
  },

  async update(table, id, patch) {
    const payload = { ...patch };
    if (table === "leaves") {
      if ("from" in payload) { payload.fromDate = payload.from; delete payload.from; }
      if ("to" in payload) { payload.toDate = payload.to; delete payload.to; }
    }
    const { error } = await supabase.from(table).update(payload).eq("id", id);
    if (error) throw error;
  },
};

/* ------------------------- password hashing ------------------------ */

export function genSalt() {
  const bytes = crypto.getRandomValues(new Uint8Array(12));
  return [...bytes].map((b) => b.toString(16).padStart(2, "0")).join("");
}

export async function hashPw(salt, password) {
  const data = new TextEncoder().encode(salt + password);
  const buf = await crypto.subtle.digest("SHA-256", data);
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

export async function verifyPw(user, password) {
  if (!user.pwSalt || !user.pwHash) return false;
  return (await hashPw(user.pwSalt, password)) === user.pwHash;
}
