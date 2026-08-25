# GFGHub — Product Requirements Document

**Product:** GFGHub  
**Working tagline:** Automatically sync your GeeksforGeeks solutions to GitHub.  
**Platform:** Google Chrome Extension  
**Primary integration:** GeeksforGeeks → GitHub  
**Authentication:** GitHub OAuth  
**Manifest:** Chrome Manifest V3  
**Target users:** Students, competitive programmers, DSA learners, developers building a public GitHub DSA portfolio.

---

# 1. Product Overview

GFGHub is a Chrome extension that automatically detects when a user successfully submits a coding problem on GeeksforGeeks and synchronizes the accepted solution to a GitHub repository.

The experience should be similar to LeetHub v2:

1. User installs the extension.
2. User authenticates with GitHub.
3. User selects an existing repository or creates a new repository.
4. User goes to GeeksforGeeks.
5. User solves a problem.
6. User submits the solution.
7. GFGHub detects a successful/accepted submission.
8. GFGHub extracts the problem metadata and submitted source code.
9. GFGHub determines the appropriate DSA category/topic.
10. GFGHub creates/updates the appropriate files and folders in GitHub.
11. GFGHub updates a central README/index automatically.
12. User receives a success notification.

The entire workflow should require **zero manual copying of code** after initial setup.

---

# 2. Problem Statement

GeeksforGeeks users frequently solve hundreds of DSA problems but manually maintaining a GitHub repository is tedious.

A typical manual workflow is:

- Solve problem on GFG.
- Copy solution.
- Create a folder.
- Rename the file.
- Copy problem information.
- Add difficulty/topic.
- Update README.
- Commit.
- Push.
- Repeat.

This creates unnecessary friction and often results in incomplete or poorly organized DSA repositories.

GFGHub automates this workflow.

---

# 3. Product Goal

The primary goal is:

> **Turn every accepted GeeksforGeeks submission into a properly organized GitHub contribution automatically.**

The resulting repository should look professional enough to function as:

- A personal DSA archive
- A revision system
- A GitHub portfolio
- A progress tracker
- A searchable collection of solved GFG problems

---

# 4. Product Principles

## 4.1 Zero-friction

After initial setup, the user should simply:

**Solve → Submit → Accepted → Automatically synced**

No copy/paste.

## 4.2 GitHub-first

GitHub is the source of truth for the user's stored solutions.

## 4.3 User-controlled

Users choose:

- Repository
- Branch
- Folder structure
- File naming convention
- README behavior
- Auto-sync behavior

## 4.4 Privacy-first

The extension should not maintain a central database containing users' solutions.

The preferred architecture is:

**GFG → Chrome Extension → GitHub**

rather than:

**GFG → Extension → Our Server → GitHub**

This minimizes infrastructure and privacy concerns.

## 4.5 Resilient to GFG UI changes

GFG frequently changes its frontend.

Therefore, scraping/parsing logic must be isolated into dedicated modules rather than being scattered throughout the extension.

---

# 5. MVP Scope

The first production version MUST support:

- GFG problem detection
- Accepted submission detection
- Solution extraction
- Problem metadata extraction
- GitHub OAuth authentication
- Repository selection
- Repository creation
- Automatic GitHub commit
- Automatic folder creation
- Topic/category classification
- Automatic README generation/update
- Duplicate detection
- Retry handling
- Error notifications
- Extension popup/dashboard
- Settings
- Sync history
- Chrome Manifest V3
- Chrome Web Store readiness

---

# 6. Core User Journey

## First Launch

User installs GFGHub.

Extension popup:

> Welcome to GFGHub  
> Automatically save your GeeksforGeeks solutions to GitHub.

CTA:

**Connect GitHub**

---

## GitHub Authentication

User clicks:

**Connect GitHub**

A GitHub OAuth authorization flow opens.

After authorization:

```text
✓ GitHub Connected

Logged in as:
@username

[Continue]
```

The extension should retrieve the user's GitHub identity and permitted repository information.

---

# 7. Repository Setup

After authentication:

```text
Choose Repository

Existing Repository
-------------------
○ GFG-DSA
○ DSA-Solutions
○ My-Competitive-Programming

[Create New Repository]
```

If creating:

```text
Repository name:
GFG-DSA-Solutions

Description:
Automatically synced GeeksforGeeks solutions

Visibility:
○ Public
● Private

[Create Repository]
```

Default should be **Private**, similar to the current LeetHub onboarding philosophy.

---

# 8. Branch Selection

Allow:

```text
Branch:
main ▼
```

The extension should retrieve available branches from GitHub.

Default:

`main`

If `main` doesn't exist, detect the repository's default branch automatically.

---

# 9. GFG Problem Detection

The extension should activate on supported GFG URLs.

Examples:

```text
https://www.geeksforgeeks.org/problems/...
https://www.geeksforgeeks.org/...
```

Do NOT rely exclusively on a single URL pattern.

