# C172S Checklist Updates — Design Spec

**Date:** 2026-05-10
**Source:** Pilot feedback document "20260510 C172S Preflight Checklist and Engine Start and Before Taxi Edits and thoughts.docx"

## Overview

Updates to the `cessna172.ts` aircraft data file covering five areas: Preflight, Before Engine Start, Engine Start (full reorder), Before Taxi (full reorder), and a new Taxi phase. No UI component changes are required except adding a new phase entry.

---

## 1. Preflight Phase

### 1a. New first item — Pilot I M S A F E
Insert before `pf-01` (Aircraft documents):

```ts
{ id: 'pf-00', action: 'Pilot – I M S A F E', response: 'COMPLETE', note: 'Illness · Medication · Stress · Alcohol · Fatigue · Emotions/Everything else' }
```

### 1b. Aircraft documents — update response
Current: `CHECK — AROW: Airworthiness, Registration, Operating Handbook, Weight & Balance`
Updated: `CHECK — AROW: Airworthiness, Registration, Operating Handbook, Weight & Balance, Take off & Landing Distances · NOTAMs`

### 1c. New item — Baggage door
Add after `pf-22` (Windshield / windows), before `pf-23` (Cockpit — seat belts), as it is checked during the cabin/aft fuselage portion of the walk-around:

```ts
{ id: 'pf-29', action: 'Baggage door', response: 'SHUT & LATCHED' }
```

### 1d. Pitot tube cover — update to include cowl cover
Current `pf-08`: `action: 'Pitot tube cover', response: 'REMOVE & CHECK clear'`
Updated: `action: 'Pitot tube & cowl cover', response: 'REMOVE & CHECK clear'`

---

## 2. Before Engine Start Phase

### 2a. Passenger briefing — SAFETY acronym in note
`bs-02` response stays `COMPLETE`. Add `note` field:

```
S — Seat belt policy: belts for taxi/takeoff/landing; shoulder harnesses for takeoff/landing; seats adjusted and locked
A — Air vents: all environmental controls; actions for any passenger discomfort
F — Fire extinguisher: location and operation
E — Exit doors: emergency evacuation plan
T — Traffic: see something, say something; sterile cockpit — quiet during critical phases of flight
Y — Your questions?
```

### 2b. Remove Mixture, Primer, and Throttle from Before Engine Start
Delete `bs-08` (Mixture), `bs-09` (Primer), and `bs-10` (Throttle) from Before Engine Start. All three now appear in the Engine Start sequence (items 2, 5, and 3 respectively), so keeping them in Before Engine Start would create duplication.

### 2c. New item — Autopilot
```ts
{ id: 'bs-11', action: 'Autopilot', response: 'OFF (if equipped)' }
```

### 2d. New item — Alternate static
```ts
{ id: 'bs-12', action: 'Alternate static', response: 'CHECK — normal position' }
```

---

## 3. Engine Start Phase — Full Reorder

Replace all current `engine-start` items with the following sequence. Items previously in Engine Start that belong post-start (Avionics master, Radios/GPS, Transponder, Altimeter, Heading indicator) move to Before Taxi.

| # | ID | Action | Response | Severity / Note |
|---|-----|--------|----------|-----------------|
| 1 | es-01 | Carb heat | OFF | |
| 2 | es-02 | Mixture | FULL RICH | |
| 3 | es-03 | Throttle | OPEN SLIGHT (1/4 inch) | |
| 4 | es-04 | Beacon / Nav lights | ON | |
| 5 | es-05 | Prime | AS REQUIRED — 2–3 strokes cold / 0 warm, LOCKED | |
| 6 | es-06 | Master switch | ON (BAT first, then ALT) | |
| 7 | es-07 | Brakes | APPLY | |
| 8 | es-08 | Prop area | CLEAR — call "Clear Prop!" | warning |
| 9 | es-09 | Ignition switch | START — release when engine fires, select BOTH | |
| 10 | es-10 | Oil pressure / temp | VERIFY ALIVE — green within 30 sec | warning / note: "If no pressure in 30 sec — SHUT DOWN immediately" |
| 11 | es-11 | Throttle | 800–1000 RPM | |
| 12 | es-12 | Mixture | LEAN for taxi (high-elevation airports) | |
| 13 | es-13 | Alt / Bat | VERIFY CHARGE — ammeter positive | |

*Alt/Bat and Ammeter are combined into one item (es-13) since they are checked simultaneously on the same panel scan.*

**Heading indicator:** The current Engine Start item `es-12` (Heading indicator — ALIGN with compass) is removed. Heading indicator alignment is verified during the taxi instrument check (tx-04, HSI & Compass line) and again confirmed during Engine Run-Up (`ru-03`). No standalone item is needed in Engine Start.

---

## 4. Before Taxi Phase — Full Reorder

Replace all current `before-taxi` items with the following sequence:

| # | ID | Action | Response |
|---|-----|--------|----------|
| 1 | bt-01 | Seat belts | SECURED — all occupants |
| 2 | bt-02 | Flaps | UP — 0° |
| 3 | bt-03 | Avionics | ON |
| 4 | bt-04 | Refuel? | INPUT fuel quantity — save to GTN/GNS |
| 5 | bt-05 | GTN / GNS integrity | CHECK — GPS RAIM, database current |
| 6 | bt-06 | ATIS / AWOS | COPIED — QNH, active runway, NOTAMs |
| 7 | bt-07 | Altimeter | SET — within 75 ft of field elevation |
| 8 | bt-08 | Transponder | VERIFY SQUAWK — 1200 VFR (or assigned code) |
| 9 | bt-09 | Taxi light | ON |
| 10 | bt-10 | Parking brake | RELEASE |
| 11 | bt-11 | Radios | SET — ground frequency |

*bt-09 note: "Turn landing light and strobes ON when crossing a runway during taxi."*

---

## 5. New Taxi Phase

Add a new phase entry immediately after `before-taxi`:

```ts
{
  id: 'taxi',
  name: 'Taxi',
  category: 'taxi',
  items: [...]
}
```

| # | ID | Action | Response | Note |
|---|-----|--------|----------|------|
| 1 | tx-01 | Taxi clearance | COPIED — write down route | |
| 2 | tx-02 | Taxi route | REVIEW — confirm planned route before rolling | |
| 3 | tx-03 | Brake test | CHECK — test both sides on initial roll | caution |
| 4 | tx-04 | Instruments on the roll | CHECK | note (see below) |

**tx-04 note:**
```
Turn Coordinator: wing dips direction of turn, ball goes opposite
VSI: neutral
Airspeed: near zero
HSI & Compass: indicating correct direction during turns
Attitude Indicator: blue over brown, within 5° of horizon
Altimeter: set to field elevation, within 75 ft
```

---

## Data Model Notes

- No new TypeScript types required — all changes use existing `id`, `action`, `response`, `severity`, and `note` fields.
- New phase `taxi` uses existing `category: 'taxi'` value (same as `before-taxi`).
- ID numbering: new preflight item uses `pf-00`; new before-start items use `bs-11`, `bs-12`; taxi phase uses `tx-01` through `tx-04`.

## Out of Scope

- No changes to other C172 variants (172M, 172N, 172P) — those are separate files.
- No UI component changes.
- No changes to emergency, cruise, approach, landing, or shutdown phases.
