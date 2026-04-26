import { supabase } from "@/integrations/supabase/client";

/**
 * Returns headers attaching the current Supabase access token so that
 * server functions guarded by `requireSupabaseAuth` can verify the caller.
 *
 * Usage:
 *   await myFn({ data: {...}, headers: await authHeaders() })
 */
export async function authHeaders(): Promise<HeadersInit> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new Error("Not signed in");
  return { Authorization: `Bearer ${token}` };
}