Create:

```text
GFGPageDetector
```

Responsibilities:

- Detect whether current page is a GFG problem page.
- Extract canonical problem URL.
- Identify problem slug.
- Identify problem ID where available.
- Identify problem title.

---

# 10. Submission Detection

This is one of the most important parts of the product.

The extension must determine whether the user's submission actually succeeded.

Possible detection mechanisms should be implemented in priority order:

### Method 1 — DOM/state detection

Monitor the GFG submission UI.

Detect:

```text
Accepted
Correct
All Test Cases Passed
```

or the current equivalent GFG success state.

### Method 2 — Submission result API/network state

If GFG exposes submission state through frontend API requests, inspect the application's network/state behavior and identify the relevant submission status.

### Method 3 — Polling

If necessary:

```text
Submission detected
       ↓
Wait
       ↓
Check result
       ↓
Accepted?
   /       \
 Yes        No
 ↓          ↓
Sync       Ignore
```

Do not push failed submissions.

---

# 11. Accepted Submission State Machine

Implement:

```text
IDLE

↓
SUBMISSION_DETECTED

↓

CHECKING_RESULT

↓

ACCEPTED
   ↓
EXTRACTING_DATA
   ↓
CLASSIFYING
   ↓
CHECKING_GITHUB
   ↓
CREATING_FILES
   ↓
UPDATING_README
   ↓
SYNC_COMPLETE
```

Failure states:

```text
SUBMISSION_FAILED
EXTRACTION_FAILED
AUTH_FAILED
GITHUB_FAILED
DUPLICATE
NETWORK_ERROR
UNKNOWN_ERROR
```

Every state should have a recoverable error path.

---

# 12. Solution Extraction

After an accepted submission, extract the actual code submitted by the user.

The extension should NOT simply copy whatever code happens to be visible if that could differ from the submitted version.

Preferred extraction hierarchy:

1. GFG submission state/API data
2. Editor state
3. DOM/editor extraction
4. Fallback mechanisms

Create an abstraction:

```text
SolutionExtractor
```

Interface:

```javascript
extractSolution(): Promise<Solution>
```

Return:

```javascript
{
  language,
  code,
  problemTitle,
  problemUrl,
  problemId,
  submittedAt
}
```

---

# 13. Multi-Language Support

The system must support the languages available in GFG's coding environment.

At minimum, architecture should support:

- C++
- Java
- Python
- JavaScript

The language parser should be extensible.

Example:

```text
languages/
    cpp.js
    java.js
    python.js
    javascript.js
```

Do not hardcode language handling throughout the codebase.

---

# 14. Problem Metadata Extraction

Extract as much metadata as reliably available.

Target metadata:

```text
Title
Problem ID
Problem URL
Difficulty
Topics
Tags
Platform
Language
Submission timestamp
```

Example:

```json
{
  "platform": "GeeksforGeeks",
  "title": "Two Sum",
  "difficulty": "Easy",
  "topics": ["Arrays", "Hashing"],
  "url": "...",
  "language": "C++"
}
```

If a field is unavailable, the sync must still work.

---

# 15. Automatic DSA Categorization

This is a core differentiating feature.

The extension should automatically organize solutions into categories.

Example categories:

```text
Arrays
Strings
Linked List
Stack
Queue
Hashing
Binary Search
Sorting
Two Pointers
Sliding Window
Recursion
Backtracking
Trees
Binary Trees
BST
Heap
Priority Queue
Graphs
Greedy
Dynamic Programming
Trie
Bit Manipulation
Math
Matrix
Searching
Miscellaneous
```

The exact taxonomy should be configurable.

---

# 16. Category Detection Strategy

Use the following priority:

### Priority 1

GFG's own problem tags/categories.

### Priority 2

Problem metadata embedded in the page/application state.

### Priority 3

Known GFG category mappings.

### Priority 4

Local rule-based classification.

### Priority 5

Optional AI classification in a future version.

The MVP should NOT depend on an external AI API to categorize problems.

This keeps the extension:

- Faster
- Cheaper
- More private
- Easier to publish
- Easier to maintain

---

# 17. Folder Structure

Recommended repository structure:

```text
GFG-DSA/
│
├── README.md
│
├── Arrays/
│   ├── Two_Sum/
│   │   ├── solution.cpp
│   │   └── README.md
│   │
│   └── Maximum_Subarray/
│       ├── solution.cpp
│       └── README.md
│
├── Strings/
│   └── ...
│
├── Linked_List/
│   └── ...
│
├── Trees/
│   └── ...
│
├── Graphs/
│   └── ...
│
└── Dynamic_Programming/
    └── ...
```

---

# 18. Problem Folder Naming

Default:

```text
<Problem_ID>-<Problem_Title>
```

Example:

```text
1234-Two-Sum
```

If GFG does not expose a stable numeric ID:

```text
two-sum
```

Sanitize:

