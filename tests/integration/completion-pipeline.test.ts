import { describe, it, beforeAll, afterAll, expect, assert } from "vitest";
import { adminClient, authClient } from "../helpers/supabase";
import { createFixtureUser, deleteFixtureUsers, SEEDED_EXERCISE_ID } from "../helpers/fixtures";
import type { Completion } from "@/types";

const BASE_URL = process.env.TEST_SERVER_URL ?? "http://localhost:4322";

// Seeded exercise word count = 262; at duration_seconds=60: wpm = Math.round(262 / (60/60)) = 262
const EXPECTED_WPM = 262;

describe("POST /api/exercises/complete", () => {
  const admin = adminClient();
  let userId = "";
  let userJwt = "";
  let cookieHeader = "";

  beforeAll(async () => {
    const createdIds: string[] = [];
    try {
      const user = await createFixtureUser("completion-pipeline@test.local", "pw-pipeline-123!");
      createdIds.push(user.id);
      userId = user.id;
      userJwt = user.jwt;

      // Sign in via the real Astro HTTP endpoint to collect session cookies.
      // @supabase/ssr writes cookies that the middleware reads — Authorization header is not enough.
      const signinForm = new FormData();
      signinForm.append("email", "completion-pipeline@test.local");
      signinForm.append("password", "pw-pipeline-123!");

      const signinResponse = await fetch(`${BASE_URL}/api/auth/signin`, {
        method: "POST",
        body: signinForm,
        redirect: "manual",
        headers: { Origin: BASE_URL },
      });

      // Collect all Set-Cookie headers (may be chunked by @supabase/ssr)
      const setCookieHeaders: string[] =
        // Node 18+ returns all Set-Cookie values as an array
        (
          typeof signinResponse.headers.getSetCookie === "function"
            ? signinResponse.headers.getSetCookie()
            : [signinResponse.headers.get("set-cookie")].filter(Boolean)
        ) as string[];

      // Strip cookie attributes (Path=, Expires=, HttpOnly, SameSite=, etc.) — keep only name=value
      cookieHeader = setCookieHeaders.map((h) => h.split(";")[0]).join("; ");
    } catch (err) {
      await deleteFixtureUsers(admin, createdIds);
      throw err;
    }
  });

  afterAll(async () => {
    await deleteFixtureUsers(admin, [userId].filter(Boolean));
  });

  it("inserts a completion row and redirects to /results/{id}", async () => {
    const form = new FormData();
    form.append("exercise_id", SEEDED_EXERCISE_ID);
    form.append("duration_seconds", "60");
    form.append("errors", "0");

    const response = await fetch(`${BASE_URL}/api/exercises/complete`, {
      method: "POST",
      body: form,
      redirect: "manual",
      headers: { Cookie: cookieHeader, Origin: BASE_URL },
    });

    expect(response.status).toBe(302);
    const location = response.headers.get("location") ?? "";
    expect(location).toMatch(/^\/results\//);

    // Extract the completion ID from the redirect URL
    const completionId = location.split("/").pop() ?? "";
    expect(completionId).toBeTruthy();

    // Verify the DB row landed — adminClient bypasses RLS for certainty
    const dbResult = await admin.from("exercise_completions").select("*").eq("id", completionId).single<Completion>();

    expect(dbResult.error).toBeNull();
    assert(dbResult.data !== null);
    expect(dbResult.data.user_id).toBe(userId);
    expect(dbResult.data.duration_seconds).toBe(60);
    expect(dbResult.data.type_data.wpm).toBe(EXPECTED_WPM);

    // Read-back via authClient — proves the SELECT RLS policy allows the owner to read their own row
    const rlsResult = await authClient(userJwt).from("exercise_completions").select("id").eq("id", completionId);

    expect(rlsResult.error).toBeNull();
    expect(rlsResult.data).toHaveLength(1);
  });

  it("redirects to /dashboard?error= when exercise_id FK is invalid", async () => {
    const form = new FormData();
    form.append("exercise_id", "00000000-0000-0000-0000-000000000000");
    form.append("duration_seconds", "60");
    form.append("errors", "0");

    const response = await fetch(`${BASE_URL}/api/exercises/complete`, {
      method: "POST",
      body: form,
      redirect: "manual",
      headers: { Cookie: cookieHeader, Origin: BASE_URL },
    });

    expect(response.status).toBe(302);
    const location = response.headers.get("location") ?? "";
    expect(location).toContain("/dashboard");
    expect(location).toContain("error=");
  });

  it("redirects to /auth/signin when no session cookie is present", async () => {
    const form = new FormData();
    form.append("exercise_id", SEEDED_EXERCISE_ID);
    form.append("duration_seconds", "60");
    form.append("errors", "0");

    const response = await fetch(`${BASE_URL}/api/exercises/complete`, {
      method: "POST",
      body: form,
      redirect: "manual",
      // No Cookie header — unauthenticated request; Origin needed to pass CSRF check
      headers: { Origin: BASE_URL },
    });

    expect(response.status).toBe(302);
    const location = response.headers.get("location") ?? "";
    expect(location).toMatch(/^\/auth\/signin/);
  });
});
