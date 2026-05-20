# Piper Archer II (PA-28-181) Complete Overhaul — Design Spec

## Overview

Full rebuild of `src/data/aircraft/piperArcher.ts` from the two authoritative PDF checklists (N8060U and N3001T). The current file contains 8+ safety-critical errors — wrong engine type, wrong V-speeds, wrong magneto limits, missing carb heat, missing phases, and missing emergencies. This spec replaces the current file entirely rather than patching it.

**Also in scope:** Apply corrected V-speeds and engine data to `src/data/aircraft/piperWarrior.ts` (PA-28-161, same airframe family, similar engine).

**Out of scope:** IFR approach procedures, commercial/CFI-specific maneuvers (spin entry, etc.), the local area info pages in the PDFs.

---

## Aircraft Facts (Source: PDFs + POH knowledge)

**Aircraft:** Piper PA-28-181 Archer II  
**Engine:** Lycoming O-360-A4M — 180 HP, carbureted, 4-cylinder horizontally opposed, direct drive, fixed pitch propeller  
**Fuel system:** Two wing tanks, 24 gallons each = 48 usable (50 total). Selector: LEFT / RIGHT / OFF (no BOTH position). Low-wing design means fuel does not gravity-feed equally — pilot manages tanks manually.  
**Landing gear:** Fixed tricycle  
**Fuel type:** 100LL (blue)

---

## V-Speeds (Corrected)

| Speed | Current (WRONG) | Correct | Notes |
|-------|-----------------|---------|-------|
| Vso | 51 | **49 KIAS** | Stall, full flaps, power off |
| Vs | 57 | **55 KIAS** | Stall, clean |
| Vr | 60 | **55 KIAS** | Rotation |
| Vx | 63 | **64 KIAS** | Best angle of climb |
| Vy | — | **76 KIAS** | Best rate of climb |
| Vg | 73 | **76 KIAS** | Best glide |
| Va | 118 @ 2558 lb | **113 KIAS @ 2550 lb / 89 KIAS @ 1634 lb** | Maneuvering — varies with weight |
| Vfe | — | **102 KIAS (10°) / 89 KIAS (25°/40°)** | Max flap extension speed |
| Vno | — | **125 KIAS** | Max structural cruising |
| Vne | — | **154 KIAS** | Never exceed |

Engine description fix: `"Lycoming O-360-A4M carbureted engine producing 180 HP"` — remove all "fuel injected" language.

Magneto drop: max **175 RPM** individual drop, max **50 RPM** differential (current file says 150 — wrong).

---

## Phase Structure (19 Phases)

Mirrors the C172S structure depth. Each phase has id, name, category, and items[].

### Phase 1 — Pilot Self-Assessment
Category: `preflight`  
Items: IMSAFE check (Illness · Medication · Stress · Alcohol · Fatigue · Emotion/External pressures), NWKRAFT (NOTAMs, Weather, Known ATC delays, Runway lengths, Alternates, Fuel, TFRs).

### Phase 2 — Preflight Documentation
Category: `preflight`  
Items: ARROW (Airworthiness certificate, Registration, Radio station license, Operating handbook, Weight & balance), VOR check if IFR, maintenance logbook currency.

### Phase 3 — Cockpit Inspection (Pre-Walk-Around)
Category: `preflight`  
Items: Hobbs/Tach recorded, fuel quantity gauges (cross-check against visual), control lock REMOVE, circuit breakers IN, avionics MASTER OFF, master switch ON briefly (check fuel gauges), master OFF, ignition OFF, magneto keys removed.

### Phase 4 — Exterior Walk-Around
Category: `preflight`  
**Low-wing flow** (clockwise starting at cockpit door):

**Cockpit/Left cabin door area:**
- Door: condition, latches
- Fuel selector: verify LEFT or RIGHT (not OFF) for engine start intent
- Control inputs: freedom of movement from outside

**Left empennage:**
- Fuselage skin: condition
- Static port (left side): unobstructed
- Antennas: secure

**Horizontal stabilizer — left:**
- Leading edge: condition, no deformation
- Elevator: freedom of movement, hinge pins
- Trim tab: secure, no excessive play

**Vertical stabilizer / Rudder:**
- Condition, hinges, freedom
- Tail tie-down: REMOVED

**Horizontal stabilizer — right:**
- Mirror of left side

**Right empennage / fuselage:**
- Static port (right side): unobstructed

**Right wing:**
- Wing tip: condition, nav light secure
- Aileron: freedom, no play in hinge, pushrod connection secure
- Flap: condition, hinge pins
- Wing leading edge: condition, no dents or deformation

**Right fuel:**
- Fuel cap: remove, visually check level (blue = 100LL), secure cap (critical — low wing, fuel cap left loose = fuel siphon in flight)
- Fuel quick-drain (underside of wing, low point): drain into sampler, check for water/sediment/color
- Fuel vent (leading edge underside): unobstructed

**Right main gear:**
- Tire: condition, inflation
- Gear leg: no hydraulic leaks, no cracks

