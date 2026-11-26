// One-click SKILL.md templates: the everyday jobs developers hand to skills most often.
// Each fills the generator form; people can tweak anything before downloading.
// allowed-tools uses Claude Code permission syntax (e.g. Bash(git diff:*) = any "git diff …" command).

/** Words people use when asking for each template (matched by Bugsy's chat). */
export const TEMPLATE_KEYWORDS = {
  'commit-messages': ['commit', 'git message', 'conventional'],
  'code-review': ['review', 'reviews', 'reviewing', 'reviewer', 'check my code', 'pr review', 'review my pull requests', 'review pull requests'],
  'writing-tests': ['test', 'tests', 'unit test', 'jest', 'vitest', 'pytest', 'coverage', 'tdd'],
  debugging: ['debug', 'bug', 'error', 'crash', 'fix', 'broken', 'not working'],
  'pr-description': ['pr description', 'pull request description', 'describe my pr', 'pr summary', 'open a pr', 'write a pr', 'merge request description'],
  'readme-writer': ['readme', 'documentation', 'docs', 'document'],
  'release-notes': ['changelog', 'release', 'release notes', 'version'],
  'security-check': ['security', 'secret', 'vulnerab', 'secure', 'leak', 'owasp', 'api key'],
  'safe-refactor': ['refactor', 'clean up', 'cleanup', 'clean code', 'simplify', 'restructure'],
  'accessibility-audit': ['accessib', 'a11y', 'wcag', 'screen reader', 'alt text'],
  'sql-review': ['sql', 'database', 'migration', 'query', 'postgres', 'mysql', 'index'],
  'explaining-code': ['explain', 'understand', 'onboard', 'how does', 'walkthrough', 'beginner'],
};

/** Generic words that hint at a template but shouldn't decide on their own ("poems, the broken kind"). */
const WEAK = new Set(['broken', 'fix', 'error', 'bug', 'crash', 'not working', 'docs', 'document', 'documentation', 'test', 'tests', 'version', 'index', 'query', 'secret', 'leak', 'secure', 'clean up', 'cleanup', 'simplify', 'understand', 'beginner', 'how does', 'list', 'release']);

/**
 * Best template for a free-text request, or null. With { withScore: true } returns { tpl, score }:
 * a specific keyword scores 10, a generic one 2. Score ≥ 10 = a confident match.
 */
export const matchTemplate = (text, { withScore = false } = {}) => {
  const t = text.toLowerCase();
  // whole words only ("bugsy" must not match "bug"); "vulnerab" / "accessib" are deliberate prefixes
  const words = t.split(/[^a-z0-9]+/).filter(Boolean);
  const padded = ` ${words.join(' ')} `;
  const has = (w) => (/^(vulnerab|accessib)$/.test(w) ? words.some((x) => x.startsWith(w)) : padded.includes(` ${w} `));
  let best = null;
  let bestScore = 0;
  for (const tpl of TEMPLATES) {
    const words = TEMPLATE_KEYWORDS[tpl.name] ?? [];
    const score = words.reduce((s, w) => s + (has(w) ? (WEAK.has(w) ? 2 : 10) : 0), 0);
    if (score > bestScore) {
      best = tpl;
      bestScore = score;
    }
  }
  return withScore ? { tpl: best, score: bestScore } : best;
};

