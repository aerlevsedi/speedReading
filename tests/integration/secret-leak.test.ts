import { describe, it, expect } from "vitest";

const BASE_URL = process.env.TEST_SERVER_URL ?? "http://localhost:4322";

const anonKey = process.env.SUPABASE_TEST_ANON_KEY;
const supabaseUrl = process.env.SUPABASE_TEST_URL;
if (!anonKey) throw new Error("SUPABASE_TEST_ANON_KEY must be set in .env.test for secret-leak tests");
if (!supabaseUrl) throw new Error("SUPABASE_TEST_URL must be set in .env.test for secret-leak tests");

describe("Secret leak — error responses contain no secrets", () => {
  it("GET /api/exercises/next-for-type (no cookie) → 401 body contains no secrets", async () => {
    const response = await fetch(`${BASE_URL}/api/exercises/next-for-type?type=animated_pacer`);
    expect(response.status).toBe(401);

    const body = await response.text();

    expect(body).not.toContain(anonKey);
    expect(body).not.toContain(supabaseUrl);
    expect(body).not.toContain("Bearer ");
    expect(body).not.toMatch(/Error:/);
    expect(body).not.toMatch(/at \w+ \(/); // stack trace pattern
  });

  it("GET /api/exercises/00000000-0000-0000-0000-000000000000 → no secrets in body", async () => {
    const response = await fetch(`${BASE_URL}/api/exercises/00000000-0000-0000-0000-000000000000`);
    expect(
      response.status,
      "Expected 404 (exercise not found) — if 500, check that the Astro dev server has SUPABASE_URL and SUPABASE_KEY set in .dev.vars",
    ).toBe(404);

    const body = await response.text();

    expect(body).not.toContain(anonKey);
    expect(body).not.toContain(supabaseUrl);
    expect(body).not.toContain("Bearer ");
  }, 15_000);
});