**Nose / Engine:**
- Prop: leading edge condition, no nicks, no cracks, secure to hub
- Spinner: secure
- Air filter: unobstructed
- Oil: CHECK — 6 qt minimum for flight, 8 qt full; cap secure
- Cowl: latches secure, no cowl damage
- Firewall: no staining indicating fluid leaks
- Nose gear: strut inflation, tire condition, shimmy dampener

**Left fuel:**
- Fuel cap: same check as right side
- Fuel quick-drain: drain and check
- Pitot tube: cover REMOVED, unobstructed, no insects
- Fuel vent: unobstructed

**Left wing:**
- Aileron: freedom, hinge secure
- Flap: condition
- Wing leading edge: condition
- Wing tip: nav light

**Left main gear:**
- Tire: condition
- Gear leg: clean

**Back to cockpit — exterior complete.**

### Phase 5 — Before Engine Start
Category: `preflight`  
Items: Seat: ADJUSTED AND LOCKED, seatbelt FASTENED, rudder pedals ADJUSTED, doors LATCHED, windows CLOSED, parking brake SET, fuel selector FULLEST TANK, mixture RICH, throttle CRACKED (1/4 inch), master AVIONICS OFF, master ON, circuit breakers IN, beacon ON.

### Phase 6 — Engine Start
Category: `preflight`  
Items handle both cold and hot start:

**Cold start (normal):**
- Carb heat: COLD (OFF)
- Primer: 3–4 strokes (cold only, skip if warm)
- Fuel pump: ON
- "CLEAR PROP" — call out and verify area clear
- Ignition: START (release at fire, do not overheat starter)
- Throttle: idle smoothly
- Oil pressure: CHECK — must show in 30 seconds
- Fuel pump: OFF — confirm fuel pressure holds
- Throttle: 1000 RPM warm-up

**Hot start note:** Throttle FULL, mixture IDLE CUT-OFF, fuel pump OFF, crank — mixture to rich at fire, throttle back.

### Phase 7 — After Start
Category: `preflight`  
Items: Avionics master ON, radios ON and set, transponder ON STBY, lights as required, ammeter CHECK charging, oil temp/pressure GREEN.

### Phase 8 — Before Taxi
Category: `taxi`  
Items: ATIS obtained, altimeter SET (verify field elevation ±75 ft), DI aligned with compass, heading bug SET, altitude bug SET, GPS/nav SET destination, taxi clearance obtained (tower/CTAF), taxi route REVIEWED, brakes CHECK (tap and verify).

### Phase 9 — Taxi
Category: `taxi`  
Items: Taxi speed: walking pace on ramp / safe speed on taxiway, brakes TEST on first application, flight controls: INTO wind (aileron up into crosswind, elevator neutral or slightly back), instruments turning CHECK (TC/AI/compass).

### Phase 10 — Run-Up / Before Takeoff
Category: `takeoff`  
Items:
- Parking brake SET
- Flight controls FREE AND CORRECT (full travel check from inside)
- Engine instruments ALL GREEN
- Throttle 2000 RPM
- Carb heat ON — check 100–175 RPM drop, then OFF (RPM must recover to or above pre-test value; any ice indicated by RPM rise then back, or stuck reading means serious icing)
- Magnetos: L then R — max 175 RPM individual drop, max 50 RPM differential
- Ammeter CHECK (charging)
- Vacuum 5.0" Hg GREEN ARC
- Oil temp and pressure GREEN
- Throttle: IDLE CHECK (400–500 RPM), then 1000 RPM
- Fuel pump ON
- Mixture RICH
- Flaps SET (as desired for takeoff)
- Trim SET neutral/takeoff
- Heading bug SET runway heading
- Altitude bug SET target altitude
- Doors and windows LATCHED
- Seatbelts SECURE
- Brakes HOLD for runup, then release

### Phase 11 — Takeoff Brief
Category: `takeoff`  
Items: Engine failure below 300 ft AGL (land ahead, slight turn only), engine failure above 300 ft AGL (emergency landing field), Vr 55 KIAS, Vy 76 KIAS (Vx 64 KIAS obstacle), abort criteria (loss of power, abnormal indication, control issue), departure runway/heading/frequency.

### Phase 12 — Normal Takeoff
Category: `takeoff`  
Items: Fuel pump ON (verify), throttle FULL and SMOOTH, engine instruments CHECK at full power (oil, RPM ~2400), centerline tracking, Vr 55 KIAS — rotate smoothly, positive rate → pitch for Vy 76 KIAS (Vx 64 if obstacles), flaps UP when clear of obstacles and positive rate established, fuel pump OFF above 1000 ft AGL (check pressure holds).

### Phase 13 — Cruise Climb
Category: `cruise`  
Items: Climb power SET, mixture adjust for altitude (rich below 3000 ft, lean above for best power EGT), fuel tank alternate every 30 minutes, engine instruments monitor, outside scan.

