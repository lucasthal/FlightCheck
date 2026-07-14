# FlightCheck — EU Market Entry Plan

**Date:** 2026-07-13 · **Scope:** Apple App Store distribution in the EU/EEA (+ UK note). Web/Stripe sales to the EU are explicitly deferred (see Phase 0.3).
**Status of rules referenced:** DSA trader requirement enforced since Feb 17, 2025. CRA vulnerability-reporting starts Sept 11, 2026; full CRA obligations Dec 11, 2027. EAA in force since June 2025 (microenterprise exemption).

> Not legal advice. The operational steps are accurate to Apple's published process; entity/GDPR questions marked ⚖️ deserve an hour with a lawyer.

---

## The one-paragraph version

Apple is merchant of record in the EU, so VAT, invoices, refunds, and the 14-day withdrawal right are handled by Apple. What stands between FlightCheck and EU sales is: (1) **DSA trader status** — a verified business identity (name, address, phone, email) published on your EU product page; (2) **GDPR hygiene** — DPAs with Supabase/RevenueCat, an updated privacy policy, and (⚖️) likely an EU representative service; (3) from **September 11, 2026**, CRA vulnerability-reporting readiness. Realistic timeline to EU-live: **3–6 weeks**, with Apple's trader verification as the long pole.

---

## Phase 0 — Decisions (Week 1)

**0.1 Public business identity — DECIDED (2026-07-13): Path A, individual trader.**
- Virtual business address: acquired ✓. Dedicated phone (Google Voice or VoIP) + trader declaration next.
- Entity analysis: Louie is a California resident operating from home. An out-of-state (WY/DE) LLC would still constitute "doing business in California" → foreign registration + the $800/yr CA franchise tax anyway — strictly worse than a CA LLC. Decision: no LLC for now; revisit "CA LLC yes/no" when revenue justifies $800/yr.
- Risk layer staged instead: price tech E&O / product liability insurance (~$500–1,500/yr) BEFORE forming the LLC — insurance pays defense costs; the entity only shields assets. ⚖️ CPA/attorney hour still recommended before the LLC decision.

**0.2 Storefront scope.** Recommendation: all 27 EU storefronts + EEA (Norway, Iceland, Liechtenstein) in one go, plus the UK (separate regime — no DSA trader requirement, no extra work). Optional conservative variant: Ireland-only for 2 weeks as an English-language soft launch, then the rest.

**0.3 Web checkout stays non-EU for now.** On the web (Stripe), YOU are the merchant — EU sales would trigger VAT OSS registration and EU consumer-law obligations directly on you. Defer: keep marketing the web app outside the EU, or later move web billing to a merchant-of-record (Paddle/Lemon Squeezy) if EU web sales matter. iOS-first EU entry costs you none of this.

## Phase 1 — GDPR workstream (Weeks 1–3, parallel with Phase 2)

FlightCheck's posture is strong: no ads, no analytics SDKs, no tracking — data is auth (email/name), preferences, notes, and purchase state. That means **no consent banner is required** (all processing is service-provision), and App Privacy labels stay clean.

1. **Data map (1 hour):** document what lives where — Supabase (auth, preferences, notes, profiles), RevenueCat (subscription state), Apple (payment). Keep as `docs/business/data-map.md`.
2. **DPAs:** accept/countersign Supabase's DPA and RevenueCat's DPA (both self-serve). Record whether each participates in the EU-US Data Privacy Framework and/or relies on SCCs; note it in the data map.
3. **⚖️ EU Representative (GDPR Art. 27):** a non-EU business offering services to EU residents generally needs a designated EU rep (a mailbox service for supervisory authorities, ~€100–500/yr — DataRep, EDPO, etc.). Order one; add to privacy policy.
4. **Privacy policy update:** add EU lawful bases, data-subject rights (access/portability/erasure — in-app account deletion already exists ✓), international-transfer mechanisms, the EU rep's contact, retention periods. Host at the existing GitHub Pages privacy URL (App Information URLs are editable any time without review).
5. **Erasure path check:** confirm the delete-account Edge Function actually erases Supabase rows (not just auth) and note RevenueCat deletion procedure.

