# CodePulse — Complete Architecture Specification V2

## The Observatory for the AI-Generated Code Epoch

**One-line:** A centralised, real-time intelligence observatory that continuously scans the entire public GitHub universe to monitor, score, and reveal how humans configure and use AI coding tools — and whether any of it actually works.

**Core question:** "What is AI doing to the global codebase, and can we prove it?"

**Inspiration:** World Monitor (worldmonitor.app) — 435+ live feeds, 45 data layers, 10-second refresh, 44k stars, zero-cost infrastructure via Vercel + Upstash + browser-first compute.

---

## PART 1: PRODUCT VISION

### 1.1 The Problem Nobody Is Measuring

In 2026, 41% of all code is AI-generated. Developers report feeling 20-30% faster. Controlled studies show they're actually 19% slower. Code churn is doubling. Delivery stability has decreased 7.2%. Trust in AI outputs sits at 29-46%.

Thousands of developers copy-paste Claude configs from starred GitHub repos without measuring whether those configs help or hurt. Course sellers claim "10x productivity" without evidence. Config files rot within weeks as AI tools ship updates multiple times per week. Nobody is measuring any of this at ecosystem scale.

CodePulse is the measurement layer the industry is missing.

### 1.2 What This Is

A centralised observatory that:
- Continuously crawls all public GitHub repos for AI coding tool configs
- Scores every config against current tool capabilities (model-aware, version-aware)
- Tracks the downstream impact on code quality, commit patterns, and repo health
- Replays historical data to prove or disprove productivity claims
- Teaches developers to use AI tools effectively through data-backed insights
- Generates structured feedback for AI tool makers
- Holds itself accountable by validating its own recommendations against outcomes

### 1.3 What This Is NOT

- Not a tool that users run locally — the system scores everything centrally
- Not a static report — everything updates in real time with 10-second refresh
- Not a linter — it measures outcomes, not just compliance
- Not limited to config health — it tracks the full lifecycle from configuration through code generation to production outcomes
- Not opinion-based — every insight is backed by historical data from thousands of repos

### 1.4 Target Users

- **Individual developers** — "Is my setup helping or hurting? Show me the evidence."
- **Team leads** — "How does our team's AI effectiveness compare to the ecosystem?"
- **AI tool builders** (Anthropic, Cursor, OpenAI) — "How are users actually configuring our tools and where are we failing them?"
- **Security researchers** — "What vulnerability patterns are AI tools propagating?"
- **Course creators / educators** — "Does my recommended config actually improve outcomes?"
- **Enterprise leaders** — "Should we invest in AI coding tools? What's the real ROI?"
- **Researchers** — "What does the data say about AI's impact on software engineering?"

### 1.5 Architecture Principle: Centralised Scoring, Passive Consumption

The system does all the work. It crawls GitHub continuously, discovers every CLAUDE.md and .cursorrules and AGENTS.md, scores them against every relevant model, tracks downstream repo metrics, and displays everything in real time. Users open the dashboard and see the state of the world — their repo is already scored, already ranked, already tracked. The only user-triggered action is the optional paste-and-audit for private configs.

---

## PART 2: THE SEVEN LAYERS

CodePulse is organised into seven measurement layers, each generating its own insights, all feeding into a unified dashboard.

### Layer 1: Configuration Health

**What it measures:** The quality, redundancy, and decay of AI tool config files across all public GitHub repos.

**Data sources:**
- Every public CLAUDE.md, .cursorrules, AGENTS.md, copilot-instructions.md, .windsurfrules on GitHub
- Piebald-AI/claude-code-system-prompts changelog (native capability reference)
- Anthropic's published documentation and best practices
- Tool version release histories

**Metrics:**
- Redundancy score: % of instructions duplicating native tool behaviour
- Conflict score: % of instructions conflicting with native behaviour
- Decay score: % of instructions outdated for current tool version
- Bloat score: token overhead as % of context window consumed
- Effectiveness estimate: % of instructions the model actually follows
- Overall health score: 0-100 composite
- Model-specific scores: same config scored against Sonnet, Opus, Haiku separately

**Model-aware scoring:**
The same config produces different results on different models. Opus follows complex instructions Haiku ignores. Sonnet has different native capability boundaries than Opus. The scoring engine maintains a reference dataset of the top 1,000 most prevalent instructions tested against each model. Per-repo scoring is a lookup against this reference, not a live API call.

Reference dataset refresh cycle: re-run top 1,000 instructions against all models whenever Anthropic ships a model update (roughly quarterly). Cost: ~$100-200 per refresh.

**Version-aware scoring:**
Every instruction is tagged with the Claude Code version range it's valid for. When a new version ships, the system re-evaluates all tracked repos and shows which instructions just became redundant.

### Layer 2: Developer Behaviour Patterns

**What it measures:** How developers actually interact with AI tools, not just how they configure them.

**Data sources:**
- Git commit metadata: frequency, size, timing, author patterns
- PR metadata: cycle time, merge rate, review cycles, revert rate
- Issue metadata: close rate, time to resolution
- Config file change patterns: when, how often, growing or shrinking
- Contributor patterns: solo vs team, new vs experienced

**Metrics:**

**Efficiency Ratio** — the core metric:
```
Efficiency Ratio = (outcomes achieved) / (human effort signals)

Outcomes: issues closed, PRs merged, releases shipped, tests added
Effort: commit count, lines changed, session count, manual edits post-AI
```
A rising ratio = AI is genuinely helping. Flat or declining = busywork.

**Acceptance behaviour signals (inferred from Git patterns):**
- Commit-then-immediately-revert rate: suggests AI output was accepted then found wrong
- Large-commit-followed-by-many-small-fixes: suggests AI generated bulk code that needed human cleanup
- Test-to-code ratio change: are developers writing fewer tests as AI writes more code?
- Documentation-to-code ratio change: is documentation declining?

