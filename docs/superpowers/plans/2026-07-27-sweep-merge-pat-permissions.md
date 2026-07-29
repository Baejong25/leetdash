# Submission Sweep PAT Permission Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the under-permissioned sweep credential with a repository-scoped fine-grained PAT that can merge stale fork PRs containing inherited workflow changes, then remove the ineffective built-in-token fallback.

**Architecture:** `SWEEP_MERGE_TOKEN` becomes the only GitHub API credential used by the submission sweeper. The PAT is limited to `whoisyourbias/leetdash` and carries the exact read/write repository permissions required by the existing REST calls, including Workflows write. `GitHubRequestError` remains responsible for structured diagnostics, but merge requests are attempted once and any failure is reported unchanged.

**Tech Stack:** GitHub Actions, GitHub fine-grained Personal Access Tokens, GitHub REST API, Node.js 20 ESM, Vitest

## Global Constraints

- The PAT must be limited to the single repository `whoisyourbias/leetdash`.
- The PAT must not be the operator's GitHub CLI OAuth token.
- The PAT must expire after 90 days.
- Repository permissions must be: Actions read/write, Commit statuses read, Contents read/write, Pull requests read, and Workflows read/write.
- Do not add a Checks permission if the fine-grained PAT form does not expose it. The public repository's Check Runs endpoint remains readable without that permission.
- No account permissions may be granted.
- Never put the PAT value in a command argument, source file, test fixture, plan, chat message, workflow summary, or Actions log.
- Preserve exact-head merge pinning, eligibility checks, required-check provenance, review freshness, failure continuation, summary generation, and deploy dispatch.
- Do not weaken branch protection or required status checks.

---

## File Map

- `.github/workflows/sweep-submission-prs.yml`: exposes only the dedicated PAT to the sweep CLI.
- `scripts/sweep-submission-prs.mjs`: performs a single SHA-pinned merge request and preserves structured GitHub diagnostics.
- `tests/sweep-workflow.test.ts`: enforces the one-credential workflow boundary.
- `tests/sweep-submission-prs.test.mjs`: proves workflow-scope failures are not retried with another credential.
- `README.md`: documents PAT creation, permissions, expiry, rotation, and failure recovery.
- `docs/superpowers/specs/2026-07-27-sweep-merge-pat-permissions-design.md`: source design; no implementation changes.

---

### Task 1: Rotate `SWEEP_MERGE_TOKEN` to a dedicated fine-grained PAT

**Files:**
- External GitHub credential settings only
- External repository Actions secret only

**Interfaces:**
- Produces: Actions secret `SWEEP_MERGE_TOKEN` containing a fine-grained PAT for `whoisyourbias/leetdash`.
- Consumes: GitHub account `whoisyourbias` with repository administration access.

- [ ] **Step 1: Record the current secret metadata without reading its value**

Run:

```bash
gh secret list --app actions --repo whoisyourbias/leetdash
```

Expected: `SWEEP_MERGE_TOKEN` is listed with an update timestamp. Do not attempt to print or retrieve its current value because Actions secrets are write-only.

- [ ] **Step 2: Create the dedicated token in GitHub's fine-grained PAT UI**

Open GitHub Settings → Developer settings → Personal access tokens → Fine-grained tokens → Generate new token and enter:

```text
Token name: leetdash-submission-sweeper
Expiration: 90 days
Resource owner: whoisyourbias
Repository access: Only select repositories
Selected repository: leetdash
```

Set repository permissions to:

```text
Actions: Read and write
Commit statuses: Read
Contents: Read and write
Pull requests: Read
Workflows: Read and write
```

Leave every account permission and every unlisted repository permission at `No access`.

Expected: GitHub displays the token exactly once. Keep it only in the local clipboard until Step 3 completes. If GitHub requests password or 2FA confirmation, pause for the repository owner to complete it in the browser.

- [ ] **Step 3: Replace the Actions secret through an interactive hidden prompt**

Run in a PTY:

```bash
gh secret set SWEEP_MERGE_TOKEN --repo whoisyourbias/leetdash
```