## Phase 2 — App Store Connect mechanics (Weeks 1–4)

1. **Declare trader status:** App Store Connect → Business → Digital Services Act compliance. Provide the Phase 0.1 address/phone/email + payment-account details, certify EU-law compliance. Apple verifies (days to ~2 weeks; they may request documents).
2. **Wait for "verified"** — apps without verified trader status are not distributable in the EU at all.
3. **Pricing:** set EUR prices — recommend parity charm pricing: €5.99/month, €49.99/year (Apple's tier suggestions will be close; check each storefront's suggestion). Verify the 7-day trial and annual offer configuration carry over per-storefront (they do by default; confirm in the subscription's Availability tab).
4. **Availability:** add EU/EEA (+UK) storefronts for the app AND both subscription products. Offer codes: confirm redemption works in EU storefronts if creator partnerships extend there.
5. **Metadata:** English metadata is fine at launch (aviation is English-speaking). Localization (German first — largest EU GA market — then French) is a growth lever, not a launch blocker.

## Phase 3 — Product & content readiness (parallel)

1. **Terms of Use:** add a line acknowledging EU consumers' statutory rights and that purchases/refunds are handled through Apple. Existing "reference only — always verify against current POH/AFM" disclaimer already does the aviation-liability work; keep it prominent in EU listing copy too.
2. **Aircraft content:** the fleet (Cessna/Piper/etc.) flies worldwide under EASA registrations; no content change required. Roadmap note (not blocker): EASA-style units toggles and metric/hPa preferences would strengthen EU appeal.
3. **Support:** support@flightcheckapp.com is published under DSA — make sure it's monitored; EU consumer expectations on response times are higher.
4. **EAA (Accessibility Act):** in force since June 2025; **microenterprise service providers (<10 staff, <€2M turnover) are exempt**. Document that you qualify (one paragraph, dated, in this folder). Revisit if the business grows past thresholds; the app's accessibility is worth improving regardless.

## Phase 4 — Cyber Resilience Act (deadline-driven)

The CRA applies to apps installable by EU users. Two dates:

**Sept 11, 2026 (≈2 months away) — vulnerability reporting goes live.** If you become aware of an actively exploited vulnerability or severe incident: early warning in 24h, notification in 72h, final report in 14 days (via ENISA's single reporting platform). Prepare now:
- Publish a vulnerability disclosure policy: `SECURITY.md` + security@flightcheckapp.com + a security.txt on the website.
- Write a one-page incident runbook (who notices → where to report → the 24/72/14 clock).

**Dec 11, 2027 — full obligations.** FlightCheck is default-category (self-assessment, Module A). Deliverables to build up during 2027: SBOM (generate from npm in CI — `npm sbom` output as a build artifact), EU Declaration of Conformity (template self-declaration; CE mark lives in documentation for software), documented secure-update mechanism (App Store updates — already true, just document), declared support period.

## Phase 5 — Launch & operate

1. Flip availability on once trader verification completes and privacy work ships.
2. Announce in EU GA communities (EASA-land forums, EuroGA.org) — organic fit for a checklist app.
3. Monitor: EU reviews per storefront, refund behavior (Apple handles, but watch rates), any DSA notices via App Store Connect.
4. Calendar reminders: **Sept 11, 2026** (CRA reporting live), **Dec 11, 2027** (CRA full), annual EU-rep renewal.

## Budget & timeline

| Item | Cost | When |
|---|---|---|
| Virtual business address + phone (if no LLC address) | ~$10–30/mo | Week 1 |
| EU GDPR representative service | ~€100–500/yr | Week 1–2 |
| Lawyer sanity-check (entity, GDPR rep, ToU) ⚖️ | ~$500–1,500 one-time | Week 1–3 |
| Everything else (DPAs, policy updates, ASC config, CRA docs) | time only | Weeks 1–4 |

**Critical path:** business identity → trader declaration → Apple verification → availability on. Everything else runs parallel. EU-live in 3–6 weeks is realistic.
