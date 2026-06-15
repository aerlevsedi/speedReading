import { createClient } from "@supabase/supabase-js";

function getEnv(key: string): string {
  const value = process.env[key];
  if (!value) throw new Error(`Missing env var: ${key}`);
  return value;
}

const testUrl = process.env["SUPABASE_TEST_URL"] ?? "";
if (testUrl && !testUrl.includes("127.0.0.1") && !testUrl.includes("localhost")) {
  throw new Error(
    `SUPABASE_TEST_URL must point to a local instance (127.0.0.1 or localhost). Got: ${testUrl}. Tests must not run against a remote Supabase project.`,
  );
}

export function anonClient() {
  return createClient(getEnv("SUPABASE_TEST_URL"), getEnv("SUPABASE_TEST_ANON_KEY"), {
    auth: { autoRefreshToken: false, persistSession: false },
  });
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