**Config modification triggers:**
- Does the developer modify their config after frustrating sessions (inferred from commit gaps followed by config changes)?
- After reading a blog post or course (inferred from config changes that match a popular repo's instructions within 48 hours)?
- After a Claude Code update (inferred from config changes within 24 hours of a version release)?

**Config evolution trajectories:**
- **Accumulators**: config only grows, never shrinks — developer keeps adding rules
- **Oscillators**: config grows, gets frustrating, gets deleted, starts over
- **Optimisers**: config grows initially, then gets trimmed to a sweet spot
- **Statics**: config is set once and never touched again
- **Copiers**: config appears fully-formed (copied from another repo) with no iteration

Track distribution of these trajectory types across the ecosystem. How many developers reach the "optimiser" stage? How long does it take?

### Layer 3: Code Quality & Health

**What it measures:** The downstream impact of AI tool usage on code quality, security, and maintainability.

**Data sources:**
- Git diff analysis: code patterns, complexity metrics (inferred from file sizes, function counts)
- Dependency files: package.json, requirements.txt changes over time
- CI/CD signals: if public (GitHub Actions), build pass/fail rates
- Issue labels: bug reports, security issues, performance issues

**Metrics:**

**Code survival rate:** Of code committed in month X, what % still exists unchanged 3 months later? Compare AI-heavy repos (those with config files) vs human-only repos (no config files). If AI-generated code gets rewritten faster, that's the technical debt signal.

**Code churn rate:** Lines added then deleted or modified within 30 days. AI-heavy repos vs human-only repos. Industry data suggests AI code churn will double in 2026.

**Homogeneity index:** How similar are implementations of common patterns across repos? Measure by clustering code structures for common tasks (auth, API routes, database queries). If AI tools are producing identical implementations everywhere, the diversity score drops — signalling monoculture risk.

**Dependency concentration:** Are AI tools causing developers to converge on the same packages? Track npm/pip install patterns in repos with AI configs vs without. If Claude consistently recommends package X over alternative Y, track adoption curves for both.

**Test coverage delta:** Compare test-to-code ratios before and after AI config adoption within the same repo. Industry concern: developers use AI for features and skip tests.

### Layer 4: Security & Risk

**What it measures:** Security anti-patterns propagated by AI tools at ecosystem scale.

**Data sources:**
- Known vulnerability patterns in AI-generated code (cross-referenced with CVE databases)
- Common insecure patterns detectable via static analysis of public code
- Dependency vulnerability data (npm audit, pip safety)
- GitHub Security Advisory references in repos

**Metrics:**

**Security anti-pattern prevalence:** Track specific insecure patterns that AI tools tend to generate. When a pattern is identified (e.g., missing input validation, insecure JWT handling), measure its prevalence across AI-configured repos vs non-AI repos.

**Vulnerability introduction rate:** For repos with public CI/CD (GitHub Actions with security scanning), track how vulnerability counts change after AI config adoption.

**Dependency risk concentration:** If Claude recommends the same packages to everyone, a single vulnerability in one popular package affects a disproportionate share of the ecosystem. Measure this concentration risk.

**Mythos/Glasswing signal integration (future):** As Anthropic's Mythos identifies vulnerabilities in open-source code, correlate those findings with AI-generated code patterns. "This vulnerability pattern was generated by Claude Code in an estimated 14,000 repos."

### Layer 5: Ecosystem Dynamics

**What it measures:** How the AI config ecosystem evolves — trends, cargo cults, tool migration, community learning.

**Data sources:**
- GitHub star/fork/clone trends for config repos
- Instruction propagation tracking (hash-based)
- Tool switching signals (config file creation/deletion patterns)
- Community sentiment from forums, GitHub issues, social media

**Metrics:**

**Cargo cult index:** For each popular config repo, what % of downstream copies are running outdated instructions? How fast do instructions spread from popular sources to the ecosystem?

**Tool migration tracking:** When a developer deletes .cursorrules and creates CLAUDE.md in the same repo within 7 days, that's a tool switch. Track migration flows between tools over time. Which tool is gaining? Which is losing? Do switchers' repo metrics improve or decline?

**Instruction lifecycle:** Birth → spread → peak prevalence → decay → extinction. Track this lifecycle for every instruction. Some instructions are evergreen. Some are fads. The data reveals which is which.

**Community learning rate:** Is the ecosystem getting better at configuring AI tools over time? Measure average config health score by month. If it's rising, the community is learning. If flat, the community is stuck. If declining, new (naive) adopters are entering faster than education can reach them.

**Version adaptation velocity:** When a new Claude Code version ships, how quickly do configs across the ecosystem adapt? Measure the gap between version release and average config update. (Expected: very slow — most configs never update.)

### Layer 6: Historical Analysis & Time-Travel

**What it measures:** Everything above, but backwards in time — enabling trend analysis, causality testing, and claim validation.

**Data sources:**
- GH Archive: complete history of all public GitHub events since 2011
- Git history: full commit log for tracked repos
- Piebald version history: system prompt changes across 150+ Claude Code versions
- Wayback Machine / web archives: historical blog posts and course materials (for temporal correlation)

**Historical backfill process:**
1. Download GH Archive hourly dumps, filter for push events touching config files
2. For each discovered repo, fetch full Git history of the config file
3. For each historical version of the config, score it against the Claude Code version that was current at that timestamp
4. For each timestamp, fetch repo metrics (commits, PRs, issues, contributors) from GH Archive
5. Store the complete time-series in the database

**One-time batch job: estimated 2-3 days of processing.**

**Time-travel metrics:**

**Before/after AI adoption:** For repos that existed before adding a config file, measure all metrics before and after. Commit frequency, commit size, PR cycle time, issue resolution time, code churn, test coverage. This is the controlled experiment at ecosystem scale.

**Config change → outcome correlation:** When a developer modifies their config on day X, do their repo metrics change in the following 30/60/90 days? Build lagged correlation models. "Repos that reduced config size by >50% showed an average 18% improvement in commit efficiency ratio within 60 days."

**Cohort analysis:** Group repos by when they first adopted an AI config. Track each cohort's trajectory over time. Do early adopters plateau faster? Do late adopters start at higher quality? Do repos that adopted in Q1 2025 look different from repos that adopted in Q1 2026?

**Seasonal patterns:** Config modification patterns relative to conferences, blog posts, course launches, viral tweets. When does the community learn? What triggers learning?

**Claim validation engine:** Take any productivity claim ("this config boosts productivity 10x") and test it against historical data. "1,400 repos adopted this config. Average efficiency ratio change over 90 days: +3% (not statistically significant). Claimed improvement not supported by data."

**Time-travel UI:**
A slider on the dashboard: "Show ecosystem state as of [date]." Drag back to January 2025, watch the ecosystem evolve in fast-forward. Watch cargo cults form and die. Watch the config bloat epidemic grow. Watch version releases ripple through the ecosystem (or fail to).

### Layer 7: Self-Validation & Accountability

**What it measures:** Whether CodePulse's own recommendations actually work.

**The feedback loop:**

1. CodePulse audits a repo and recommends changes
2. Developer follows (or doesn't follow) the recommendations
3. CodePulse tracks the repo's downstream metrics over 30/60/90 days
4. CodePulse compares outcomes for repos that followed recommendations vs those that didn't
5. CodePulse publishes its own accuracy metrics publicly

**Self-validation metrics:**

**Recommendation accuracy rate:** Of all recommendations followed, what % resulted in measurable improvement within 60 days? Target: >60%. Below 50% = scoring algorithm needs recalibration.

**Scoring model validity:** Does the health score predict real outcomes? Plot health score against efficiency ratio, code churn, PR cycle time across all tracked repos. If high scores don't correlate with better outcomes, the scoring model is wrong.

**False positive rate:** How often does CodePulse flag an instruction as redundant when it actually provides value? Measured by: repos that delete a flagged instruction and then re-add it within 30 days (suggesting the recommendation was wrong).

**False negative rate:** How often does CodePulse mark an instruction as valuable when it's actually harmful? Harder to measure — requires outcome data showing repos keeping "valuable" instructions but seeing declining metrics.

**Algorithm evolution log:** Every time the scoring algorithm is updated based on outcome data, the change is logged publicly. "Version 3.2: Reclassified instruction X from redundant to valuable based on outcome data from 2,400 repos. Accuracy rate improved from 62% to 67%."

**Public self-scorecard:**
CodePulse's own repo has a CLAUDE.md (or will). It scores itself, displays the score on the dashboard, and tracks its own metrics. The cobbler's children have shoes.

---

## PART 3: TOOL MAKER FEEDBACK LAYER

### 3.1 Structured Signals for Anthropic, Cursor, OpenAI

The observatory generates intelligence that tool makers currently cannot get from support tickets or forum posts.

**Signal 1: Compensation instructions** — Instructions users write most often that compensate for tool failures. "47% of Claude configs contain an instruction about not overwriting test files. This is a product gap, not a user config problem. Claude should protect test files natively."

**Signal 2: Unknown capability signals** — Native capabilities users don't know about, evidenced by redundant instructions. "62% of configs manually instruct Claude to use TypeScript, which Claude already does automatically when it detects a TS project. Anthropic's onboarding doesn't communicate this."

**Signal 3: Frustration patterns** — "Never do X" instructions reveal where the tool's default behaviour causes pain. "34% of configs say 'never use console.log for debugging, use proper logging.' Claude's default debugging behaviour is a source of user frustration."

**Signal 4: Adaptation velocity** — How fast users adopt new capabilities after a release. "Claude Code v2.1.100 added native test running. 8 weeks later, only 3% of configs have removed their custom test-running instructions. Users don't read changelogs."

**Signal 5: Config complexity as UX failure indicator** — "The average config has grown from 8k chars in Q1 2025 to 24k chars in Q1 2026. Users are compensating for tool UX gaps with increasingly complex instructions. This trend is unsustainable."

**Signal 6: Cross-model confusion** — "Users configure instructions for Opus that don't work on Sonnet, then complain about inconsistency. 23% of configs contain instructions that only work on one model. The model-switching experience needs guardrails."

### 3.2 Tool Maker Dashboard (Invite-Only)

A private view for verified tool team members showing:
- Aggregate config patterns for their tool
- Top user complaints (inferred from "never do X" instructions)
- Feature adoption rates after releases
- Comparative data: how their tool's config ecosystem compares to competitors
- Direct community feedback channel

Verification: linked to official org GitHub accounts.

---

## PART 4: EDUCATIONAL LAYER

### 4.1 Learn From Data, Not Opinions

Every insight on CodePulse is backed by empirical data from thousands of repos. No opinions. No "best practices" lists. Evidence.

### 4.2 Components

**"Did you know?" tooltips:** On every scored instruction in the audit tool. "Claude already handles TypeScript detection natively since v2.1.89. Here's what it does under the hood, and here's the data: 4,200 repos with this instruction show no improvement over repos without it."

**Best practices library:** Crowdsourced AND data-validated. Community members submit tips. The system tracks whether repos following those tips show better outcomes. Tips with proven positive impact get promoted. Tips with no impact or negative impact get flagged.

**Optimal config generator:** "You're building a Next.js app with Supabase on Claude Code Sonnet. Based on data from 3,800 similar projects, here's the 12-line config that outperforms the average 45-line config by 23% on efficiency ratio." Not a template — a data-derived recommendation.

**Learning paths:** Guided journeys for different user profiles:
- "New to Claude Code" — the minimal config that works, based on data
- "Migrating from Cursor" — what to keep, what to drop, what's different
- "Team setup" — how team configs differ from solo configs, with evidence
- "Power user" — advanced configurations that data shows actually work

**Anti-patterns gallery:** The most common config mistakes, visualised with real data:
- "The bloat trap" — configs that grew past 30k chars and the outcome impact
- "The cargo cult" — copied configs with 0% improvement
- "The ghost instruction" — instructions that survive compaction 0% of the time
- "The conflict bomb" — instructions that fight each other

### 4.3 Course Audit Reports

For popular paid courses that recommend Claude/AI tool configs:
- Score the recommended config against current tool version
- Track repos that adopted the course's config
- Measure outcome improvement (or lack thereof)
- Publish findings (anonymised courses, identified by content hash not name — unless they opt in to being named)

"Course #A47 (launched January 2026) recommends a config that scores 31/100 against current Claude Code. 340 repos adopted this config. Average efficiency ratio change: statistically insignificant. 19 of 28 recommended instructions are now native behaviour."

---

## PART 5: ECONOMIC DIMENSION

### 5.1 Token Cost Calculator

Every config has a token cost. A 30k char CLAUDE.md consumes roughly 7,500 tokens of context window on every single interaction. Over 200 daily sessions, that's 1.5M tokens/day wasted on stale instructions.

**Per-repo cost estimate:** "Your config costs an estimated $47/month in wasted tokens across your usage pattern."

**Ecosystem-wide cost estimate:** "The AI coding ecosystem is wasting an estimated $2.3M/month on redundant config tokens across all tracked repos."

### 5.2 ROI Calculator

For enterprise users considering AI tool adoption:
- "Based on data from 500 similar-sized repos, expected efficiency ratio improvement: +14%"
- "Expected time to optimal config: 6 weeks"
- "Expected ongoing config maintenance cost: 2 hours/month"
- "Net ROI at current token pricing: 2.8x over 6 months"

### 5.3 AI Productivity Paradox Tracker

A dedicated panel showing the gap between perceived and actual productivity:
- Developers report feeling X% faster (from survey data, external sources)
- Observable repo metrics show Y% actual change
- The gap (X - Y) is the "productivity illusion" score
- Track this gap over time. Is it closing as tools improve? Widening as hype grows?

---

## PART 6: TECHNICAL ARCHITECTURE

### 6.1 Zero-Cost Infrastructure (World Monitor Model)

| Component | Service | Cost |
|---|---|---|
| Frontend + Edge API | Vercel Hobby | $0 |
| Cache + event stream | Upstash Redis Free (10k cmds/day) | $0 |
| Browser-first compute | Client-side scoring + analysis | $0 |
| Data sources | GitHub API (5k req/hr) + Piebald + GH Archive | $0 |
| AI scoring reference | Claude API (quarterly refresh) | ~$100-200/quarter |
| AI audit tool | Claude API (on-demand) | ~$1-3/day |
| Object storage | GitHub Releases for data dumps | $0 |
| Domain | codepulse.dev | ~$12/year |
| Auth | GitHub OAuth | $0 |

**Total: ~$50-100/month**, almost entirely Claude API costs.

**Key architectural decisions:**
- **Browser-first compute:** All heavy processing (scoring lookups, chart rendering, inference calculations) runs client-side. Vercel Edge Functions serve only as CORS proxies, cache layers, and API key gatekeepers. Same pattern World Monitor uses for 435+ feeds at zero cost.
- **No PostgreSQL:** Use Upstash Redis + static JSON files (seeded and updated by GitHub Actions). Same as World Monitor's data layer.
- **Pre-computed scores:** The centralised worker (GitHub Actions cron) pre-scores all repos and stores results as static JSON. The dashboard reads from cache, not from a live scoring pipeline.
- **Reference dataset as static asset:** The instruction reference dataset (top 1,000 instructions scored against each model) is stored as a JSON file in the repo. Updated quarterly. Client-side audit tool does lookups against this file.

### 6.2 Tech Stack

| Category | Technology | Rationale |
|---|---|---|
| Frontend | Vanilla TypeScript + Vite | Performance. No framework overhead. World Monitor proves this works. |
| 3D Globe | globe.gl + Three.js | Config commit visualisation, cargo cult arcs |
| 2D Map | deck.gl + MapLibre GL | Flat map alternative |
| Charts | D3.js + custom SVG | Real-time updating, sparklines, histograms, scatter plots |
| Real-time | Server-Sent Events (SSE) | 10-second push, lighter than WebSocket |
| Desktop | Tauri 2 (optional, future) | Native app like World Monitor |
| Edge API | Vercel Edge Functions | CORS proxy, cache, rate limiting |
| Workers | GitHub Actions (cron) | Crawling, scoring, data pipeline |
| Cache | Upstash Redis (free tier) | Live events, leaderboards, session data |
| Data | Static JSON + GitHub Releases | Pre-computed scores, reference datasets, archives |
| AI | Claude API (Sonnet) | Reference dataset generation, on-demand audit scoring |
| Auth | GitHub OAuth | Community features, repo linking |

### 6.3 Data Pipeline

```
┌──────────────────────────────────────────────────────────────┐
│                  GITHUB ACTIONS CRON WORKERS                  │
│                                                              │
│  ┌────────────┐  ┌────────────┐  ┌────────────────────────┐  │
│  │ Discovery  │  │ Scorer     │  │ Metrics Collector      │  │
│  │ Worker     │  │ Worker     │  │                        │  │
│  │            │  │            │  │ For each tracked repo: │  │
│  │ Find new   │  │ Score all  │  │ - commit frequency     │  │
│  │ config     │  │ tracked    │  │ - PR cycle time        │  │
│  │ files on   │  │ repos      │  │ - issue close rate     │  │
│  │ GitHub     │  │ against    │  │ - code churn           │  │
│  │            │  │ reference  │  │ - contributor count    │  │
│  │ Runs:      │  │ dataset    │  │ - test/code ratio      │  │
│  │ every 6h   │  │            │  │                        │  │
│  │            │  │ Runs:      │  │ Runs: daily            │  │
│  │            │  │ every 1h   │  │                        │  │
│  └─────┬──────┘  └─────┬──────┘  └───────────┬────────────┘  │
│        │               │                      │              │
│        ▼               ▼                      ▼              │
│  ┌─────────────────────────────────────────────────────────┐  │
│  │              STATIC DATA STORE                          │  │
│  │                                                         │  │
│  │  repos.json          — all tracked repos + scores       │  │
│  │  instructions.json   — instruction registry             │  │
│  │  versions.json       — tool version history             │  │
│  │  metrics.json        — repo metrics time-series         │  │
│  │  leaderboard.json    — ranked lists                     │  │
│  │  ecosystem.json      — aggregate stats                  │  │
│  │  reference.json      — instruction reference dataset    │  │
│  │  history/            — historical snapshots by month    │  │
│  │                                                         │  │
│  │  Stored in: GitHub repo (data branch) + Upstash Redis   │  │
│  └─────────────────────────┬───────────────────────────────┘  │
└─────────────────────────────┼────────────────────────────────┘
                              │
                              ▼
┌──────────────────────────────────────────────────────────────┐
│                  VERCEL EDGE FUNCTIONS                        │
│                                                              │
│  /api/repos          — serve repos.json from cache           │
│  /api/audit          — on-demand scoring (Claude API call)   │
│  /api/stats          — serve ecosystem.json from cache       │
│  /api/events/stream  — SSE from Upstash Redis pub/sub       │
│  /api/history/:date  — serve historical snapshots            │
│  /api/badge/:owner/:repo — SVG badge generation             │
│                                                              │
│  All endpoints: Redis cache first, static JSON fallback      │
└──────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌──────────────────────────────────────────────────────────────┐
│                  BROWSER (CLIENT-SIDE)                        │
│                                                              │
│  - Loads static JSON data files                              │
│  - Renders globe, charts, feeds, leaderboards                │
│  - Runs local scoring for paste-and-audit (reference lookup) │
│  - Computes derived metrics and inferences client-side       │
│  - SSE connection for live event updates                     │
│  - Service worker for offline/stale-while-revalidate cache   │
└──────────────────────────────────────────────────────────────┘
```

### 6.4 Historical Backfill Pipeline

One-time batch job, run locally or on a cloud VM:

1. Download GH Archive monthly dumps (2024-2026) — ~50GB compressed
2. Filter for PushEvents touching config file patterns
3. For each unique repo discovered, fetch full git log of config file via GitHub API
4. For each historical config version, score against the Claude Code version that was current at that timestamp (from Piebald changelog)
5. For each repo at each timestamp, fetch repo metrics from GH Archive (commits, PRs, issues)
6. Build time-series data and store as monthly JSON files in `history/` directory
7. Upload to GitHub repo data branch

Estimated processing time: 2-3 days on a decent machine.
Estimated GitHub API calls: ~500k (spread over several days to stay within rate limits).

### 6.5 Reference Dataset Build Process

Quarterly (or on major model release):

1. Extract top 1,000 most prevalent instructions from the instruction registry
2. For each instruction, construct a test: "Given this CLAUDE.md instruction, does Claude follow it?" with a standardised test prompt
3. Run each test against Sonnet, Opus, Haiku (3,000 API calls total)
4. Record adherence rate for each instruction × model combination
5. Store as `reference.json` — the lookup table for all scoring
6. Also test instructions at different context positions (early, middle, late) to measure attention decay

Cost: ~$100-200 per refresh. Frequency: quarterly + ad hoc on major model releases.

### 6.6 Performance Targets

| Metric | Target |
|---|---|
| Initial page load (LCP) | < 2 seconds |
| Time to interactive | < 3 seconds |
| SSE event latency | < 500ms |
| Dashboard refresh cycle | 10 seconds |
| Audit tool response (cached instruction) | < 1 second |
| Audit tool response (new instruction, API call) | < 8 seconds |
| Globe render (1000 points) | 60fps |
| Memory usage (1 hour session) | < 200MB |
| Data file total size | < 10MB (gzipped) |

---

## PART 7: DASHBOARD UI

### 7.1 Main Dashboard Layout

```
┌──────────────────────────────────────────────────────────────────────┐
│  HEADER                                                              │
│  [CodePulse] [LIVE ●] [CC v2.1.107 — 3h ago] [Sonnet 4.6]         │
│  Ecosystem Health: 47/100 ▼2 | Repos: 34,219 | Efficiency: 1.14x   │
│  [Audit] [Explore] [Learn] [Community] [API] [Time Travel ⏮]       │
├──────────────┬───────────────────────────────────┬───────────────────┤
│  LEFT PANEL  │       CENTRE PANEL                │   RIGHT PANEL     │
│  (320px)     │       (flex)                      │   (380px)         │
│              │                                   │                   │
│ ┌──────────┐ │ ┌─────────────────────────────┐   │ ┌───────────────┐ │
│ │LIVE FEED │ │ │      GLOBE / MAP            │   │ │ LEADERBOARD   │ │
│ │          │ │ │                             │   │ │               │ │
│ │Config    │ │ │ Commits as dots             │   │ │ Best configs  │ │
│ │commits   │ │ │ Cargo cult arcs             │   │ │ Worst configs │ │
│ │streaming │ │ │ Regional patterns           │   │ │ Most copied   │ │
│ │in real   │ │ │ Tool migration flows        │   │ │ Most decayed  │ │
│ │time      │ │ │                             │   │ │ Course audit  │ │
│ │          │ │ └─────────────────────────────┘   │ │               │ │
│ │Each:     │ │                                   │ │ Click repo →  │ │
│ │- repo    │ │ ┌─────────────────────────────┐   │ │ full detail   │ │
│ │- score Δ │ │ │   VERSION + MODEL TIMELINE  │   │ │ panel         │ │
│ │- size Δ  │ │ │                             │   │ │               │ │
│ │- health  │ │ │ CC versions + model updates │   │ │               │ │
│ │  impact  │ │ │ with impact annotations     │   │ │               │ │
│ │          │ │ │                             │   │ │               │ │
│ │Colour:   │ │ └─────────────────────────────┘   │ │               │ │
│ │🟢improved│ │                                   │ │               │ │
│ │🔴degraded│ │ ┌──────────┐ ┌──────────┐        │ │               │ │
│ │🟡neutral │ │ │Avg       │ │Efficiency│        │ │               │ │
│ │          │ │ │Redundancy│ │Ratio     │        │ │               │ │
│ └──────────┘ │ │58% ▲2    │ │1.14x ▼   │        │ │               │ │
│              │ └──────────┘ └──────────┘        │ │               │ │
│ ┌──────────┐ │ ┌──────────┐ ┌──────────┐        │ ├───────────────┤ │
│ │TRENDING  │ │ │Avg Config│ │Code      │        │ │ PRODUCTIVITY  │ │
│ │INSTRUC-  │ │ │Size      │ │Survival  │        │ │ PARADOX       │ │
│ │TIONS     │ │ │24.1k ▲   │ │Rate: 67% │        │ │ TRACKER       │ │
│ │          │ │ └──────────┘ └──────────┘        │ │               │ │
│ │Rising ▲  │ │                                   │ │ Perceived:    │ │
│ │Falling ▼ │ │ ┌─────────────────────────────┐   │ │ +27% faster   │ │
│ │          │ │ │  SWITCHABLE CHART AREA       │   │ │               │ │
│ │With      │ │ │                             │   │ │ Measured:     │ │
│ │prevalence│ │ │  [Size Distribution]        │   │ │ +3% faster    │ │
│ │and       │ │ │  [Score vs Stars]           │   │ │               │ │
│ │effective-│ │ │  [Instruction Half-Life]    │   │ │ Paradox gap:  │ │
│ │ness data │ │ │  [Efficiency Ratio Trend]   │   │ │ 24 points     │ │
│ │          │ │ │  [Code Churn Comparison]    │   │ │               │ │
│ │          │ │ │  [Tool Migration Sankey]    │   │ │               │ │
│ │          │ │ │  [Config Trajectory Types]  │   │ │               │ │
│ │          │ │ │  [Model Adherence Heatmap]  │   │ │               │ │
│ └──────────┘ │ └─────────────────────────────┘   │ └───────────────┘ │
├──────────────┴───────────────────────────────────┴───────────────────┤
│  BOTTOM TICKER                                                       │
│  [CC v2.1.107 → 4,219 repos now redundant] [Most copied instruction │
│  today: "use pnpm" — prevalence 34%] [Ecosystem efficiency ratio    │
│  trending ▼ 0.3% this week] [CodePulse accuracy: 67% of followed   │
│  recommendations improved outcomes in 60 days]                       │
└──────────────────────────────────────────────────────────────────────┘
```

### 7.2 Audit Tool Page (/audit)

```
┌──────────────────────────────────────────────────────────────────┐
│                     AUDIT YOUR CONFIG                            │
│                                                                  │
│  ┌────────────────────────────────────────────────────────────┐  │
│  │  Paste your CLAUDE.md here                                 │  │
│  │  — or — Enter GitHub repo URL: [______________] [Scan]     │  │
│  │  — or — Drop file here                                     │  │
│  │                                                            │  │
│  │  Target model: [Sonnet 4.6 ▼] [Opus 4.6] [Haiku 4.5]     │  │
│  └────────────────────────────────────────────────────────────┘  │
│                                                                  │
│  ┌─── SCORECARD ──────────────────────────────────────────────┐  │
│  │                                                            │  │
│  │  OVERALL: 34/100    YOUR CONFIG IS MAKING CLAUDE WORSE     │  │
│  │                                                            │  │
│  │  Per-model breakdown:                                      │  │
│  │  Sonnet 4.6:  34/100 ▓▓▓░░░░░░░                           │  │
│  │  Opus 4.6:    52/100 ▓▓▓▓▓░░░░░  (Opus compensates better)│  │
│  │  Haiku 4.5:   21/100 ▓▓░░░░░░░░  (Haiku struggles most)   │  │
│  │                                                            │  │
│  │  Redundancy: 62% | Conflicts: 14% | Decay: 28%            │  │
│  │  Token overhead: 12,400 (6.2% of context window)           │  │
│  │  Estimated monthly token waste: $47                        │  │
│  │                                                            │  │
│  │  Instructions that survive compaction: 12 of 89 (13%)      │  │
│  │  Instructions Claude actually follows: 34 of 89 (38%)      │  │
│  │                                                            │  │
│  └────────────────────────────────────────────────────────────┘  │
│                                                                  │
│  ┌─── PER-INSTRUCTION ANALYSIS ───────────────────────────────┐  │
│  │                                                            │  │
│  │  Line 3: "Always use TypeScript for new files"             │  │
│  │  ● REDUNDANT — native since v2.1.89                        │  │
│  │  Sonnet: ignores | Opus: follows | Haiku: ignores          │  │
│  │  Prevalence: 34% of ecosystem (cargo cult source: repo X)  │  │
│  │  Repos with this instruction: no measurable improvement    │  │
│  │  [Delete — saves 47 tokens]                                │  │
│  │                                                            │  │
│  │  ... (full scrollable list)                                │  │
│  │                                                            │  │
│  └────────────────────────────────────────────────────────────┘  │
│                                                                  │
│  ┌─── WHAT-IF SIMULATOR ──────────────────────────────────────┐  │
│  │  Delete all recommended → 31.2k → 8.4k chars (−73%)       │  │
│  │  Estimated score: 34 → 89 (+55)                            │  │
│  │  Estimated efficiency gain: +14% (based on 4,200 similar)  │  │
│  │  Estimated monthly savings: $41                            │  │
│  │                                                            │  │
│  │  [Download Optimised Config] [Share Result] [Contribute]   │  │
│  └────────────────────────────────────────────────────────────┘  │
│                                                                  │
│  ┌─── COPIED-FROM DETECTION ──────────────────────────────────┐  │
│  │  34 of 89 instructions match repo XYZ (★ 3,400)            │  │
│  │  That repo: last updated Nov 2025, 47 CC updates since     │  │
│  │  That repo's current score: 31/100                         │  │
│  │  19 of those 34 copied instructions are now redundant      │  │
│  └────────────────────────────────────────────────────────────┘  │
│                                                                  │
│  ┌─── OUTCOME PREDICTION ─────────────────────────────────────┐  │
│  │  Based on historical data from similar repos:               │  │
│  │  If you follow recommendations:                             │  │
│  │  - 68% chance of improved efficiency ratio in 60 days       │  │
│  │  - Expected commit frequency change: +8%                    │  │
│  │  - Expected code churn change: -12%                         │  │
│  │  CodePulse will track your repo and validate in 60 days    │  │
│  └────────────────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────────────┘
```

### 7.3 Explore Page (/explore)

Deep-dive into ecosystem data:
- **By tool:** Claude vs Cursor vs Copilot comparison dashboards
- **By model:** Sonnet vs Opus vs Haiku instruction adherence heatmaps
- **By region:** Geographic config pattern analysis
- **By project type:** React, Python, Rust, etc. — optimal configs per ecosystem
- **By repo size:** Do large repos configure differently from small repos?
- **By team size:** Solo vs team config pattern differences

### 7.4 Learn Page (/learn)

Educational content, data-backed:
- Optimal config generator (project-type-specific)
- Anti-patterns gallery with real data
- Learning paths by user profile
- Course audit reports
- "Did you know?" knowledge base
- Best practices with evidence scores

### 7.5 Community Page (/community)

Social layer:
- Post insights, tips, findings
- Vote and comment
- Share audit results (opt-in)
- Live coding feed (Twitch/YouTube streams)
- Tool team channels (verified accounts)
- Contributor leaderboard

### 7.6 Time Travel Page (/history)

Historical analysis interface:
- Date slider: show ecosystem state at any point in time
- Before/after comparisons for any repo
- Cohort analysis by adoption date
- Claim validation: test any productivity claim against data
- Trend lines for all metrics over full history

### 7.7 API (/api)

Public JSON API:
- `GET /api/repos?sort=score&limit=50`
- `GET /api/repo/:owner/:name`
- `GET /api/stats`
- `GET /api/versions`
- `GET /api/instructions?sort=prevalence`
- `GET /api/history/:date`
- `POST /api/audit` (rate limited)
- `GET /api/events/stream` (SSE)
- `GET /api/badge/:owner/:repo.svg`

Rate limits: 100/hr unauthenticated, 1000/hr with GitHub OAuth.

---

## PART 8: PLUGIN ARCHITECTURE

### 8.1 Tool-Native, Not Schema-Forced

Every AI tool has its own config format, update cadence, model behaviour, and failure modes. Plugins understand their tool deeply. No common schema is forced.

### 8.2 Plugin Interface

```typescript
interface ToolPlugin {
  // Identity
  name: string;
  displayName: string;
  icon: string;
  website: string;

  // Discovery
  configFilePatterns: string[];
  detectConfig(content: string): boolean;

  // Version tracking
  getCurrentVersion(): Promise<ToolVersion>;
  getVersionHistory(): Promise<ToolVersion[]>;
  getNativeCapabilities(version: string): Promise<Capability[]>;

  // Scoring (uses reference dataset internally)
  scoreConfig(config: string, version: string, model?: string): Promise<ConfigScore>;

  // Event normalisation
  normaliseEvent(rawEvent: GitHubEvent): ConfigEvent | null;

  // Plugin-specific inferences
  getCustomInferences(): Inference[];
}
```

### 8.3 Observation Event Protocol

Plugins share observations, not schemas:

```typescript
interface Observation {
  id: string;
  timestamp: number;
  tool: string;
  type: ObservationType;
  severity: 'info' | 'warning' | 'critical';
  data: Record<string, unknown>;
  metadata: { repo?: string; version?: string; model?: string; confidence: number; };
}

type ObservationType =
  | 'instruction_redundant'
  | 'instruction_conflicting'
  | 'instruction_decayed'
  | 'instruction_valuable'
  | 'instruction_propagated'
  | 'version_released'
  | 'capability_added'
  | 'config_created'
  | 'config_modified'
  | 'cargo_cult_detected'
  | 'security_antipattern'
  | 'performance_degradation'
  | 'tool_switch_detected'
  | 'skill_atrophy_signal'
  | 'homogeneity_increase';
```

### 8.4 Launch Plugins

**Claude Plugin (built by you):** Full CLAUDE.md, skills, hooks, MCP scoring. Piebald integration. Model-aware scoring across Sonnet/Opus/Haiku.

**Community contribution targets:** Cursor (.cursorrules), Copilot (copilot-instructions.md), Windsurf (.windsurfrules), Codex (AGENTS.md).

---

## PART 9: COMMUNITY & SOCIAL

### 9.1 Live Coding Feed

Curated links to developers streaming AI-assisted coding on Twitch/YouTube. Thumbnail grid showing: stream title, viewer count, tool being used, config health badge (if audited).

### 9.2 Gamer-Style Session Replays

Anonymised, opt-in session summaries showing: what was asked, tokens consumed, compactions, instructions used vs ignored, outcome. Displayed as cards, sortable and filterable.

### 9.3 Tool Team Interaction Board

Verified accounts for Anthropic, Cursor, OpenAI teams. See aggregate data, post announcements, respond to findings. Verification via official org GitHub accounts.

### 9.4 Embeddable Widgets

```markdown
![Config Health](https://codepulse.dev/badge/owner/repo.svg)
```

SVG badges for READMEs. Iframe widgets for blog posts.

---

## PART 10: DATA PIPELINE TIMING

### Every 10 Seconds
- SSE push to all connected clients
- Dashboard metrics refresh
- Live feed updates

### Every 30 Seconds
- GitHub Events API polled for new config commits
- Events normalised and pushed to Redis

### Every 5 Minutes
- Piebald releases checked for new Claude Code versions
- GitHub Search API queried for new repos with config files

### Every Hour
- Re-score top 100 repos
- Update instruction prevalence counts
- Recalculate cargo cult propagation metrics

### Every 6 Hours
- Discovery worker: find new repos with config files
- Update leaderboard rankings

### Daily
- Full metrics collection for all tracked repos (commits, PRs, issues, churn)
- GH Archive backfill for missed events
- Ecosystem aggregate report generated
- Instruction half-life calculations updated
- Self-validation metrics recalculated

### On Claude Code Version Release
- Immediate: fetch diff from Piebald
- Within 1 hour: re-score all repos, calculate impact
- Dashboard: annotations, ticker alerts, impact metrics

### Quarterly (or on Model Update)
- Reference dataset refresh: test top 1,000 instructions against all models
- Cross-model adherence heatmap updated
- Scoring algorithm recalibration based on outcome data

---

## PART 11: OPEN SOURCE STRATEGY

**License:** AGPL-3.0 (same as World Monitor)

**Open:**
- Dashboard frontend
- Plugin interface and protocol
- Claude plugin reference implementation
- Scoring algorithms and reference dataset
- Inference engine
- API specifications
- Aggregated datasets
- Historical data archives

**Contribution model:**
- Tool plugins (Cursor, Copilot, Windsurf, Codex)
- New inference algorithms
- UI improvements
- Data analysis and research papers
- Educational content with evidence scores

---

## PART 12: BUILD PLAN

### Phase 1: Data Foundation (Days 1-3)
- Project scaffold (Vite + TypeScript)
- GitHub Actions workers: discovery, scoring, metrics collection
- Upstash Redis setup
- Static JSON data pipeline
- Instruction reference dataset (initial build, Claude API)
- Piebald changelog integration

### Phase 2: Scoring Engine (Days 4-6)
- Config parser (extract individual instructions)
- Instruction classifier (keyword matching + reference lookup)
- Model-aware scoring (per-model reference lookup)
- Version-aware scoring (decay detection)
- Cargo cult detection (instruction hash matching)
- Source attribution (which repo was this copied from?)

### Phase 3: Dashboard Core (Days 7-10)
- Layout framework (CSS Grid, responsive)
- Live commit feed (SSE from Upstash)
- Metric cards with 10-second refresh
- Leaderboard (best, worst, most copied, most decayed)
- Version + model timeline
- Bottom ticker bar
- Chart area with switchable views

### Phase 4: Globe & Visualisations (Days 11-13)
- globe.gl integration with health-coded dots
- Cargo cult propagation arcs
- D3 charts: distribution, scatter, half-life, efficiency ratio, churn, sankey
- Model adherence heatmap
- Config trajectory type chart
- Productivity paradox tracker panel

### Phase 5: Audit Tool (Days 14-16)
- Paste-and-score UI
- Model selector (Sonnet/Opus/Haiku)
- Per-instruction analysis with model breakdown
- What-if simulator
- Copied-from detection
- Outcome prediction (from historical data)
- Download optimised config
- Economic impact calculator

### Phase 6: Historical Backfill (Days 17-19)
- GH Archive download and filter pipeline
- Historical scoring (config at each timestamp vs contemporary CC version)
- Repo metrics time-series builder
- Before/after analysis engine
- Cohort analysis
- Time-travel UI with date slider
- Claim validation engine

### Phase 7: Educational & Community (Days 20-22)
- Learn page: optimal config generator, anti-patterns, learning paths
- Community page: posts, votes, comments
- Course audit reports
- GitHub OAuth
- Tool team verified accounts
- Embeddable badges and widgets
- Public API with documentation

### Phase 8: Self-Validation & Feedback (Days 23-25)
- Recommendation tracking: which audits were followed?
- Outcome tracking: did followed recommendations improve metrics?
- Accuracy metrics: recommendation success rate
- Public self-scorecard
- Tool maker feedback signal generation
- Algorithm evolution log

### Phase 9: Polish & Performance (Days 26-28)
- 3-tier caching (Redis → Edge → Service Worker)
- Performance profiling and optimisation
- Mobile responsive
- Error handling and resilience
- Rate limiting
- SEO and meta tags

### Phase 10: Launch (Days 29-30)
- Deploy to Vercel
- Seed with initial ecosystem data (top 500 repos scored)
- Write launch post with key findings
- Post to Hacker News, Twitter, Reddit, dev.to
- Open source the repo
- Submit to Product Hunt

---

## PART 13: SUCCESS METRICS

| Metric | 30 days | 90 days | 180 days |
|---|---|---|---|
| Dashboard MAU | 5,000 | 25,000 | 100,000 |
| Audits completed | 2,000 | 15,000 | 50,000 |
| Repos tracked | 500 | 5,000 | 20,000 |
| GitHub stars | 1,000 | 10,000 | 30,000 |
| Community posts | 100 | 1,000 | 5,000 |
| API consumers | 20 | 200 | 1,000 |
| Tool plugins (community) | 0 | 2 | 4 |
| Media mentions | 3 | 10 | 30 |
| Recommendation accuracy | 55% | 65% | 75% |
| Tool maker partnerships | 0 | 1 | 3 |

---

## PART 14: NAMING

**Recommendation: CodePulse** — short, memorable, conveys real-time monitoring, not tool-specific.

**Domain:** codepulse.dev

**Tagline:** "The heartbeat of AI-generated code."

**Alternative tagline:** "Measuring what AI is doing to the global codebase, in real time."

---

## PART 15: WHAT THIS BECOMES

At 30 days: The go-to tool for "is my Claude setup good?" — viral audit screenshots on Twitter.

At 90 days: The definitive dataset on AI coding tool configuration — cited in blog posts, conference talks, and Anthropic's own product decisions.

At 180 days: The observatory the industry uses to understand AI's impact on software engineering — referenced in research papers, enterprise adoption decisions, and policy discussions.

At 1 year: The equivalent of OWASP Top 10 but for AI-generated code quality — the reference framework everyone cites.

CodePulse doesn't sell software. It generates the data layer the industry needs to understand what's happening to the global codebase. The authority and the dataset are the product.

---

*This is the complete specification. Every layer, every metric, every panel, every pipeline, every inference, every feedback loop. Hand it to Claude Code and build.*
