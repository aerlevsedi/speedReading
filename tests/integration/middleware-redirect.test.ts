import { describe, it, expect } from "vitest";

const BASE_URL = process.env.TEST_SERVER_URL ?? "http://localhost:4322";

describe("Middleware redirect — unauthenticated requests", () => {
  it("GET /dashboard → 302 to /auth/signin", async () => {
    const response = await fetch(`${BASE_URL}/dashboard`, {
      redirect: "manual",
    });

    expect(response.status).toBe(302);
    expect(response.headers.get("location")).toMatch(/^\/auth\/signin/);
  });

  it("GET /exercise/test-id → 302 to /auth/signin", async () => {
    const response = await fetch(`${BASE_URL}/exercise/test-id`, {
      redirect: "manual",
    });

    expect(response.status).toBe(302);
    expect(response.headers.get("location")).toMatch(/^\/auth\/signin/);
  });

  it("GET /results/test-id → 302 to /auth/signin", async () => {
    const response = await fetch(`${BASE_URL}/results/test-id`, {
      redirect: "manual",
    });

    expect(response.status).toBe(302);
    expect(response.headers.get("location")).toMatch(/^\/auth\/signin/);
  });

  it("GET /auth/signin → 200 (no redirect loop)", async () => {
    const response = await fetch(`${BASE_URL}/auth/signin`, {
      redirect: "manual",
    });

    expect(response.status).toBe(200);
  });
});