export const TEMPLATES = [
  {
    icon: '📝', cat: 'Git', title: 'Commit messages', name: 'commit-messages',
    what: 'Writes clear Conventional Commit messages from the staged git changes',
    when: 'the user asks to commit, write a commit message, or describe their changes',
    steps: [
      'Run `git diff --staged` to see what changed (if nothing is staged, say so and suggest `git add`)',
      'Pick the type: feat, fix, docs, refactor, test, perf or chore, plus an optional scope',
      'Write a subject under 72 characters in the imperative mood ("add", not "added")',
      'Add a short body that explains why, if the change is not obvious',
      'Show the message and ask before running `git commit`',
    ],
    exIn: 'Staged: a new dark mode toggle in settings.tsx',
    exOut: 'feat(settings): add dark mode toggle\n\nUsers can now switch themes without reloading the page.',
    edge: ['The diff mixes unrelated changes: suggest splitting it into separate commits', 'A breaking change: add "!" after the type and a BREAKING CHANGE footer'],
    tools: 'Bash(git diff:*) Bash(git status:*) Bash(git log:*)',
  },
  {
    icon: '🔍', cat: 'Quality', title: 'Code review', name: 'code-review',
    what: 'Reviews code changes for bugs, security issues, readability and missing tests, and reports findings by severity',
    when: 'the user asks for a review, asks "is this OK?", or before opening a pull request',
    steps: [
      'Get the changes: `git diff` against the main branch, or the files the user names',
      'Read each changed file in full, not only the diff, to understand the context',
      'Look for bugs first: wrong logic, missing null or error handling, off-by-one errors, race conditions',
      'Then security: injection, secrets in code, unsafe input handling, missing auth checks',
      'Then readability and missing tests',
      'Report findings grouped as Critical, Should fix and Nice to have, each with the file, line and a suggested fix',
    ],
    exIn: 'Review my changes to auth.ts',
    exOut: 'Critical: auth.ts:42 compares passwords with ==, which is open to timing attacks. Use crypto.timingSafeEqual.\nShould fix: auth.ts:57 has no test for the expired-token path.',
    edge: ['No problems found: say so plainly instead of inventing nitpicks', 'A huge diff: review the riskiest files first and say what was skipped'],
    tools: 'Read Grep Glob Bash(git diff:*) Bash(git log:*)',
  },
  {
    icon: '🧪', cat: 'Quality', title: 'Write tests', name: 'writing-tests',
    what: 'Writes unit tests for new or changed code using the project\'s existing test framework and style',
    when: 'the user asks for tests, test coverage, or "make sure this works"',
    steps: [
      'Find the test framework and an existing test file to copy its style (Jest, Vitest, pytest, Go testing…)',
      'List the behaviours to cover: the normal case, edge cases, and error cases',
      'Write one focused test per behaviour with a name that describes it',
      'Run the tests and fix any that fail because of the test itself',
      'Report what is covered and anything that could not be tested',
    ],
    exIn: 'Add tests for formatPrice(cents)',
    exOut: 'formats whole dollars ("$5.00"), formats cents ("$0.99"), handles 0, throws on negative input',
    edge: ['A test fails because the code has a real bug: report the bug, do not change the test to pass', 'No test framework yet: suggest one and ask before installing it'],
    tools: 'Read Grep Glob Bash(npm test:*) Bash(npx vitest:*) Bash(pytest:*)',
  },
  {
    icon: '🐛', cat: 'Quality', title: 'Debug a bug', name: 'debugging',
    what: 'Finds the root cause of a bug by reproducing it first, then fixes it and adds a test so it cannot come back',
    when: 'the user reports an error, a crash, a failing test, or says something "doesn\'t work"',
    steps: [
      'Reproduce the bug and capture the exact error message or wrong output',
      'Read the stack trace and the code it points to; form one hypothesis at a time',
      'Confirm the cause with a log, a test or a small experiment before changing code',
      'Make the smallest fix that addresses the root cause, not the symptom',
      'Add a test that fails without the fix and passes with it',
    ],
    exIn: 'TypeError: Cannot read properties of undefined (reading "map") in UserList.tsx',
    exOut: 'Cause: users is undefined until the fetch finishes. Fix: default it to [] and show a loading state. Added a test for the empty state.',
    edge: ['Cannot reproduce: ask for the steps, environment and full error instead of guessing', 'Several possible causes: list them ranked by likelihood'],
    tools: 'Read Grep Glob',
  },
  {
    icon: '📬', cat: 'Git', title: 'Pull request description', name: 'pr-description',
    what: 'Writes a pull request title and description from the branch\'s commits and changes',
    when: 'the user asks to open a PR, write a PR description, or summarise a branch',
    steps: [
      'Compare the branch with main: `git log main..HEAD` and `git diff main...HEAD --stat`',
      'Write a title under 70 characters that says what the PR does',
      'Write a Summary (what and why), Changes (bullet list) and How to test (steps)',
      'Mention breaking changes, migrations or new environment variables',
    ],
    exIn: 'Branch: feature/password-reset',
    exOut: 'Add password reset by email\n\n## Summary\nUsers can reset a forgotten password with a one-time link…',
    edge: ['The branch has unrelated changes: point them out and suggest a separate PR'],
    tools: 'Bash(git log:*) Bash(git diff:*) Bash(git status:*)',
  },
  {
    icon: '📖', cat: 'Docs', title: 'README writer', name: 'readme-writer',
    what: 'Writes or updates a README with what the project does, how to install it, how to use it and how to contribute',
    when: 'the user asks for a README, documentation for a repo, or "explain this project"',
    steps: [
      'Read package.json (or the equivalent), the entry point and the folder structure',
      'Open with one sentence on what the project does and who it is for',
      'Add Install, Usage (with a copy-paste example) and Configuration sections',
      'Only document commands and options that exist in the code',
      'Keep the existing README\'s useful parts if there is one',
    ],
    exIn: 'Write a README for this CLI',
    exOut: '# csv2json\n\nConvert CSV files to JSON from the command line.\n\n## Install\nnpm install -g csv2json …',
    edge: ['Unsure what a command does: run it with --help or ask, never invent flags'],
    tools: 'Read Glob Grep',
  },
  {
    icon: '🗒️', cat: 'Git', title: 'Changelog & release notes', name: 'release-notes',
    what: 'Turns the commits since the last release into a changelog entry and user-friendly release notes',
    when: 'the user is preparing a release, asks for a changelog, or "what changed since vX"',
    steps: [
      'Find the last tag with `git describe --tags --abbrev=0` and list commits since it',
      'Group them into Added, Changed, Fixed and Removed (Keep a Changelog style)',
      'Rewrite each item for users: what they will notice, not internal details',
      'Call out breaking changes at the top',
    ],
    exIn: 'Release notes since v1.4.0',
    exOut: '## 1.5.0\n### Added\n- Export reports as PDF\n### Fixed\n- Dates now show in your time zone',
    edge: ['No tags yet: ask which commit to start from'],
    tools: 'Bash(git log:*) Bash(git describe:*) Bash(git tag:*)',
  },
  {
    icon: '🔐', cat: 'Security', title: 'Security check', name: 'security-check',
    what: 'Checks code for common security problems: leaked secrets, injection, unsafe input handling and risky dependencies',
    when: 'the user asks for a security review, before a release, or when code handles logins, payments or user input',
    steps: [
      'Search for secrets: API keys, tokens and passwords in code and config (and .env files tracked by git)',
      'Check user input paths for SQL, command and HTML injection',
      'Check auth: every protected route verifies the user and their permissions',
      'Run the package manager\'s audit (e.g. `npm audit`) for known vulnerable dependencies',
      'Report each issue with severity, location and a concrete fix',
    ],
    exIn: 'Security check before launch',
    exOut: 'High: config.js:3 contains a live Stripe secret key. Move it to an environment variable and rotate the key.',
    edge: ['A real secret is found: tell the user to rotate it, since removing it from the code does not remove it from git history'],
    tools: 'Read Grep Glob Bash(npm audit:*) Bash(git ls-files:*)',
  },
  {
    icon: '♻️', cat: 'Quality', title: 'Safe refactor', name: 'safe-refactor',
    what: 'Refactors code in small, tested steps without changing what it does',
    when: 'the user asks to clean up, simplify, split or restructure code',
    steps: [
      'Run the existing tests first; if there are none, add tests for the current behaviour',
      'Make one small change at a time (rename, extract function, remove duplication)',
      'Run the tests after each step',
      'Do not change behaviour, public APIs or formatting of untouched code',
      'Summarise what changed and why it is easier to work with now',
    ],
    exIn: 'Clean up the 300-line handleSubmit function',
    exOut: 'Split into validateForm, buildPayload and submitOrder. Tests pass before and after. No behaviour changes.',
    edge: ['A change would alter behaviour: stop and ask first'],
    tools: 'Read Grep Glob Edit Bash(npm test:*)',
  },
  {
    icon: '♿', cat: 'Frontend', title: 'Accessibility audit', name: 'accessibility-audit',
    what: 'Audits UI code for accessibility problems: missing labels and alt text, contrast, keyboard access and heading order',
    when: 'the user asks about accessibility, a11y, WCAG, screen readers, or before shipping a UI',
    steps: [
      'Check every image has meaningful alt text (or alt="" if decorative)',
      'Check every form input has a label and every button has an accessible name',
      'Check everything clickable works with the keyboard and has a visible focus style',
      'Check heading order (one h1, no skipped levels) and colour contrast of text',
      'Report issues with the WCAG criterion and a code fix',
    ],
    exIn: 'Audit the signup form',
    exOut: 'Email input has no label (WCAG 1.3.1). Fix: <label for="email">Email</label>.',
    edge: ['Contrast needs real colours: if they come from CSS variables, resolve them first'],
    tools: 'Read Grep Glob',
  },
  {
    icon: '🗄️', cat: 'Backend', title: 'SQL & migrations review', name: 'sql-review',
    what: 'Reviews SQL queries and database migrations for correctness, performance and safe deploys',
    when: 'the user writes or changes SQL, adds a migration, or reports a slow query',
    steps: [
      'Check the query does what the user intends, including NULL handling and joins',
      'Look for missing indexes on filtered, joined or sorted columns',
      'Flag N+1 queries and SELECT * in hot paths',
      'For migrations: make sure they can run on a live table without long locks, and that there is a rollback',
      'Suggest the improved query or migration',
    ],
    exIn: 'Why is SELECT * FROM orders WHERE user_id = ? slow?',
    exOut: 'No index on orders.user_id, so every call scans the table. Add: CREATE INDEX idx_orders_user_id ON orders(user_id);',
    edge: ['Never run destructive SQL (DROP, DELETE without WHERE) without asking'],
    tools: 'Read Grep Glob',
  },
  {
    icon: '🎓', cat: 'Docs', title: 'Explain code', name: 'explaining-code',
    what: 'Explains how a piece of code or a codebase works, step by step, at the reader\'s level',
    when: 'the user asks "how does this work", "explain this", or is new to a project',
    steps: [
      'Start with a one-paragraph overview of what the code does and why it exists',
      'Walk through the flow in the order it runs, linking to file and line',
      'Explain any non-obvious patterns, libraries or tricks',
      'End with "where to look next" for related parts of the code',
    ],
    exIn: 'Explain how login works in this app',
    exOut: '1. LoginForm posts to /api/login (src/routes/login.ts:12)\n2. The password is checked with bcrypt…',
    edge: ['The user seems to be a beginner: avoid jargon and define terms the first time'],
    tools: 'Read Grep Glob',
  },
];