- `/`
- `\`
- `:`
- `?`
- `*`
- `<`
- `>`
- `|`
- quotes

Maximum reasonable folder-name length should be enforced.

---

# 19. File Naming

Default:

```text
solution.cpp
```

or:

```text
solution.py
solution.java
solution.js
```

Optional configuration:

```text
two-sum.cpp
```

or:

```text
main.cpp
```

Settings:

```text
File naming:
○ solution.cpp
○ problem-name.cpp
○ main.cpp
```

---

# 20. Per-Problem README

Every solved problem should optionally have its own README.

Example:

```markdown
# Two Sum

## Problem

[View Problem](GFG_URL)

## Difficulty

Easy

## Topics

- Arrays
- Hashing

## Approach

...

## Complexity

Time: O(n)
Space: O(n)

## Solution

See `solution.cpp`.
```

MVP may initially generate the README from deterministic metadata.

AI-generated explanations should be considered Phase 2.

---

# 21. Main Repository README

GFGHub should automatically maintain a central README.

Example:

```markdown
# GeeksforGeeks DSA Solutions

Automatically synced using GFGHub.

## Progress

| Category | Problems |
|----------|----------|
| Arrays | 24 |
| Strings | 12 |
| Trees | 18 |
| Graphs | 9 |
| Dynamic Programming | 15 |

## Problems

### Arrays

| # | Problem | Difficulty | Language |
|---|---------|------------|----------|
| 1 | Two Sum | Easy | C++ |
| 2 | Maximum Subarray | Medium | Python |

### Trees

| # | Problem | Difficulty | Language |
|---|---------|------------|----------|
| 3 | Binary Tree Traversal | Easy | Java |
```

---

# 22. README Update Rules

When a new problem is synced:

1. Read current README.
2. Parse GFGHub-managed section.
3. Add the new problem.
4. Update category count.
5. Preserve all user-written content outside the managed section.
6. Commit updated README.

IMPORTANT:

Do NOT overwrite the user's entire README.

Use managed markers:

```markdown
<!-- GFGHUB:START -->
...
<!-- GFGHUB:END -->
```

Only modify content between these markers.

If markers don't exist, offer:

```text
GFGHub can add a managed solutions section to your README.

[Add Section]
```

---

# 23. Duplicate Detection

Before creating a solution:

Check:

1. Local sync history.
2. GitHub repository path.
3. Problem ID.
4. Canonical URL.
5. Problem slug.

If the same problem already exists:

```text
Already Synced

Two Sum is already present in your repository.

[View on GitHub]
```

Do not create duplicate folders.

---

# 24. Re-solving a Problem

If the user solves the same problem again:

Configuration:

```text
When a problem is already synced:

○ Update existing solution
○ Save as a new version
○ Ignore
```

Default:

**Update existing solution**

The GitHub commit history will preserve previous versions.

---

# 25. GitHub Integration

Use GitHub's API.

Core operations:

```text
GET user
GET repositories
GET repository
GET branches
GET contents
PUT contents
POST repository
```

The extension should abstract GitHub API calls:

```text
GitHubClient
```

Example:

```javascript
github.getUser()
github.getRepositories()
github.createRepository()
github.getFile()
github.createOrUpdateFile()
github.getBranch()
```

Do not scatter raw GitHub API calls throughout UI/content scripts.

---

# 26. Authentication Architecture

Use OAuth rather than asking users to paste a GitHub Personal Access Token.

Flow:

```text
User
 ↓
Chrome Extension
 ↓
GitHub OAuth
 ↓
User grants permissions
 ↓
Authorization callback
 ↓
Extension receives authentication result
 ↓