Paste the token only at the interactive secret-value prompt. Do not pass it with `--body`, shell substitution, an environment variable, or a command-line argument.

Expected: `✓ Set Actions secret SWEEP_MERGE_TOKEN for whoisyourbias/leetdash`.

- [ ] **Step 4: Confirm only the secret timestamp changed**

Run:

```bash
gh secret list --app actions --repo whoisyourbias/leetdash
```

Expected: `SWEEP_MERGE_TOKEN` has the current timestamp. Its value is not displayed.

- [ ] **Step 5: Keep the superseded PAT active temporarily**

Do not revoke the old PAT yet. Record its token name in the operator's password manager or GitHub settings view so it can be revoked after Task 4 live verification. Do not record the token value in the repository.

---

### Task 2: Remove the built-in-token merge fallback

**Files:**
- Modify: `tests/sweep-workflow.test.ts:27-31`
- Modify: `tests/sweep-submission-prs.test.mjs:670-752`
- Modify: `.github/workflows/sweep-submission-prs.yml:38-50`
- Modify: `scripts/sweep-submission-prs.mjs:204-208`
- Modify: `scripts/sweep-submission-prs.mjs:332-363`
- Modify: `scripts/sweep-submission-prs.mjs:503-520`

**Interfaces:**
- Consumes: `GH_TOKEN` mapped from `secrets.SWEEP_MERGE_TOKEN`.
- Produces: `GitHubClient.mergePullRequest(number, sha) -> Promise<object | null>`, issuing exactly one SHA-pinned merge request.
- Preserves: `GitHubRequestError.status`, `GitHubRequestError.responseMessage`, and safe request/rate-limit diagnostics.

- [ ] **Step 1: Write failing workflow and client tests**

Change the workflow token test to:

```ts
it("uses only the dedicated merge PAT for GitHub API operations", () => {
  expect(workflow).toContain("GH_TOKEN: ${{ secrets.SWEEP_MERGE_TOKEN }}");
  expect(workflow).not.toContain("GITHUB_TOKEN:");
  expect(workflow).not.toContain("GH_TOKEN: ${{ secrets.GITHUB_TOKEN }}");
});
```

Replace the positive fallback test and its four-case credential-boundary table with:

```js
it("preserves a workflow-scope merge rejection without trying another credential", async () => {
  const originalFetch = globalThis.fetch;
  const requests = [];
  const message = "refusing to allow a Personal Access Token to create or update workflow `.github/workflows/deploy-pages.yml` without `workflow` scope";
  globalThis.fetch = async (_url, init) => {
    requests.push(init);
    return new Response(JSON.stringify({ message, status: "403" }), {
      status: 403,
      headers: { "x-github-request-id": "REQ-WORKFLOW-403" },
    });
  };

  try {
    const client = new GitHubClient({
      repository: "leetdash/test",
      token: "merge-pat",
      workflowMergeToken: "actions-token",
    });
    await expect(client.mergePullRequest(91, "head-sha")).rejects.toThrow(
      "request_id=REQ-WORKFLOW-403",
    );
  } finally {
    globalThis.fetch = originalFetch;
  }

  expect(requests).toHaveLength(1);
  expect(requests[0].headers.Authorization).toBe("Bearer merge-pat");
});
```

The intentionally supplied `workflowMergeToken` proves the removed interface cannot trigger a second credential request.

- [ ] **Step 2: Run the focused tests and verify RED**

Run:

```bash
npx vitest run tests/sweep-submission-prs.test.mjs tests/sweep-workflow.test.ts --exclude '.worktrees/**'
```

Expected failures:

- the workflow still contains `GITHUB_TOKEN:`;
- the exact workflow-scope 403 causes two requests instead of one.

- [ ] **Step 3: Remove the fallback from the workflow and client**

Delete this environment mapping from `.github/workflows/sweep-submission-prs.yml`:

```yaml
GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
```

Change the client constructor to:

```js
constructor({ repository, token }) {
  this.repository = repository;
  this.token = token;
}
```

