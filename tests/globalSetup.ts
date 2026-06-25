import { spawn, type ChildProcess } from "child_process";

const PORT = 4322;
const BASE_URL = `http://localhost:${PORT}`;
const POLL_INTERVAL_MS = 500;
const TIMEOUT_MS = 60_000;

let child: ChildProcess | null = null;

async function waitForServer(): Promise<void> {
  const deadline = Date.now() + TIMEOUT_MS;

  while (Date.now() < deadline) {
    try {
      const response = await fetch(BASE_URL);
      if (response.ok || response.status < 500) return;
    } catch {
      // Server not ready yet
    }
    await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
  }

  throw new Error(
    `Astro dev server did not start within ${TIMEOUT_MS / 1000}s on ${BASE_URL}`
  );
}

export async function setup(): Promise<void> {
  child = spawn("npx", ["astro", "dev", "--port", String(PORT)], {
    stdio: "pipe",
    detached: false,
    shell: true,
    cwd: process.cwd(),
  });

  child.on("error", (err) => {
    throw new Error(`Failed to start Astro dev server: ${err.message}`);
  });

  process.env.TEST_SERVER_URL = BASE_URL;

  await waitForServer();
}

export async function teardown(): Promise<void> {
  if (!child) return;

  return new Promise<void>((resolve) => {
    child!.on("close", () => resolve());
    child!.kill("SIGTERM");

    setTimeout(() => {
      if (child && !child.killed) {
        child.kill("SIGKILL");
      }
      resolve();
    }, 5_000);
  });
}