Token stored securely
```

Chrome's `chrome.identity` API is designed for OAuth access-token flows in extensions.

GitHub also supports OAuth authorization for third-party applications.

The exact OAuth architecture must be validated against GitHub's current OAuth requirements during implementation.

---

# 27. GitHub Permission Principle

Request the smallest practical permission set.

Do NOT request broad access simply because it may be useful later.

Chrome Web Store policy requires extensions to request the narrowest permissions necessary for their current functionality.

The implementation team must explicitly document:

```text
Permission
Purpose
Why required
What data it can access
```

---

# 28. Token Storage

Do not store authentication credentials in:

- localStorage
- plain text files
- source code
- GitHub repository
- analytics backend

Use appropriate Chrome extension storage and security mechanisms.

Authentication information must be kept secure.

Recommended:

```text
chrome.storage.local
```

with careful handling of OAuth tokens.

---

# 29. Extension Architecture

Recommended architecture:

```text
gfg-hub/
│
├── src/
│   ├── background/
│   │   └── service-worker.ts
│   │
│   ├── content/
│   │   └── gfg-content.ts
│   │
│   ├── popup/
│   │   ├── Popup.tsx
│   │   └── components/
│   │
│   ├── options/
│   │   └── Options.tsx
│   │
│   ├── github/
│   │   ├── client.ts
│   │   ├── auth.ts
│   │   └── repository.ts
│   │
│   ├── gfg/
│   │   ├── detector.ts
│   │   ├── submission.ts
│   │   ├── extractor.ts
│   │   ├── metadata.ts
│   │   └── selectors.ts
│   │
│   ├── sync/
│   │   ├── sync-manager.ts
│   │   ├── duplicate-detector.ts
│   │   └── retry-manager.ts
│   │
│   ├── categorization/
│   │   ├── categories.ts
│   │   └── classifier.ts
│   │
│   ├── storage/
│   │   └── storage.ts
│   │
│   └── utils/
│
├── public/
│   ├── icons/
│   └── privacy-policy.html
│
├── manifest.json
├── package.json
├── vite.config.ts
└── README.md
```

---

# 30. Chrome Extension Components

## Content Script

Runs on GFG.

Responsibilities:

- Detect problem page
- Monitor submission
- Extract solution
- Extract metadata
- Communicate with service worker

It should NOT directly handle GitHub authentication.

---

## Background Service Worker

Responsibilities:

- GitHub communication
- Authentication
- Sync orchestration
- Retry queue
- Notifications
- Storage
- API calls

---

## Popup

Responsibilities:

- Authentication status
- Repository
- Sync statistics
- Recent submissions
- Settings shortcuts

---

## Options Page

Settings:

```text
GitHub Account
Repository
Branch
Folder Structure
File Naming
Auto Sync
README Generation
Notifications
Duplicate Handling
```

---

# 31. Popup Dashboard

Design should be simple and polished.

Example:

```text
GFGHub

● GitHub Connected

Repository
github.com/user/GFG-DSA

────────────────────

Solved
127

This Week
18

────────────────────

Recent Syncs

✓ Two Sum
  Arrays · C++

✓ Binary Tree Traversal
  Trees · Python

✓ Longest Common Prefix
  Strings · Java

────────────────────

[Open Repository]

[Settings]
```

---

# 32. Sync Status

The user should always know what is happening.

States:

```text
Detecting submission...
Checking result...
Extracting solution...
Classifying problem...
Syncing to GitHub...
Updating README...
✓ Synced successfully
```

Failures:

```text
⚠ Sync failed

Could not connect to GitHub.

[Retry]
```

---

# 33. Chrome Notifications

Optional notifications:

```text
✓ GFGHub synced Two Sum to GitHub.
```

Error:

```text
⚠ GFGHub could not sync Two Sum.
Click to retry.
```

Notifications must never become spammy.

---

# 34. Offline / Network Failure

If GitHub is temporarily unavailable:

```text
Submission accepted
        ↓
Sync queued
        ↓
Network restored
        ↓
Sync automatically retried
```

Maintain a local queue:

```javascript
pendingSyncs[]
```

Maximum retry count:

```text
3
```

with exponential backoff.

---

# 35. Rate Limits

GitHub API rate limits must be respected.

The extension should:

- Avoid unnecessary API calls.
- Cache repository metadata.
- Cache branch information.
- Batch operations where possible.
- Detect rate-limit responses.
- Display a useful message.

Example:

```text
GitHub API rate limit reached.

Your solution has been saved locally and will retry later.
```

---

# 36. GitHub Commit Strategy

Preferred behavior:

One accepted problem = one logical Git commit.

Example:

```text
feat(gfg): add Two Sum solution
```

Alternative:

```text
Add GFG solution: Two Sum
```

Commit should contain:

```text
problem solution
problem README
main README update
```

if applicable.

---

# 37. Atomicity

The system should avoid partial repository corruption.

Example failure:

```text
solution uploaded
README update failed
```

The sync system should detect this and either:

- retry the README update, or
- mark sync as partially completed.

Never silently report success if only part of the operation succeeded.

---

# 38. Sync History

Store local sync metadata:

```json
{
  "problemId": "1234",
  "problemUrl": "...",
  "githubPath": "Arrays/1234-Two-Sum",
  "commitSha": "...",
  "timestamp": "...",
  "status": "success"
}
```

Popup:

```text
Sync History

