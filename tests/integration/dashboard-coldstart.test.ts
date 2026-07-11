import { describe, it, beforeAll, afterAll, expect } from "vitest";
import { adminClient } from "../helpers/supabase";
import { createFixtureUser, deleteFixtureUsers } from "../helpers/fixtures";

const BASE_URL = process.env.TEST_SERVER_URL ?? "http://localhost:4322";

describe("GET /dashboard — cold-start (0 completions)", () => {
  const admin = adminClient();
  let userId = "";
  let cookieHeader = "";

  beforeAll(async () => {
    try {
      const user = await createFixtureUser("coldstart@test.local", "pw-coldstart-123!");
      userId = user.id;

      const signinForm = new FormData();
      signinForm.append("email", "coldstart@test.local");
      signinForm.append("password", "pw-coldstart-123!");

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

  it("renders dashboard with exercise cards for a brand-new user", async () => {
    // No completions inserted — user stays at 0 throughout
    const response = await fetch(`${BASE_URL}/dashboard`, {
      redirect: "manual",
      headers: { Cookie: cookieHeader, Origin: BASE_URL },
    });

    expect(response.status).toBe(200);
    const html = await response.text();
    expect(html).toContain("/exercise/"); // at least one exercise card link
    expect(html).not.toContain("Error:"); // no unhandled error in body
    expect(html).not.toContain("at Object."); // no stack trace in body
  });
});