### Phase 14 — Cruise
Category: `cruise`  
Items: Power SET (55–75%), mixture LEANED to peak EGT minus 50°F rich of peak (or pilot operating handbook procedure), fuel selector alternate tanks every 30 min, trim ADJUST, engine instruments confirm within limits, altimeter reset passing FL180 area boundary.

### Phase 15 — Descent / Before Landing (GUMPSS)
Category: `landing`  
Items:
- **G** — Gas: fuel pump ON, selector FULLEST TANK
- **U** — Undercarriage: FIXED — gear confirmed (habit building for future complex aircraft)
- **M** — Mixture: RICH
- **P** — Propeller: N/A fixed pitch
- **S** — Seatbelts: SECURE, lights: LANDING and TAXI as appropriate
- **S** — Speed/Switches: below Vfe before extending flaps (102 KIAS for first notch)
- ATIS: obtained, altimeter SET
- Flaps: extend in increments as airspeed permits

### Phase 16 — Normal Landing
Category: `landing`  
Items: Final approach 70–75 KIAS (full flaps), threshold 65 KIAS, round-out and hold, touchdown main wheels first, back pressure maintained, brakes after touchdown roll established, fuel pump OFF (after clear of runway and taxi speed).

### Phase 17 — Go-Around / Missed Approach
Category: `landing`  
Items: Throttle FULL AND SMOOTH, carb heat OFF (heat reduces power — off immediately at go-around), flaps RETRACT one notch immediately, establish positive climb attitude, flaps UP incrementally as airspeed and climb confirmed, Vy 76 KIAS, trim ADJUST, fuel pump ON (verify was on from GUMPSS), advise ATC.

### Phase 18 — After Landing / Taxi In
Category: `landing`  
Items: Flaps UP, trim NEUTRAL, carb heat OFF, fuel pump OFF, transponder STBY (1200 code), strobes OFF (wing strobes — anti-coll stays ON), mixture LEAN for ground ops, lights as required, taxi clearance.

### Phase 19 — Shutdown & Securing
Category: `shutdown`  
Items: Parking brake SET, radios OFF, electrical loads OFF, throttle IDLE (1000 RPM 2 min cool-down), mixture IDLE CUT-OFF (pull to lean stop, engine stops), magnetos OFF, master OFF, control lock INSTALL, Hobbs/tach recorded, fuel caps VERIFIED SECURE, tie-downs INSTALLED.

---

## Emergency Procedures (8 Missing — Add to Phases)

These are added as emergency-category phases:

1. **Engine Failure In-Flight** — establish Vg 76 KIAS glide, select field, fuel selector switch tanks, fuel pump ON, mixture rich, carb heat ON, ignition BOTH then START, mayday/squawk 7700, prepare for forced landing

2. **Engine Failure After Takeoff (Low Altitude)** — throttle idle, land ahead (avoid turn-back below 500 ft AGL), flaps as needed, carb heat OFF (no time for it)

3. **Engine Roughness / Partial Power Loss** — carb heat ON (30 seconds), fuel pump ON, switch tanks, mixture adjust, ignition both, check gauges; if no improvement: emergency

4. **Engine Fire In-Flight** — mixture IDLE CUT-OFF, fuel selector OFF, fuel pump OFF, throttle CLOSE, heat OFF, glide Vg 76 KIAS, forced landing, extinguisher if available post-landing

5. **Electrical Fire** — avionics master OFF, master OFF, extinguisher (halon if available), land as soon as practical; restore only essential electrical one at a time to identify source

6. **Alternator Failure** — reduce electrical load (avionics, lights), confirm alt switch ON, check circuit breaker, if no recovery: land soon (battery only — 30 min typical); nav lights, comm essentials only

7. **Loss of Oil Pressure** — reduce power, land as soon as possible; if pressure zero: engine failure imminent — execute forced landing

8. **Open Door In-Flight** — maintain aircraft control (door open does not affect controllability significantly), fly normal approach speed, do not chase door in turbulence, land normally, latch on ground

---

## Data Model Notes

- `severity: 'warning'` for all emergency items and safety-critical single-response items (e.g., fuel caps, master before magnetos)
- `severity: 'caution'` for items with conditional notes (carb heat check, oil pressure window)
- `note` field for cold vs. hot start context on engine start items
- referenceData: keep `'speeds'` kind for Vspeed table, update all values

---

## Piper Warrior Follow-On

After the Archer file is complete, apply corrected data to `piperWarrior.ts` (PA-28-161, Warrior II/III):
- Engine: Lycoming O-320-D3G, 160 HP, carbureted
- Vy: 79 KIAS, Vx: 63 KIAS, Vg: 73 KIAS, Va: 111 KIAS
- Same fuel system (LEFT/RIGHT/OFF, no BOTH)
- Same walk-around flow
- Same phase structure
- Carb heat, fuel pump procedures identical

---

## Files Changed

| File | Action |
|------|--------|
| `src/data/aircraft/piperArcher.ts` | Full rebuild (complete replacement of all content) |
| `src/data/aircraft/piperWarrior.ts` | Corrected V-speeds, engine description, carb heat, fuel pump |