127 synced
2 failed
1 pending
```

---

# 39. Settings

## General

```text
[✓] Automatically sync accepted submissions
[✓] Show success notifications
[✓] Show error notifications
```

## GitHub

```text
Account
Repository
Branch
```

## Organization

```text
Category structure
Folder naming
File naming
```

## README

```text
[✓] Update main README
[✓] Generate per-problem README
```

---

# 40. Security Requirements

The extension must:

- Use HTTPS for remote communication.
- Never expose GitHub tokens.
- Never log authentication tokens.
- Never send solutions to an unnecessary third-party server.
- Avoid unnecessary permissions.
- Avoid remote executable code.
- Sanitize all extracted data before writing to GitHub.
- Escape Markdown correctly.
- Validate GitHub repository paths.
- Validate API responses.

Chrome's current policies require secure handling of user data and appropriate disclosure of data practices.

---

# 41. Privacy

The ideal architecture stores:

```text
User GitHub credentials → locally
User settings → locally
Sync history → locally
Solutions → user's GitHub
```

No central database is required for MVP.

If a backend is later introduced, the privacy implications must be reassessed.

Chrome Web Store policy requires an accurate privacy policy when the product handles user data.

---

# 42. Permissions

Keep permissions minimal.

Potential permissions should be evaluated individually during implementation.

Likely categories:

```text
storage
identity
notifications
```

Host permissions should be restricted to required sites, e.g. GFG and GitHub endpoints where necessary.

Do NOT request:

```text
<all_urls>
```

unless absolutely required.

---

# 43. GFG Host Access

Prefer narrowly scoped access such as:

```text
https://www.geeksforgeeks.org/*
```

rather than unrestricted browser access.

---

# 44. Error Handling

Every failure should have a human-readable message.

Examples:

### GitHub not connected

```text
GitHub is not connected.

[Connect GitHub]
```

### Repository missing

```text
The selected repository could not be found.

It may have been renamed or deleted.

[Choose Repository]
```

### Submission extraction failure

```text
GFGHub detected an accepted submission but couldn't extract the submitted code.

[Retry]
[Report Issue]
```

### Duplicate

```text
This problem already exists in your repository.

[Open Existing Solution]
[Overwrite]
```

---

# 45. Logging

Implement development-only structured logging:

```javascript
logger.info()
logger.warn()
logger.error()
```

Production logs must never contain:

- OAuth tokens
- Source code unless absolutely necessary for local debugging
- Private repository contents
- Personal information

Provide a debug mode:

```text
Settings → Advanced → Enable Debug Logging
```

---

# 46. GFG UI Change Protection

Selectors must be centralized.

Bad:

```javascript
document.querySelector(".random-class")
```

throughout multiple files.

Good:

```javascript
GFG_SELECTORS = {
    submitButton: "...",
    editor: "...",
    result: "...",
    problemTitle: "..."
}
```

Create version-tolerant extraction functions.

If extraction fails, the extension should fail gracefully rather than break the entire popup.

---

# 47. Testing Strategy

Testing must include:

## Unit Tests

Test:

- URL parsing
- Metadata parsing
- category mapping
- filename sanitization
- README generation
- duplicate detection
- GitHub path generation

## Integration Tests

Test:

```text
GFG page
→ accepted submission
→ extraction
→ GitHub API
→ repository file
```

## Manual Browser Tests

Test:

- Fresh installation
- OAuth
- New repository
- Existing repository
- Public repository
- Private repository
- Different languages
- Different GFG problem types
- Failed submissions
- Re-submissions
- Network failures
- GitHub rate limiting

---

# 48. Critical Acceptance Tests

The following must pass before release.

### Test 1

User solves a GFG problem.

Expected:

```text
Accepted
→ solution automatically appears on GitHub
```

### Test 2

User submits incorrect solution.

Expected:

```text
Nothing is pushed.
```

### Test 3

User solves an already synced problem.

Expected:

```text
Existing solution detected.
```

### Test 4

GitHub is temporarily unavailable.

Expected:

```text
Submission is queued.
```

### Test 5

User refreshes GFG.

Expected:

```text
Extension continues functioning.
```

### Test 6

User logs out of GitHub.

Expected:

```text
Extension stops GitHub sync and asks user to authenticate again.
```

### Test 7

README contains custom user content.

Expected:

```text
Custom content remains untouched.
```

### Test 8

Two problems belong to the same category.

Expected:

```text
Both appear under the same category.
```

### Test 9

Problem has multiple tags.

Expected:

```text
Primary category is selected deterministically.
```

### Test 10

User changes repository.

Expected:

```text
Future solutions sync to new repository.
```

---

# 49. Performance Requirements

After an accepted submission is detected:

Target:

```text
< 5 seconds
```

for normal synchronization.

The extension should avoid blocking the GFG page.

GitHub operations should run through the background service worker.

---

# 50. UX Requirements

The extension should feel invisible when everything works.

Ideal experience:

```text
User submits
      ↓
Accepted
      ↓
