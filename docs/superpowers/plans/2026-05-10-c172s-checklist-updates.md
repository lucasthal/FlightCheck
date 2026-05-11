# C172S Checklist Updates Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Update `cessna172.ts` to reflect pilot feedback: new IMSAFE preflight item, expanded SAFETY passenger brief, Engine Start full reorder, Before Taxi full reorder, and a new Taxi phase.

**Architecture:** All changes are confined to a single data file — `src/data/aircraft/cessna172.ts`. No TypeScript types change (all fields used already exist: `id`, `action`, `response`, `severity`, `note`). A new phase object is added to the `phases` array. No UI component changes required.

**Tech Stack:** TypeScript, Vite/React PWA. No test suite — verification is `npx tsc --noEmit` + visual check in the dev server.

**Spec:** `docs/superpowers/specs/2026-05-10-c172s-checklist-updates-design.md`

---

### Task 1: Preflight Phase — 4 updates

**Files:**
- Modify: `src/data/aircraft/cessna172.ts` (preflight phase items)

- [ ] **Step 1: Add IMSAFE as first preflight item**

In `cessna172.ts`, find the preflight items array opening and add `pf-00` before `pf-01`:

Replace:
```ts
        { id: 'pf-01', action: 'Aircraft documents', response: 'CHECK — AROW: Airworthiness, Registration, Operating Handbook, Weight & Balance' },
```
With:
```ts
        { id: 'pf-00', action: 'Pilot – I M S A F E', response: 'COMPLETE', note: 'Illness · Medication · Stress · Alcohol · Fatigue · Emotions/Everything else' },
        { id: 'pf-01', action: 'Aircraft documents', response: 'CHECK — AROW: Airworthiness, Registration, Operating Handbook, Weight & Balance · Take off & Landing Distances · NOTAMs' },
```

- [ ] **Step 2: Update pitot tube cover to include cowl cover**

Replace:
```ts
        { id: 'pf-08', action: 'Pitot tube cover', response: 'REMOVE & CHECK clear' },
```
With:
```ts
        { id: 'pf-08', action: 'Pitot tube & cowl cover', response: 'REMOVE & CHECK clear' },
```

- [ ] **Step 3: Add baggage door item after Windshield / windows**

Replace:
```ts
        { id: 'pf-22', action: 'Windshield / windows', response: 'CLEAN & CHECK' },
        { id: 'pf-23', action: 'Cockpit — seat belts', response: 'CHECK — present, serviceable' },
```
With:
```ts
        { id: 'pf-22', action: 'Windshield / windows', response: 'CLEAN & CHECK' },
        { id: 'pf-29', action: 'Baggage door', response: 'SHUT & LATCHED' },
        { id: 'pf-23', action: 'Cockpit — seat belts', response: 'CHECK — present, serviceable' },
```

- [ ] **Step 4: TypeScript check**

Run from `C:\Users\Louie\.local\bin\PilotChecklist`:
```
npx tsc --noEmit
```
Expected: no errors.

- [ ] **Step 5: Commit**

```
git add src/data/aircraft/cessna172.ts
git commit -m "feat(172s): update preflight — add IMSAFE, baggage door, pitot+cowl cover, update AROW response"
```

---

### Task 2: Before Engine Start Phase — 4 updates

**Files:**
- Modify: `src/data/aircraft/cessna172.ts` (before-start phase items)

- [ ] **Step 1: Update Passenger Briefing with SAFETY acronym in note, and remove Mixture/Primer/Throttle**

Replace the entire before-start `items` array:
```ts
      items: [
        { id: 'bs-01', action: 'Preflight inspection', response: 'COMPLETE' },
        { id: 'bs-02', action: 'Passenger briefing', response: 'COMPLETE — seatbelts, exits, fire ext, no smoking' },
        { id: 'bs-03', action: 'Seats / seatbelts', response: 'ADJUST & LOCKED' },
        { id: 'bs-04', action: 'Fuel selector', response: 'BOTH' },
        { id: 'bs-05', action: 'Avionics master', response: 'OFF' },
        { id: 'bs-06', action: 'Circuit breakers', response: 'CHECK IN' },
        { id: 'bs-07', action: 'Brakes', response: 'TEST & SET' },
        { id: 'bs-08', action: 'Mixture', response: 'RICH (or as field elevation requires)' },
        { id: 'bs-09', action: 'Primer', response: 'AS REQUIRED (2–3 strokes cold / 0 warm), LOCKED' },
        { id: 'bs-10', action: 'Throttle', response: 'OPEN 1/4 INCH' },
      ],
```
With:
```ts
      items: [
        { id: 'bs-01', action: 'Preflight inspection', response: 'COMPLETE' },
        { id: 'bs-02', action: 'Passenger briefing', response: 'COMPLETE', note: 'S — Seat belt policy: belts for taxi/takeoff/landing; shoulder harnesses for takeoff/landing; seats adjusted and locked\nA — Air vents: all environmental controls; actions for any passenger discomfort\nF — Fire extinguisher: location and operation\nE — Exit doors: emergency evacuation plan\nT — Traffic: see something, say something; sterile cockpit — quiet during critical phases of flight\nY — Your questions?' },
        { id: 'bs-03', action: 'Seats / seatbelts', response: 'ADJUST & LOCKED' },
        { id: 'bs-04', action: 'Fuel selector', response: 'BOTH' },
        { id: 'bs-05', action: 'Avionics master', response: 'OFF' },
        { id: 'bs-06', action: 'Circuit breakers', response: 'CHECK IN' },
        { id: 'bs-07', action: 'Brakes', response: 'TEST & SET' },
        { id: 'bs-11', action: 'Autopilot', response: 'OFF (if equipped)' },
        { id: 'bs-12', action: 'Alternate static', response: 'CHECK — normal position' },
      ],
```

