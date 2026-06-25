import { describe, it, expect } from "vitest";

const BASE_URL = process.env.TEST_SERVER_URL ?? "http://localhost:4322";

describe("Secret leak — error responses contain no secrets", () => {
  it("GET /api/exercises/next-for-type (no cookie) → 401 body contains no secrets", async () => {
    const response = await fetch(`${BASE_URL}/api/exercises/next-for-type?type=animated_pacer`);
    expect(response.status).toBe(401);

    const body = await response.text();
    const anonKey = process.env.SUPABASE_TEST_ANON_KEY ?? "";
    const supabaseUrl = process.env.SUPABASE_TEST_URL ?? "";

    expect(body).not.toContain(anonKey);
    expect(body).not.toContain(supabaseUrl);
    expect(body).not.toContain("Bearer ");
    expect(body).not.toMatch(/Error:/);
    expect(body).not.toMatch(/at \w+ \(/); // stack trace pattern
  });

  it("GET /api/exercises/00000000-0000-0000-0000-000000000000 → no secrets in body", async () => {
    const response = await fetch(`${BASE_URL}/api/exercises/00000000-0000-0000-0000-000000000000`);
    // Route may return 404 (exercise not found) or 500 (misconfigured server)
    expect([404, 200]).toContain(response.status);

    const body = await response.text();
    const anonKey = process.env.SUPABASE_TEST_ANON_KEY ?? "";
    const supabaseUrl = process.env.SUPABASE_TEST_URL ?? "";

    expect(body).not.toContain(anonKey);
    expect(body).not.toContain(supabaseUrl);
    expect(body).not.toContain("Bearer ");
  }, 15_000);
});