✓ GFGHub
Synced to GitHub
```

No unnecessary modal should interrupt the user.

---

# 51. Phase 2 Features

Do NOT block MVP for these.

Potential future features:

### AI Explanations

Automatically generate:

- Intuition
- Approach
- Complexity
- Edge cases

### AI Categorization

Use AI when GFG metadata is insufficient.

### Statistics

```text
Total Solved
Easy
Medium
Hard
Current Streak
Longest Streak
Topics
Languages
```

### GitHub Profile Dashboard

Show:

```text
Problems solved
Commits
Top topics
Language distribution
```

### Search

Search synced problems from the extension.

### Multiple repositories

Allow:

```text
GFG → Repository A
LeetCode → Repository B
```

### Multiple branches

Advanced branch workflows.

### Sync existing GFG history

Potentially import previously solved GFG problems.

---

# 52. Phase 3

Potential unified DSA platform:

```text
GFG
LeetCode
CodeStudio
CodeChef
HackerRank
```

all → GitHub.

Architecture should therefore keep the platform-specific code modular.

Recommended interface:

```typescript
interface CodingPlatformAdapter {
    canHandle(url: string): boolean;
    getProblemMetadata(): Promise<ProblemMetadata>;
    getSubmissionStatus(): Promise<SubmissionStatus>;
    getSubmittedSolution(): Promise<Solution>;
}
```

Then:

```text
GFGAdapter
LeetCodeAdapter
CodeChefAdapter
```

can exist independently.

For this project, however, only `GFGAdapter` is required.

---

# 53. Recommended Tech Stack

## Frontend

```text
TypeScript
React
Vite
```

## Styling

```text
Tailwind CSS
```

## Extension

```text
Chrome Manifest V3
```

## Storage

```text
chrome.storage.local
```

## GitHub

```text
GitHub REST API
OAuth
```

## Testing

```text
Vitest
Playwright
```

Optional:

```text
ESLint
Prettier
```

---

# 54. Manifest V3

The extension MUST use Manifest V3.

Suggested structure:

```json
{
  "manifest_version": 3,
  "name": "GFGHub",
  "version": "1.0.0",
  "description": "Automatically sync accepted GeeksforGeeks solutions to GitHub.",
  "permissions": [
    "storage",
    "identity"
  ],
  "background": {
    "service_worker": "background.js"
  },
  "action": {
    "default_popup": "popup.html"
  },
  "content_scripts": [
    {
      "matches": [
        "https://www.geeksforgeeks.org/*"
      ],
      "js": [
        "content.js"
      ]
    }
  ]
}
```

The exact permissions and OAuth configuration must be finalized after implementing the GitHub authentication architecture.

---

# 55. Repository Structure Generated by Extension

Default:

```text
README.md

Arrays/
    0001-two-sum/
        solution.cpp
        README.md

Strings/
    0002-longest-common-prefix/
        solution.py
        README.md

Trees/
    0003-binary-tree-traversal/
        solution.java
        README.md
```

---

# 56. GitHub Sync Algorithm

Pseudo-flow:

```text
onSubmissionDetected():

    submission = detectSubmission()

    if submission.status !== ACCEPTED:
        return

    solution = extractSolution()

    metadata = extractMetadata()

    category = classify(metadata)

    path = buildGitHubPath(
        category,
        metadata,
        solution.language
    )

    if alreadySynced(metadata):
        handleDuplicate()
        return

    solutionFile = generateSolutionFile(solution)

    problemReadme = generateProblemReadme(metadata)

    repositoryReadme = updateMainReadme(metadata, path)

    commitToGitHub([
        solutionFile,
        problemReadme,
        repositoryReadme
    ])

    saveSyncHistory()

    notifyUser()
```

---

# 57. README Generator

Create:

```text
ReadmeGenerator
```

Inputs:

```text
ProblemMetadata
SolutionMetadata
GitHubPath
```

Output:

```text
Markdown
```

The generator must be deterministic.

Example:

```markdown
# {{title}}

**Difficulty:** {{difficulty}}

**Topics:** {{topics}}

[Problem Link]({{url}})

## Solution

Language: {{language}}

## Complexity

Time: {{timeComplexity}}
Space: {{spaceComplexity}}
```

Complexity should only be included if known.

Do not invent complexity values.

---

# 58. GitHub API Error Mapping

Map HTTP errors to useful messages.

```text
401 → GitHub authentication expired
403 → Permission denied / rate limited
404 → Repository/file not found
409 → Conflict
422 → Invalid GitHub request
429 → Rate limit
500+ → GitHub server error
```

---

# 59. Onboarding Flow

First launch:

```text
┌─────────────────────────┐
│        GFGHub           │
│                         │
│ Save your GFG solutions │
│ directly to GitHub.     │
│                         │
│    [Connect GitHub]     │
└─────────────────────────┘
```

After authentication:

```text
✓ GitHub connected

Choose repository

[ Select Repository ▼ ]

or

[ + Create Repository ]

[Continue]
```

Then:

```text
You're ready!

Go solve your first GFG problem.