Replace `mergePullRequest()` with:

```js
mergePullRequest(number, sha) {
  return this.request("PUT", `/pulls/${number}/merge`, {
    body: {
      merge_method: "merge",
      sha,
    },
  });
}
```

Replace CLI client construction with:

```js
const client = options.client ?? new GitHubClient({ repository, token });
```

Do not remove `GitHubRequestError` or change request diagnostics.

- [ ] **Step 4: Run the focused tests and verify GREEN**

Run:

```bash
npx vitest run tests/sweep-submission-prs.test.mjs tests/sweep-workflow.test.ts --exclude '.worktrees/**'
```

Expected: both files pass, including the single-request workflow-scope rejection test.

- [ ] **Step 5: Inspect the credential-boundary diff**

Run:

```bash
git diff -- .github/workflows/sweep-submission-prs.yml scripts/sweep-submission-prs.mjs tests/sweep-submission-prs.test.mjs tests/sweep-workflow.test.ts
git diff --check
```

Expected: no fallback token, retry branch, or whitespace errors remain.

- [ ] **Step 6: Commit Task 2**

```bash
git add .github/workflows/sweep-submission-prs.yml scripts/sweep-submission-prs.mjs tests/sweep-submission-prs.test.mjs tests/sweep-workflow.test.ts
git commit -m "fix: use authorized PAT for submission merges"
```

---

### Task 3: Document PAT provisioning and rotation

**Files:**
- Modify: `README.md:169-192`

**Interfaces:**
- Consumes: the credential model from the approved design.
- Produces: operator runbook under README `## 배포`.

- [ ] **Step 1: Add the sweep credential runbook**

After the deployment URL list in `README.md`, add:

```markdown
### 제출 PR 자동 병합 토큰

`.github/workflows/sweep-submission-prs.yml`은 저장소 Actions secret
`SWEEP_MERGE_TOKEN`을 사용합니다. 개인 개발용 `gh` OAuth 토큰을 재사용하지
말고, `whoisyourbias/leetdash`만 선택한 전용 fine-grained PAT를 만듭니다.

- 만료: 90일
- Actions: Read and write
- Commit statuses: Read
- Contents: Read and write
- Pull requests: Read
- Workflows: Read and write
- Account permissions: 없음

`Checks`가 fine-grained PAT 화면에 없으면 추가하지 않습니다. public 저장소의
Check Runs 조회에는 이 권한이 필요하지 않습니다.

만료 전에 새 토큰을 만든 뒤 아래 명령의 숨겨진 입력 prompt에서 값을
입력합니다. 토큰을 명령 인자, 환경 변수, 파일, 로그에 남기지 않습니다.

```bash
gh secret set SWEEP_MERGE_TOKEN --repo whoisyourbias/leetdash
gh secret list --app actions --repo whoisyourbias/leetdash
```

`without workflow scope` 병합 오류는 Workflows 권한이 빠졌다는 뜻입니다.
권한을 우회하거나 branch protection을 낮추지 말고 PAT를 위 권한으로
교체합니다. 교체한 토큰으로 sweep을 검증한 뒤 이전 PAT를 폐기합니다.
```

- [ ] **Step 2: Review the runbook for secret leakage and ambiguity**

Run:

```bash
rg -n "SWEEP_MERGE_TOKEN|workflow scope|fine-grained PAT|gh auth token|gho_|github_pat_" README.md
git diff --check
```

Expected:

- the secret name and permission names are present;
- no real token or token-shaped value appears;
- the README never instructs operators to use `gh auth token`;
- no whitespace errors are reported.

- [ ] **Step 3: Commit Task 3**

```bash
git add README.md
git commit -m "docs: document sweep PAT rotation"
```

---

### Task 4: Verify, deploy, and retire the old credential

**Files:**
- Verification only
- Generated `data/progress.json` may change during `npm run build`; restore only that generated diff before committing or pushing if the source submissions did not change.