- [ ] **Step 2: TypeScript check**

```
npx tsc --noEmit
```
Expected: no errors.

- [ ] **Step 3: Commit**

```
git add src/data/aircraft/cessna172.ts
git commit -m "feat(172s): update before-start — SAFETY acronym in passenger brief, add autopilot/alt-static, remove mixture/primer/throttle"
```

---

### Task 3: Engine Start Phase — Full Reorder

**Files:**
- Modify: `src/data/aircraft/cessna172.ts` (engine-start phase items)

- [ ] **Step 1: Replace the entire engine-start items array**

Replace:
```ts
      items: [
        { id: 'es-01', action: 'Beacon / strobe', response: 'ON' },
        { id: 'es-02', action: 'Area', response: 'CLEAR — call "Clear Prop!"', severity: 'warning' },
        { id: 'es-03', action: 'Master switch', response: 'ON (BAT first, then ALT)' },
        { id: 'es-04', action: 'Ignition switch', response: 'START — release when engine fires' },
        { id: 'es-05', action: 'Throttle', response: 'ADJUST — 1000 RPM warm, 1200 RPM cold' },
        { id: 'es-06', action: 'Oil pressure', response: 'CHECK — green within 30 seconds', severity: 'warning', note: 'If no pressure in 30 sec — SHUT DOWN immediately' },
        { id: 'es-07', action: 'Mixture', response: 'LEAN for taxi (high elevation airports)' },
        { id: 'es-08', action: 'Avionics master', response: 'ON' },
        { id: 'es-09', action: 'Radios / GPS', response: 'ON & SET' },
        { id: 'es-10', action: 'Transponder', response: 'SET code, STBY' },
        { id: 'es-11', action: 'Altimeter', response: 'SET — QNH' },
        { id: 'es-12', action: 'Heading indicator', response: 'ALIGN with compass' },
      ],
```
With:
```ts
      items: [
        { id: 'es-01', action: 'Carb heat', response: 'OFF' },
        { id: 'es-02', action: 'Mixture', response: 'FULL RICH' },
        { id: 'es-03', action: 'Throttle', response: 'OPEN SLIGHT — 1/4 inch' },
        { id: 'es-04', action: 'Beacon / Nav lights', response: 'ON' },
        { id: 'es-05', action: 'Prime', response: 'AS REQUIRED — 2–3 strokes cold / 0 warm, LOCKED' },
        { id: 'es-06', action: 'Master switch', response: 'ON (BAT first, then ALT)' },
        { id: 'es-07', action: 'Brakes', response: 'APPLY' },
        { id: 'es-08', action: 'Prop area', response: 'CLEAR — call "Clear Prop!"', severity: 'warning' },
        { id: 'es-09', action: 'Ignition switch', response: 'START — release when engine fires, select BOTH' },
        { id: 'es-10', action: 'Oil pressure / temp', response: 'VERIFY ALIVE — green within 30 sec', severity: 'warning', note: 'If no pressure in 30 sec — SHUT DOWN immediately' },
        { id: 'es-11', action: 'Throttle', response: '800–1000 RPM' },
        { id: 'es-12', action: 'Mixture', response: 'LEAN for taxi (high-elevation airports)' },
        { id: 'es-13', action: 'Alt / Bat — Ammeter', response: 'VERIFY CHARGE — ammeter positive' },
      ],
```

- [ ] **Step 2: TypeScript check**

```
npx tsc --noEmit
```
Expected: no errors.

- [ ] **Step 3: Commit**

```
git add src/data/aircraft/cessna172.ts
git commit -m "feat(172s): reorder engine start — carb heat first, mixture/throttle/lights before master, combined alt/bat+ammeter"
```

---

### Task 4: Before Taxi Phase — Full Reorder