GFGHub will automatically sync accepted submissions.
```

---

# 60. Chrome Web Store Requirements

The extension must be prepared for Chrome Web Store publication.

Chrome requires a developer account before publishing and currently requires a one-time registration fee.

Google also requires developer accounts to use 2-Step Verification for publishing/updating extensions.

---

# 61. Chrome Web Store Publishing Steps

## Step 1 — Create Google Account

Use the account that will own the extension.

Prefer a dedicated developer/business email.

---

## Step 2 — Enable 2-Step Verification

Enable 2FA on the Google account.

Required before publishing.

---

## Step 3 — Register Chrome Web Store Developer Account

Go to the Chrome Web Store Developer Dashboard.

Register as a developer.

Pay the one-time registration fee.

---

## Step 4 — Prepare Production Build

Run:

```bash
npm install
npm run build
```

Output:

```text
dist/
```

The production build must contain:

```text
manifest.json
background.js
content.js
popup.html
popup.js
icons/
```

---

# 62. Production Validation

Before uploading:

```bash
npm run lint
npm run test
npm run build
```

Then manually load:

```text
chrome://extensions
```

Enable:

```text
Developer mode
```

Click:

```text
Load unpacked
```

Select:

```text
dist/
```

This is also the basic local-development workflow used by LeetHub-style extensions.

---

# 63. Create ZIP

The ZIP should contain the extension package itself.

Example:

```text
gfg-hub-v1.0.0.zip
```

Do not accidentally create:

```text
gfg-hub-v1.0.0.zip
    └── dist/
        └── manifest.json
```

Instead:

```text
gfg-hub-v1.0.0.zip
    ├── manifest.json
    ├── background.js
    ├── content.js
    ├── popup.html
    └── ...
```

---

# 64. Chrome Web Store Listing

Create:

### Extension name

```text
GFGHub
```

### Short description

```text
Automatically sync your accepted GeeksforGeeks solutions to GitHub.
```

### Detailed description

Explain:

- Automatic syncing
- GitHub integration
- GFG support
- Categorization
- README generation
- Privacy
- No manual copying

Do not make unsupported claims.

Chrome requires accurate listing information and a clear single purpose.

---

# 65. Store Assets

Prepare:

```text
128×128 icon
Screenshots
Promotional graphics where required
Store description
Privacy policy URL
Support URL
```

Screenshots should demonstrate:

1. GitHub authentication
2. Repository selection
3. GFG accepted submission
4. Successful sync
5. GitHub repository result
6. Organized README

---

# 66. Privacy Policy

Create:

```text
privacy-policy.html
```

Host it on a public HTTPS URL.

It must explain:

- What information the extension accesses.
- Why it accesses it.
- What is sent to GitHub.
- What is stored locally.
- Whether data is sent to any other service.
- How users can revoke access.
- How users can delete local extension data.

Chrome requires an accurate privacy policy when an extension handles user data.

---

# 67. Chrome Data Disclosure

The Web Store listing must accurately disclose data usage.

Do not claim:

```text
We collect no data
```

if the extension processes GitHub account information or solution content.

Instead accurately describe the data flow.

Chrome's Limited Use requirements restrict how extension user data can be collected, transferred, and used.

---

# 68. Uploading the Extension

Chrome's current publishing workflow is:

1. Open Chrome Developer Dashboard.
2. Sign into developer account.
3. Select **Add new item**.
4. Upload the ZIP.
5. Complete store listing information.
6. Complete privacy/data-use declarations.
7. Submit for review.

Chrome documents this exact upload flow.

---

# 69. Testing Before Submission

Test using:

```text
Chrome Stable
Chrome latest
Fresh Chrome profile
Existing GitHub account
Private repository
Public repository
Multiple GFG problems
Multiple languages
Failed submission
Accepted submission
Duplicate submission
Offline GitHub
Expired authentication
```

---

# 70. Store Review Preparation

Before submission verify:

- No unnecessary permissions.
- No remote executable JavaScript.
- No hidden data collection.
- Privacy policy is accurate.
- Store description accurately describes functionality.
- Extension has a clear single purpose.
- All functionality works.
- No broken links.
- Icons exist.
- Screenshots exist.
- Support contact exists.

Chrome's review policies specifically emphasize minimum permissions, privacy, single purpose, working functionality, and accurate store metadata.

---

# 71. Beta Release

Before public release:

```text
Internal testing
        ↓
5–20 beta users
        ↓
Fix GFG compatibility issues
        ↓
Chrome Web Store submission
        ↓
Public release
```

Chrome supports beta/staged release workflows.

---

# 72. Versioning

Use semantic versioning:

```text
1.0.0
1.0.1
1.1.0
2.0.0
```

Examples:

```text
1.0.1 = bug fix
1.1.0 = new feature
2.0.0 = breaking architecture change
```

---

# 73. Development Milestones

## Milestone 1 — Extension Skeleton

Deliver:

- Manifest V3
- TypeScript
- React
- Vite
- Popup
- Content script
- Background service worker
- Storage

---

## Milestone 2 — GFG Adapter

Deliver:

- Problem detection
- Problem metadata
- Submission detection
- Accepted status detection
- Code extraction

---

## Milestone 3 — GitHub Integration

Deliver:

- OAuth
- User profile
- Repository listing
- Repository creation
- Branch selection
- File creation/update

---

## Milestone 4 — Automatic Sync

Deliver:

```text
Accepted GFG submission
→ GitHub
```

---

## Milestone 5 — Organization

Deliver:

- Categories
- Folder structure
- File naming
- Duplicate detection

---

## Milestone 6 — README

Deliver:

- Problem README
- Main README
- Managed section
- Statistics

---

## Milestone 7 — Reliability

Deliver:

- Retry system
- Queue
- Error handling
- Rate limiting
- Logging

---

## Milestone 8 — Store Release

Deliver:

- Privacy policy
- Icons
- Screenshots
- Store listing
- Production ZIP
- Review submission

---

# 74. Definition of Done

GFGHub MVP is considered complete when a new user can:

```text
Install extension
      ↓
