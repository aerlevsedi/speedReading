import { describe, it, beforeAll, afterAll, beforeEach, expect } from "vitest";
import { adminClient } from "../helpers/supabase";
import {
  createFixtureUser,
  deleteFixtureUsers,
  ANIMATED_PACER_DATASET1_ID,
  ANIMATED_PACER_DATASET2_ID,
} from "../helpers/fixtures";
import type { Exercise } from "@/types";

const BASE_URL = process.env.TEST_SERVER_URL ?? "http://localhost:4322";

describe("GET /api/exercises/next-for-type — dataset alternation", () => {
  const admin = adminClient();
  let userId = "";
  let cookieHeader = "";

  beforeAll(async () => {
    try {
      const user = await createFixtureUser("alternation@test.local", "pw-alternation-123!");
      userId = user.id;

      const signinForm = new FormData();
      signinForm.append("email", "alternation@test.local");
      signinForm.append("password", "pw-alternation-123!");

      const signinResponse = await fetch(`${BASE_URL}/api/auth/signin`, {
        method: "POST",
        body: signinForm,
        redirect: "manual",
        headers: { Origin: BASE_URL },
      });

      const setCookieHeaders: string[] =
        typeof signinResponse.headers.getSetCookie === "function"
          ? signinResponse.headers.getSetCookie()
          : ([signinResponse.headers.get("set-cookie")].filter(Boolean) as string[]);

      cookieHeader = setCookieHeaders.map((h) => h.split(";")[0]).join("; ");
    } catch (err) {
      await deleteFixtureUsers(admin, [userId].filter(Boolean));
      throw err;
    }
  });

  afterAll(async () => {
    await deleteFixtureUsers(admin, [userId].filter(Boolean));
  });

  beforeEach(async () => {
    // Clear all completions for this fixture user so each it() starts from a known state
    await admin.from("exercise_completions").delete().eq("user_id", userId);
  });

  it("returns dataset_1 when user has no completions for animated_pacer", async () => {
    const response = await fetch(`${BASE_URL}/api/exercises/next-for-type?type=animated_pacer`, {
      redirect: "manual",
      headers: { Cookie: cookieHeader, Origin: BASE_URL },
    });

    expect(response.status).toBe(200);
    const body = (await response.json()) as Exercise;
    expect(body.dataset_id).toBe("dataset_1");
  });

  it("returns dataset_2 after a dataset_1 completion for animated_pacer", async () => {
    await admin.from("exercise_completions").insert({
      user_id: userId,
      exercise_id: ANIMATED_PACER_DATASET1_ID,
      duration_seconds: 60,
      errors: 0,
      type_data: { wpm: 200 },
    });

    const response = await fetch(`${BASE_URL}/api/exercises/next-for-type?type=animated_pacer`, {
      redirect: "manual",
      headers: { Cookie: cookieHeader, Origin: BASE_URL },
    });

    expect(response.status).toBe(200);
    const body = (await response.json()) as Exercise;
    expect(body.dataset_id).toBe("dataset_2");
  });

  it("returns dataset_1 after a dataset_2 completion for animated_pacer", async () => {
    await admin.from("exercise_completions").insert({
      user_id: userId,
      exercise_id: ANIMATED_PACER_DATASET2_ID,
      duration_seconds: 60,
      errors: 0,
      type_data: { wpm: 200 },
    });

    const response = await fetch(`${BASE_URL}/api/exercises/next-for-type?type=animated_pacer`, {
      redirect: "manual",
      headers: { Cookie: cookieHeader, Origin: BASE_URL },
    });

    expect(response.status).toBe(200);
    const body = (await response.json()) as Exercise;
    expect(body.dataset_id).toBe("dataset_1");
  });

  it("animated_pacer completions do not affect focus_sprint result", async () => {
    // Insert a completion for animated_pacer dataset_1 — should NOT influence focus_sprint
    await admin.from("exercise_completions").insert({
      user_id: userId,
      exercise_id: ANIMATED_PACER_DATASET1_ID,
      duration_seconds: 60,
      errors: 0,
      type_data: { wpm: 200 },
    });

    const response = await fetch(`${BASE_URL}/api/exercises/next-for-type?type=focus_sprint`, {
      redirect: "manual",
      headers: { Cookie: cookieHeader, Origin: BASE_URL },
    });

    expect(response.status).toBe(200);
    const body = (await response.json()) as Exercise;
    // focus_sprint has no completions → cold-start default → dataset_1
    expect(body.dataset_id).toBe("dataset_1");
  });
});
