import { createClient } from "@supabase/supabase-js";

/**
 * Cliente Supabase server-side com a service_role key.
 * NUNCA importe isto em um Client Component — a chave ignora RLS.
 */
export function supabaseAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  );
}