Connect GitHub
      ↓
Select/create repository
      ↓
Open GFG
      ↓
Solve problem
      ↓
Submit
      ↓
Receive Accepted
      ↓
GFGHub automatically detects it
      ↓
Solution is extracted
      ↓
Problem is categorized
      ↓
GitHub folder is created
      ↓
Solution is committed
      ↓
README is updated
      ↓
User sees success
```

without manually copying the solution.

---

# 75. Claude Implementation Instructions

Claude should implement this project in phases rather than attempting the entire extension in one pass.

## Rule 1

Do not implement GitHub integration before the GFG extraction layer is testable.

## Rule 2

Do not hardcode GFG selectors throughout the application.

## Rule 3

Do not use a backend unless technically necessary.

## Rule 4

Do not request broad Chrome permissions.

## Rule 5

Do not store GitHub credentials insecurely.

## Rule 6

Do not overwrite the user's README.

## Rule 7

Do not duplicate problems silently.

## Rule 8

Do not assume a GFG page structure will remain unchanged.

## Rule 9

All platform-specific logic must live inside `GFGAdapter`.

## Rule 10

Every major module must have tests.

---

# 76. Suggested Claude Build Prompt

Claude should begin implementation with:

> Build GFGHub according to this PRD.
>
> First inspect the repository and create the architecture for a Manifest V3 Chrome extension using TypeScript, React, and Vite.
>
> Do not implement everything at once.
>
> Phase 1 must create the extension skeleton, background service worker, content script, popup, storage layer, GitHub abstraction, and GFG adapter interfaces.
>
> Then implement and test GFG problem detection and metadata extraction.
>
> After that implement accepted-submission detection and solution extraction.
>
> Only after those components are working should GitHub OAuth and repository synchronization be implemented.
>
> Keep all GFG-specific DOM/API logic isolated in the GFG adapter.
>
> Follow the PRD's security, privacy, permission, duplicate detection, retry, README, and Chrome Web Store requirements.
>
> Use TypeScript throughout.
>
> Do not introduce unnecessary backend infrastructure.
>
> Do not use GitHub Personal Access Tokens as the primary authentication UX; implement a proper OAuth-based authentication flow compatible with Chrome extensions and GitHub's current OAuth requirements.
>
> After every major milestone:
>
> 1. Run tests.
> 2. Run lint.
> 3. Run production build.
> 4. Report what works.
> 5. Report remaining issues.
> 6. Continue to the next milestone only after the current milestone is stable.
>
> The final product must be installable as a Chrome Manifest V3 extension and ready for Chrome Web Store submission.

---

# 77. Important Product Differentiation

The product should NOT position itself simply as:

> "LeetHub but for GFG."

Instead position it as:

> **A dedicated GitHub automation layer for GeeksforGeeks users.**

The strongest differentiators should be:

1. GFG-first reliability.
2. Automatic accepted-submission detection.
3. Zero-copy GitHub synchronization.
4. Smart DSA categorization.
5. Professional repository organization.
6. Automatic README maintenance.
7. GitHub OAuth rather than manual token setup.
8. Local-first/privacy-conscious architecture.
9. Resilient handling of GFG frontend changes.
10. Eventually, analytics and AI-powered explanations.

---

# 78. Final Product Vision

The ideal experience is almost invisible:

```text
              GEEKSFORGEEKS
                    │
                    │ Submit
                    ▼
             ┌──────────────┐
             │    GFGHub    │
             └──────┬───────┘
                    │
              Accepted?
               /       \
             No         Yes
             │           │
           Stop          ▼
                  Extract Solution
                         │
                         ▼
                  Extract Metadata
                         │
                         ▼
                  Detect Category
                         │
                         ▼
                 Detect Duplicate
                         │
                         ▼
                   GitHub API
                         │
              ┌──────────┴──────────┐
              ▼                     ▼
        Solution File          README Update
              │                     │
              └──────────┬──────────┘
                         ▼
                    Git Commit
                         │
                         ▼
                  ✓ SYNC COMPLETE
```

**Success metric for MVP:**

> A user should be able to install GFGHub, connect GitHub once, solve a GFG problem, click Submit, receive an Accepted verdict, and find the correctly categorized solution in GitHub without manually copying or uploading anything.