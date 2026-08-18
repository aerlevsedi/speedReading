import { describe, it, beforeAll, afterAll, expect } from "vitest";
import { adminClient } from "../helpers/supabase";
import {
  createFixtureUser,
  deleteFixtureUsers,
  FOCUS_SPRINT_DATASET1_ID,
  FOCUS_SPRINT_DATASET2_ID,
} from "../helpers/fixtures";
import type { SupabaseClient } from "@supabase/supabase-js";

const BASE_URL = process.env.TEST_SERVER_URL ?? "http://localhost:4322";

const RESULTS_HEADING = "Progress Over Time";
const RESULTS_PLACEHOLDER = "Complete another Focus Sprint to see your reading speed trend";
const DASHBOARD_HEADING = "Reading Speed Trend";
const DASHBOARD_PLACEHOLDER = "Complete two or more Focus Sprint sessions to see your reading speed trend";

async function signInCookies(email: string, password: string): Promise<string> {
  const form = new FormData();
  form.append("email", email);
  form.append("password", password);

  const response = await fetch(`${BASE_URL}/api/auth/signin`, {
    method: "POST",
    body: form,
    redirect: "manual",
    headers: { Origin: BASE_URL },
  });

  const setCookieHeaders: string[] =
    typeof response.headers.getSetCookie === "function"
      ? response.headers.getSetCookie()
      : ([response.headers.get("set-cookie")].filter(Boolean) as string[]);

  return setCookieHeaders.map((h) => h.split(";")[0]).join("; ");
}

async function insertFocusSprintCompletion(
  admin: SupabaseClient,
  userId: string,
  exerciseId: string,
  wpm: number,
  completedAt: string,
): Promise<string> {
  const result = await admin
    .from("exercise_completions")
    .insert({
      user_id: userId,
      exercise_id: exerciseId,
      duration_seconds: 120,
      errors: 0,
      type_data: { wpm },
      completed_at: completedAt,
    })
    .select("id")
    .single();

  if (result.error) throw new Error(`insertFocusSprintCompletion: ${result.error.message}`);
  return result.data.id as string;
}

describe("Progress chart (S-05) — results page + dashboard", () => {
  const admin = adminClient();
  const createdIds: string[] = [];

  // User with two Focus Sprint sessions → chart is shown
  let twoUserId = "";
  let twoCookies = "";
  let twoLatestCompletionId = "";

  // User with a single Focus Sprint session → placeholder is shown
  let oneUserId = "";
  let oneCookies = "";
  let oneCompletionId = "";

  beforeAll(async () => {
    try {
      const suffix = Date.now();

      const twoEmail = `progress-two-${suffix}@test.local`;
      const twoPw = "pw-progress-two-123!";
      const twoUser = await createFixtureUser(twoEmail, twoPw);
      twoUserId = twoUser.id;
      createdIds.push(twoUserId);
      await insertFocusSprintCompletion(
        admin,
        twoUserId,
        FOCUS_SPRINT_DATASET1_ID,
        180,
        new Date(suffix - 60_000).toISOString(),
      );
      twoLatestCompletionId = await insertFocusSprintCompletion(
        admin,
        twoUserId,
        FOCUS_SPRINT_DATASET2_ID,
        220,
        new Date(suffix).toISOString(),
      );
      twoCookies = await signInCookies(twoEmail, twoPw);

      const oneEmail = `progress-one-${suffix}@test.local`;
      const onePw = "pw-progress-one-123!";
      const oneUser = await createFixtureUser(oneEmail, onePw);
      oneUserId = oneUser.id;
      createdIds.push(oneUserId);
      oneCompletionId = await insertFocusSprintCompletion(
        admin,
        oneUserId,
        FOCUS_SPRINT_DATASET1_ID,
        200,
        new Date(suffix).toISOString(),
      );
      oneCookies = await signInCookies(oneEmail, onePw);
    } catch (err) {
      await deleteFixtureUsers(admin, createdIds);
      throw err;
    }
  });

  afterAll(async () => {
    await deleteFixtureUsers(admin, createdIds);
  });

  it("shows the progress chart on Focus Sprint results with >= 2 sessions", async () => {
    const response = await fetch(`${BASE_URL}/results/${twoLatestCompletionId}`, {
      headers: { Cookie: twoCookies, Origin: BASE_URL },
    });
    expect(response.status).toBe(200);
    const html = await response.text();

    expect(html).toContain(RESULTS_HEADING);
    expect(html).not.toContain(RESULTS_PLACEHOLDER);
    // client:only island for the chart is emitted server-side
    expect(html).toContain("ProgressChart");
    expect(html).not.toContain("at Object."); // no stack trace
  });

  it("shows the placeholder on Focus Sprint results with a single session", async () => {
    const response = await fetch(`${BASE_URL}/results/${oneCompletionId}`, {
      headers: { Cookie: oneCookies, Origin: BASE_URL },
    });
    expect(response.status).toBe(200);
    const html = await response.text();

    expect(html).toContain(RESULTS_PLACEHOLDER);
    expect(html).not.toContain("at Object.");
  });

  it("shows the compact trend on the dashboard with >= 2 sessions", async () => {
    const response = await fetch(`${BASE_URL}/dashboard`, {
      headers: { Cookie: twoCookies, Origin: BASE_URL },
    });
    expect(response.status).toBe(200);
    const html = await response.text();

    expect(html).toContain(DASHBOARD_HEADING);
    expect(html).not.toContain(DASHBOARD_PLACEHOLDER);
    expect(html).toContain("ProgressChart");
    expect(html).not.toContain("at Object.");
  });

  it("shows the dashboard placeholder with fewer than 2 sessions", async () => {
    const response = await fetch(`${BASE_URL}/dashboard`, {
      headers: { Cookie: oneCookies, Origin: BASE_URL },
    });
    expect(response.status).toBe(200);
    const html = await response.text();

    expect(html).toContain(DASHBOARD_PLACEHOLDER);
    expect(html).not.toContain("at Object.");
  });
});
