import { describe, it, beforeAll, afterAll, expect } from "vitest";
import { adminClient, authClient } from "../helpers/supabase";
import { createFixtureUser, createFixtureCompletion, deleteFixtureUsers } from "../helpers/fixtures";

describe("exercise_completions RLS isolation", () => {
  const admin = adminClient();
  let userAId: string;
  let userBId: string;
  let userAJwt: string;
  let userBJwt: string;
  let userACompletionId: string;

  beforeAll(async () => {
    const createdIds: string[] = [];
    try {
      const userA = await createFixtureUser("rls-user-a@test.local", "password-a-123!");
      createdIds.push(userA.id);
      const userB = await createFixtureUser("rls-user-b@test.local", "password-b-123!");
      createdIds.push(userB.id);

      userAId = userA.id;
      userBId = userB.id;
      userAJwt = userA.jwt;
      userBJwt = userB.jwt;

      userACompletionId = await createFixtureCompletion(admin, userA.id);
    } catch (err) {
      await deleteFixtureUsers(admin, createdIds);
      throw err;
    }
  });

  afterAll(async () => {
    await deleteFixtureUsers(admin, [userAId, userBId].filter(Boolean));
  });

  it("User A can read their own completion", async () => {
    const client = authClient(userAJwt);

    const result = await client.from("exercise_completions").select("id").eq("id", userACompletionId);

    expect(result.error).toBeNull();
    expect(result.data).toHaveLength(1);
  });

  it("User B cannot read User A's completion by ID", async () => {
    const client = authClient(userBJwt);

    const result = await client.from("exercise_completions").select("id").eq("id", userACompletionId);

    expect(result.error).toBeNull();
    expect(result.data).toHaveLength(0);
  });
});
