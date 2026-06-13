import { createClient } from "@supabase/supabase-js";

function getEnv(key: string): string {
  const value = process.env[key];
  if (!value) throw new Error(`Missing env var: ${key}`);
  return value;
}

export function adminClient() {
  return createClient(getEnv("SUPABASE_TEST_URL"), getEnv("SUPABASE_TEST_SERVICE_ROLE_KEY"), {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

export function authClient(jwt: string) {
  return createClient(getEnv("SUPABASE_TEST_URL"), getEnv("SUPABASE_TEST_ANON_KEY"), {
    auth: { autoRefreshToken: false, persistSession: false },
    global: { headers: { Authorization: `Bearer ${jwt}` } },
  });
}
