# Coop Docs Rework Plan

Tracking document for the documentation rework proposed in [Discussion #228](https://github.com/roostorg/coop/discussions/228).

## Goal

Reorganize docs into three clearly separated guides with distinct audiences:

1. **Product guide** — functionality-focused, for adopters and admins
2. **Development guide** — technical, for contributors and engineers
3. **Integrations guide** — built-in integrations, their capabilities and configuration

## Feedback incorporated

From the discussion thread:

- **Juliet:** Routing rules should stay with manual review (not automated enforcement); HMA moves to Integrations; Zentropi needs its own integration page; add model cards; metrics/reporting should note the recent decisions log can be exported for transparency reporting or QA
- **H-Shay:** Concepts is valuable for adopters, not just developers — if it moves to the Development guide, it needs a prominent reference or link pointing potential adopters to it

## Content gaps (new writing needed)

- Overview of Coop (Product guide intro)
- Bulk actioning
- Zentropi integration
- Model cards

## Steps

### Step 1 — Restructure the navigation (scaffolding) ✓

Update `SUMMARY.md` and create stub files for the three top-level guides. No content changes yet — just the skeleton so the new structure is visible and work can proceed section by section.

### Step 2 — Product guide: Administration

Extract and lightly edit from `USER_GUIDE.md`:

- Policies
- User management and roles
- SSO (Okta SAML)

### Step 3 — Product guide: Automated routing & enforcement

Extract from `USER_GUIDE.md` and `RULES.md`:

- Text banks
- Location banks
- Routing rules (per Juliet: stay here, paired with manual review conceptually)
- Automated action rules

Note: Hash banks / HMA moves to the Integrations guide (Step 6), not here.

### Step 4 — Product guide: Manual review & enforcement

Extract from `USER_GUIDE.md`:

- Queues
- Task view and context shown to reviewers
- Wellness features
- Policy-based review
- Actions

### Step 5 — Product guide: Investigation, Bulk actioning, Appeals, Metrics

- Investigation (already documented in `USER_GUIDE.md`)
- Bulk actioning _(new content needed)_
- Appeals (consolidate `APPEALS.md` + `USER_GUIDE.md` content)
- Metrics / reporting: recent decisions log, noting it can be exported for transparency reporting or QA (per Juliet)

### Step 6 — Product guide: Overview of Coop

New high-level product-focused intro page. Best written last, once the full scope of the guide is clear.

### Step 7 — Migrate the Development guide

Largely a reorganization of existing `DEVELOPMENT.md` and `ARCHITECTURE.md`. Main addition: surface Concepts prominently with a callout that potential adopters (not just developers) should read it — addressing H-Shay's concern about it getting buried.

### Step 8 — Build the Integrations guide

Pull integration-specific content out of `USER_GUIDE.md`, `SIGNALS.md`, and `INTEGRATIONS_PLUGIN.md` into dedicated pages:

- Google Content Safety API
- OpenAI Moderation API
- Hasher-Matcher-Actioner / HMA (moved out of Automated Enforcement)
- NCMEC Reporting (consolidate `NCMEC.md` + the setup section from `USER_GUIDE.md`)
- Zentropi _(new content needed)_
- Model cards _(new content needed)_
- Bring your own