**Interfaces:**
- Consumes: replacement `SWEEP_MERGE_TOKEN` and Tasks 2-3 commits.
- Produces: verified `master`, successful manual sweep, and revoked superseded PAT.

- [ ] **Step 1: Run the full local verification**

Run:

```bash
npm test -- --exclude '.worktrees/**'
npm run typecheck
npm run build
git diff --check
```

Expected:

- all Vitest files pass;
- TypeScript exits zero;
- the Next.js production build exits zero;
- no whitespace errors occur.

If `npm run build` changes only `data/progress.json` because it regenerated checked-in progress data without a submission source change, reverse only that generated diff:

```bash
git diff --binary -- data/progress.json | git apply -R
```

- [ ] **Step 2: Confirm the final source state**

Run:

```bash
git status --short
git log -5 --oneline
git diff origin/master...HEAD --check
git diff origin/master...HEAD --stat
```

Expected: only the planned commits are ahead of `origin/master`; the worktree is clean.

- [ ] **Step 3: Push the implementation to `master`**

Run:

```bash
git push origin master
```

Expected: remote `master` advances to the documentation and fallback-removal commits.

- [ ] **Step 4: Manually dispatch the deployed sweep**

Run:

```bash
gh workflow run sweep-submission-prs.yml --ref master
SWEEP_RUN_ID=$(gh run list --workflow sweep-submission-prs.yml \
  --event workflow_dispatch --limit 1 --json databaseId \
  --jq '.[0].databaseId')
gh run view "$SWEEP_RUN_ID" --json status,conclusion,headSha,url
```

Watch the returned run:

```bash
SWEEP_RUN_ID=$(gh run list --workflow sweep-submission-prs.yml \
  --event workflow_dispatch --limit 1 --json databaseId \
  --jq '.[0].databaseId')
gh run watch "$SWEEP_RUN_ID" --exit-status
```

Expected: the run completes successfully. With no eligible open PRs it performs only trusted reads and exits with zero merges.

- [ ] **Step 5: Audit the live run for credential leakage**

Run:

```bash
SWEEP_RUN_ID=$(gh run list --workflow sweep-submission-prs.yml \
  --event workflow_dispatch --limit 1 --json databaseId \
  --jq '.[0].databaseId')
gh run view "$SWEEP_RUN_ID" --log
```

Inspect the output without echoing or transforming secrets.

Expected:

- no authorization header appears;
- no PAT value or token-shaped string appears;
- the merge step uses `GH_TOKEN: ***`;
- no `workflowMergeToken` or fallback message appears.

- [ ] **Step 6: Verify the next real eligible merge**

For the next submission PR that passes `validate` and `opencode-review-gate`, confirm:

```bash
SWEEPED_PR_NUMBER=$(gh pr list --state merged --limit 1 \
  --json number --jq '.[0].number')
gh pr view "$SWEEPED_PR_NUMBER" \
  --json state,mergedAt,mergeCommit,headRefOid,url
gh run list --workflow sweep-submission-prs.yml --limit 3 \
  --json databaseId,status,conclusion,event,url
```

Expected:

- the PR state is `MERGED`;
- the merge used the refreshed head SHA;
- the sweep log reports the selected PR number followed by `merged.`;
- `deploy-pages.yml` is dispatched.

Do not manufacture or merge a disposable submission solely to exercise this step. Until a real eligible PR exists, Task 4 may report the live merge proof as pending while the credential and no-op sweep are verified.

- [ ] **Step 7: Revoke the superseded PAT**

In GitHub Settings → Developer settings → Personal access tokens, revoke only the old sweep PAT identified in Task 1 Step 5.

Expected: the new `leetdash-submission-sweeper` token remains active and `SWEEP_MERGE_TOKEN` keeps its verified timestamp.

- [ ] **Step 8: Record final evidence**

Capture in the handoff:

```text
Replacement secret timestamp
Task 2 and Task 3 commit SHAs
Local test/typecheck/build results
Manual sweep run URL and conclusion
Old PAT revocation confirmation
Next eligible merge proof, or an explicit pending note
```

Do not include either token value.
