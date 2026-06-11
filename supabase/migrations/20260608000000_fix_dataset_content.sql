-- Migration: Fix dataset_2 content to be different from dataset_1
-- Replace identical content with different topics so dataset alternation is noticeable

-- Update Focus Sprint dataset_2: Change from CSS Layout to JavaScript Async Patterns
UPDATE exercises
SET
  title = 'JavaScript Async Patterns',
  description = 'Master promises, async/await, and modern asynchronous programming patterns in JavaScript.',
  content = 'Asynchronous programming is fundamental to JavaScript, enabling non-blocking operations that keep applications responsive. Modern JavaScript provides several patterns for handling async code, each with specific use cases and tradeoffs.

Callbacks were JavaScript''s original async pattern. A function accepts another function as an argument and invokes it when the operation completes. While simple, callbacks lead to "callback hell" when operations chain together, creating deeply nested code that''s hard to read and maintain. Error handling becomes inconsistent as each callback must handle its own errors.

Promises revolutionized async JavaScript by providing a standard interface for async operations. A Promise represents a future value that will eventually resolve or reject. Promises chain elegantly using .then() and .catch(), flattening nested callbacks into linear flows. Promise.all() runs operations in parallel and waits for all to complete, while Promise.race() returns whichever finishes first. The Promise interface standardized async code across libraries and frameworks.

Async/await syntax makes async code look and behave like synchronous code. The await keyword pauses function execution until a Promise resolves, eliminating .then() chains. Try/catch blocks handle errors naturally, unlike Promise .catch() methods. However, await only works inside async functions, and sequential awaits can slow performance if operations could run in parallel. Use Promise.all() when operations are independent.

Error handling strategies differ across patterns. Callbacks use error-first conventions where the first parameter is an error object. Promises use .catch() or try/catch with async/await. Unhandled Promise rejections can crash Node.js applications, so always handle errors explicitly. AbortController enables canceling in-flight requests, essential for search-as-you-type features where only the latest request matters.',
  estimated_duration_seconds = 150,
  config = '{"target_wpm": 400, "pressure_threshold": 60, "countdown_seconds": 120}'
WHERE id = 'a0000000-0000-0000-0000-000000000022'::UUID;

-- Update Speed Scan dataset_2: Change from Web Performance to Git Workflows
UPDATE exercises
SET
  title = 'Git Workflow Strategies',
  description = 'Learn collaborative Git workflows and branching strategies for professional development teams.',
  content = 'Git workflows determine how teams collaborate on code, merge changes, and maintain stable releases. Understanding different workflow models helps teams choose strategies that match their deployment cadence and team size.

Feature branch workflow is the most common pattern in modern development. Developers create branches for each feature or bug fix, work independently, then merge back to main via pull requests. This keeps main stable and deployable while allowing parallel development. Code review happens naturally during the pull request process before code reaches production. Feature branches should be short-lived to minimize merge conflicts.

Gitflow extends feature branches with dedicated development, release, and hotfix branches. The main branch represents production code, while develop holds the next release. Feature branches merge to develop, release branches prepare versions, and hotfix branches patch production issues. Gitflow suits teams with scheduled releases and multiple versions in production, but adds complexity that simple continuous deployment teams don''t need.

Trunk-based development maintains a single main branch where developers commit frequently, often multiple times per day. Short-lived feature branches last hours or days, not weeks. This minimizes merge conflicts and encourages small, incremental changes. Feature flags hide incomplete work in production while code ships continuously. Trunk-based development enables true continuous deployment but requires strong testing automation and team discipline.

Pull request strategies balance code quality with development velocity. Some teams require multiple reviewers, others just one. Automated checks run linting, tests, and security scans before human review. Squash merging creates clean history by combining feature branch commits into one commit on main. Conventional commits standardize commit messages for automated changelog generation.',
  estimated_duration_seconds = 120,
  config = '{"scan_time_seconds": 45, "info_recall_count": 4}'
WHERE id = 'a0000000-0000-0000-0000-000000000032'::UUID;