**Files:**
- Modify: `src/data/aircraft/cessna172.ts` (before-taxi phase items)

- [ ] **Step 1: Replace the entire before-taxi items array**

Replace:
```ts
      items: [
        { id: 'bt-01', action: 'ATIS / AWOS', response: 'COPIED — write down QNH, active runway, NOTAMs' },
        { id: 'bt-02', action: 'Altimeter', response: 'SET — QNH confirmed' },
        { id: 'bt-03', action: 'Transponder', response: 'STBY' },
        { id: 'bt-04', action: 'Radios', response: 'SET — ground frequency' },
        { id: 'bt-05', action: 'Lights — taxi', response: 'ON (recognition/taxi lights if equipped)' },
        { id: 'bt-06', action: 'Brakes', response: 'TEST — check both sides', severity: 'caution' },
        { id: 'bt-07', action: 'Instruments', response: 'CHECK — AI erect, VSI zero, altimeter set' },
      ],
```
With:
```ts
      items: [
        { id: 'bt-01', action: 'Seat belts', response: 'SECURED — all occupants' },
        { id: 'bt-02', action: 'Flaps', response: 'UP — 0°' },
        { id: 'bt-03', action: 'Avionics', response: 'ON' },
        { id: 'bt-04', action: 'Refuel?', response: 'INPUT fuel quantity — save to GTN / GNS' },
        { id: 'bt-05', action: 'GTN / GNS integrity', response: 'CHECK — GPS RAIM, database current' },
        { id: 'bt-06', action: 'ATIS / AWOS', response: 'COPIED — QNH, active runway, NOTAMs' },
        { id: 'bt-07', action: 'Altimeter', response: 'SET — within 75 ft of field elevation' },
        { id: 'bt-08', action: 'Transponder', response: 'VERIFY SQUAWK — 1200 VFR (or assigned code)' },
        { id: 'bt-09', action: 'Taxi light', response: 'ON', note: 'Turn landing light and strobes ON when crossing a runway during taxi' },
        { id: 'bt-10', action: 'Parking brake', response: 'RELEASE' },
        { id: 'bt-11', action: 'Radios', response: 'SET — ground frequency' },
      ],
```

- [ ] **Step 2: TypeScript check**

```
npx tsc --noEmit
```
Expected: no errors.

- [ ] **Step 3: Commit**

```
git add src/data/aircraft/cessna172.ts
git commit -m "feat(172s): reorder before-taxi — seat belts/flaps first, add GTN integrity, refuel input, taxi light note"
```

---

### Task 5: New Taxi Phase

**Files:**
- Modify: `src/data/aircraft/cessna172.ts` (add new phase after before-taxi)

- [ ] **Step 1: Add the Taxi phase after the before-taxi closing brace**

Find the closing of the before-taxi phase:
```ts
    },
    {
      id: 'runup',
```
Replace with:
```ts
    },
    {
      id: 'taxi',
      name: 'Taxi',
      category: 'taxi',
      items: [
        { id: 'tx-01', action: 'Taxi clearance', response: 'COPIED — write down route' },
        { id: 'tx-02', action: 'Taxi route', response: 'REVIEW — confirm planned route before rolling' },
        { id: 'tx-03', action: 'Brake test', response: 'CHECK — test both sides on initial roll', severity: 'caution' },
        { id: 'tx-04', action: 'Instruments on the roll', response: 'CHECK', note: 'Turn Coordinator: wing dips direction of turn, ball goes opposite\nVSI: neutral\nAirspeed: near zero\nHSI & Compass: indicating correct direction during turns\nAttitude Indicator: blue over brown, within 5° of horizon\nAltimeter: set to field elevation, within 75 ft' },
      ],
    },
    {
      id: 'runup',
```

- [ ] **Step 2: TypeScript check**

```
npx tsc --noEmit
```
Expected: no errors.

- [ ] **Step 3: Visual check in dev server**

```
npm run dev
```
Open the app, select the C172S. Verify:
- Preflight: first item is "Pilot – I M S A F E", Aircraft documents response includes NOTAMs and T/O distances, baggage door appears, pitot tube & cowl cover combined
- Before Engine Start: Passenger Briefing has SAFETY note, Autopilot and Alternate Static items present, Mixture/Primer/Throttle removed
- Engine Start: starts with Carb Heat → Mixture → Throttle, ends with Alt/Bat–Ammeter (13 items total)
- Before Taxi: starts with Seat Belts → Flaps → Avionics (11 items), taxi light has runway crossing note
- Taxi: new phase visible in phase nav with 4 items (clearance, route, brake test, instruments)

- [ ] **Step 4: Commit**

```
git add src/data/aircraft/cessna172.ts
git commit -m "feat(172s): add Taxi phase with clearance, route review, brake test, and instrument checks on the roll"
```
