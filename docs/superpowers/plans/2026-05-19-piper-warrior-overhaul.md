# Piper Warrior PA-28-161 Phases Overhaul — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the sparse 11-phase `piperWarrior.ts` phases array with a comprehensive 24-phase structure (1 preflight + 15 operational + 8 emergency) matching the Archer II and C172S pattern.

**Architecture:** Surgical replacement — only the `phases: [...]` array is replaced. All other properties (id, name, manufacturer, specs, vSpeeds, referenceData) are preserved exactly as-is.

**Tech Stack:** TypeScript, Vite+React PWA. File: `src/data/aircraft/piperWarrior.ts`.

**Warrior-specific values (differ from Archer):**
- Best glide (Vg): **73 KIAS** (Archer: 76)
- Best rate of climb (Vy): **74 KIAS** (Archer: 76)
- Best angle of climb (Vx): **64 KIAS** (same)
- Magneto max individual drop: **150 RPM** (Archer: 175) — per Lycoming O-320
- Engine: **Lycoming O-320-D3G, 160 HP** (Archer: O-360-A4M, 180 HP)
- Fuel system: **LEFT/RIGHT/OFF** (no BOTH position — identical to Archer)
- Carb heat procedures: **identical to Archer**
- Fuel pump management: **identical to Archer**

---

### Task 1: Replace phases array — Operational Phases (preflight through shutdown)

**Files:**
- Modify: `src/data/aircraft/piperWarrior.ts` — replace `phases: [...]` array with 16 operational phases

- [ ] **Step 1: Read the file to confirm the insertion boundary**

```powershell
Select-String -Path src\data\aircraft\piperWarrior.ts -Pattern "phases:"
```

Expected: One match showing `phases: [` near line 233.

- [ ] **Step 2: Replace the entire phases array**

In `src/data/aircraft/piperWarrior.ts`, find and replace the entire `phases: [` block (from line ~233 to the closing `],` before the final `}`) with the following. Use the Write or Edit tool — the old phases array starts at `phases: [` and the file ends with two closing braces `}\n}\n`.

The new phases array (Task 1 covers phases 1–16, Task 2 will append emergencies):

```typescript
  phases: [
    {
      id: 'preflight',
      name: 'Preflight Inspection',
      category: 'preflight',
      items: [
        { id: 'pf-01', action: 'Pilot – IMSAFE', response: 'COMPLETE', note: 'Illness · Medication · Stress · Alcohol · Fatigue · Emotion/External pressures', severity: 'warning' },
        { id: 'pf-02', action: 'NWKRAFT check', response: 'COMPLETE', note: 'NOTAMs · Weather · Known ATC delays · Runway lengths · Alternates · Fuel · TFRs' },
        { id: 'pf-03', action: 'Weather', response: 'CURRENT AND FORECAST — winds, ceilings, icing, turbulence checked' },
        { id: 'pf-04', action: 'Weight & balance', response: 'COMPUTED — within limits', severity: 'warning' },
        { id: 'pf-05', action: 'Performance', response: 'COMPUTED — takeoff and landing distances for actual conditions' },
        { id: 'pf-06', action: 'Aircraft documents (ARROW)', response: 'ON BOARD — Airworthiness, Registration, Radio license, Operating handbook, Weight & balance', severity: 'warning' },
        { id: 'pf-07', action: 'Aircraft logbooks', response: 'CHECKED — annual, 100-hr, ELT current' },
        { id: 'pf-08', action: 'Transponder / altimeter', response: 'CURRENT — checked within 24 calendar months', severity: 'caution' },
        { id: 'pf-09', action: 'Hobbs / tach', response: 'RECORD — time in' },
        { id: 'pf-10', action: 'Control lock', response: 'REMOVE' },
        { id: 'pf-11', action: 'Ignition', response: 'OFF — keys out', severity: 'warning' },
        { id: 'pf-12', action: 'Master switch', response: 'ON briefly — check fuel gauges, then OFF' },
        { id: 'pf-13', action: 'Fuel gauges', response: 'NOTE QUANTITY — cross-check against visual during walk-around' },
        { id: 'pf-14', action: 'Avionics master', response: 'OFF' },
        { id: 'pf-15', action: 'Circuit breakers', response: 'ALL IN' },
        { id: 'pf-16', action: 'Fire extinguisher', response: 'PRESENT AND CHARGED' },
        { id: 'pf-17', action: 'ELT', response: 'ARMED' },
        { id: 'pf-18', action: 'Left cabin door', response: 'CONDITION — latches operate, window secure' },
        { id: 'pf-19', action: 'Left fuselage', response: 'CONDITION — no dents, cracks, or loose panels' },
        { id: 'pf-20', action: 'Static ports (left)', response: 'CLEAR — unobstructed' },
        { id: 'pf-21', action: 'Antennas', response: 'SECURE' },
        { id: 'pf-22', action: 'Left horizontal stabilizer', response: 'CONDITION — leading edge, surface' },
        { id: 'pf-23', action: 'Left elevator', response: 'FREE — full travel, hinge pins secure' },
        { id: 'pf-24', action: 'Elevator trim tab', response: 'SECURE — no excessive play' },
        { id: 'pf-25', action: 'Vertical stabilizer', response: 'CONDITION — no deformation' },
        { id: 'pf-26', action: 'Rudder', response: 'FREE — full travel, hinge pins, no slop' },
        { id: 'pf-27', action: 'Tail tie-down', response: 'REMOVED', severity: 'warning' },
        { id: 'pf-28', action: 'Right horizontal stabilizer', response: 'CONDITION — leading edge, surface' },
        { id: 'pf-29', action: 'Right elevator', response: 'FREE — full travel, hinge pins secure' },
        { id: 'pf-30', action: 'Right fuselage', response: 'CONDITION' },
        { id: 'pf-31', action: 'Static ports (right)', response: 'CLEAR — unobstructed' },
        { id: 'pf-32', action: 'Right wing tip', response: 'CONDITION — nav light secure' },
        { id: 'pf-33', action: 'Right aileron', response: 'FREE — full travel, hinge pins, pushrod secure' },
        { id: 'pf-34', action: 'Right flap', response: 'CONDITION — hinge pins secure' },
        { id: 'pf-35', action: 'Right wing leading edge', response: 'CONDITION — no deformation, ice, or damage' },
        {
          id: 'pf-36',
          action: 'Right fuel cap',
          response: 'REMOVE — visual check (blue = 100LL), RE-SECURE FIRMLY',
          severity: 'warning',
          note: 'Low-wing: loose fuel cap causes inflight siphoning. Confirm locked.',
        },
        { id: 'pf-37', action: 'Right fuel quick-drain', response: 'DRAIN — sample into tester; check for water/sediment; blue = 100LL', severity: 'warning' },
        { id: 'pf-38', action: 'Right fuel vent', response: 'CLEAR — unobstructed (underside leading edge)' },
        { id: 'pf-39', action: 'Right main gear', response: 'TIRE inflated, no flat; gear leg clean' },
        { id: 'pf-40', action: 'Propeller', response: 'CONDITION — no nicks, cracks, corrosion; spinner secure', severity: 'warning' },
        { id: 'pf-41', action: 'Air filter', response: 'CHECK — unobstructed, no bugs or debris' },
        { id: 'pf-42', action: 'Engine cowling', response: 'SECURE — all latches engaged' },
        { id: 'pf-43', action: 'Oil level', response: 'CHECK — 5 qt minimum for flight, 8 qt full; cap secure', severity: 'warning' },
        { id: 'pf-44', action: 'Engine compartment', response: 'NO LEAKS — oil, fuel, or hydraulic staining' },
        { id: 'pf-45', action: 'Nose gear', response: 'STRUT inflated, tire condition, shimmy dampener secure' },
        { id: 'pf-46', action: 'Left fuel quick-drain', response: 'DRAIN — sample into tester; check for water/sediment', severity: 'warning' },
        { id: 'pf-47', action: 'Left fuel cap', response: 'REMOVE — visual check, RE-SECURE FIRMLY', severity: 'warning' },
        { id: 'pf-48', action: 'Left fuel vent', response: 'CLEAR — unobstructed' },
        { id: 'pf-49', action: 'Pitot tube', response: 'COVER REMOVED — clear, no obstructions, no insects', severity: 'warning' },
        { id: 'pf-50', action: 'Stall warning vane', response: 'FREE — gently lift to verify horn sounds', severity: 'caution' },
        { id: 'pf-51', action: 'Left wing leading edge', response: 'CONDITION — no deformation, ice, or damage' },
        { id: 'pf-52', action: 'Left flap', response: 'CONDITION — hinge pins secure' },
        { id: 'pf-53', action: 'Left aileron', response: 'FREE — full travel, hinge pins, pushrod secure' },
        { id: 'pf-54', action: 'Left wing tip', response: 'CONDITION — nav light secure' },
        { id: 'pf-55', action: 'Left main gear', response: 'TIRE inflated, no flat; gear leg clean, brake line' },
        { id: 'pf-56', action: 'Wing tie-downs', response: 'BOTH REMOVED', severity: 'warning' },
      ],
    },
    {
      id: 'before-start',
      name: 'Before Engine Start',
      category: 'startup',
      items: [
        { id: 'bs-01', action: 'Passenger briefing (SAFETY)', response: 'COMPLETE — seatbelts, exits, fire ext, sterile cockpit' },
        {
          id: 'bs-02',
          action: 'Seats',
          response: 'ADJUSTED AND LOCKED — verify seat rails engaged',
          severity: 'warning',
        },
        { id: 'bs-03', action: 'Seatbelts', response: 'FASTENED — all occupants' },
        { id: 'bs-04', action: 'Rudder pedals', response: 'ADJUSTED' },
        { id: 'bs-05', action: 'Doors and windows', response: 'CLOSED AND LATCHED' },
        { id: 'bs-06', action: 'Parking brake', response: 'SET' },
        {
          id: 'bs-07',
          action: 'Fuel selector',
          response: 'FULLEST TANK — LEFT or RIGHT, not OFF',
          severity: 'warning',
          note: 'No BOTH position on Warrior. Select the fullest tank for start and takeoff.',
        },
        { id: 'bs-08', action: 'Mixture', response: 'RICH' },
        { id: 'bs-09', action: 'Throttle', response: 'CRACKED — 1/4 inch open' },
        { id: 'bs-10', action: 'Avionics master', response: 'OFF' },
        { id: 'bs-11', action: 'Master switch (BAT)', response: 'ON' },
        { id: 'bs-12', action: 'Circuit breakers', response: 'ALL IN' },
        { id: 'bs-13', action: 'Beacon', response: 'ON' },
      ],
    },
    {
      id: 'engine-start',
      name: 'Engine Start',
      category: 'startup',
      items: [
        {
          id: 'es-01',
          action: 'Carb heat',
          response: 'COLD (OFF)',
          note: 'Carb heat reduces mixture richness — always OFF before cranking',
        },
        {
          id: 'es-02',
          action: 'Primer',
          response: 'COLD: 2–4 strokes · WARM: 1–2 · HOT: 0 — IN AND LOCKED',
          severity: 'caution',
          note: 'Lock primer fully — unlocked primer causes rough running or no-start',
        },
        { id: 'es-03', action: 'Fuel pump', response: 'ON' },
        {
          id: 'es-04',
          action: '"CLEAR PROP!"',
          response: 'CALL OUT — visually verify area clear both sides',
          severity: 'warning',
        },
        { id: 'es-05', action: 'Ignition', response: 'START — release key at first fire' },
        {
          id: 'es-06',
          action: 'Throttle',
          response: 'SET 1000 RPM warm-up',
          note: 'HOT START: throttle full, mixture IDLE CUT-OFF, fuel pump OFF, crank — mixture to RICH at fire, throttle back',
        },
        {
          id: 'es-07',
          action: 'Oil pressure',
          response: 'CHECK — must show within 30 seconds',
          severity: 'warning',
        },
        { id: 'es-08', action: 'Alternator', response: 'ON' },
        {
          id: 'es-09',
          action: 'Fuel pump',
          response: 'OFF — verify fuel pressure holds',
          severity: 'caution',
          note: 'If pressure drops when fuel pump OFF, keep pump ON and investigate before flight',
        },
        { id: 'es-10', action: 'Avionics master', response: 'ON' },
        { id: 'es-11', action: 'Engine gauges', response: 'CHECK — oil temp rising, all in green' },
      ],
    },
    {
      id: 'after-start',
      name: 'After Start',
      category: 'startup',
      items: [
        { id: 'as-01', action: 'Radios', response: 'ON — ATIS, ground/CTAF frequency set' },
        { id: 'as-02', action: 'Transponder', response: 'STBY' },
        { id: 'as-03', action: 'Lights', response: 'AS REQUIRED — nav lights if dusk or dark' },
        { id: 'as-04', action: 'Ammeter', response: 'CHECK — showing charge' },
        { id: 'as-05', action: 'Suction gauge', response: 'CHECK — 4.8–5.1 inHg' },
        { id: 'as-06', action: 'Throttle', response: 'WARM-UP at 1000 RPM — oil temp in green before run-up' },
      ],
    },
    {
      id: 'before-taxi',
      name: 'Before Taxi',
      category: 'taxi',
      items: [
        { id: 'bt-01', action: 'ATIS', response: 'COPIED — QNH, active runway, wind' },
        { id: 'bt-02', action: 'Altimeter', response: 'SET — verify field elevation ±75 ft' },
        { id: 'bt-03', action: 'DI / heading indicator', response: 'ALIGNED with compass' },
        { id: 'bt-04', action: 'Heading bug', response: 'SET — departure runway heading' },
        { id: 'bt-05', action: 'Altitude bug', response: 'SET — initial target altitude' },
        { id: 'bt-06', action: 'GPS / Nav', response: 'SET — destination entered, route verified' },
        { id: 'bt-07', action: 'Taxi clearance', response: 'OBTAINED — route reviewed, hotspots noted' },
        { id: 'bt-08', action: 'Brakes', response: 'TEST — brief application before moving' },
        { id: 'bt-09', action: 'Taxi route', response: 'REVIEWED — hold short lines and runway crossings identified' },
      ],
    },
    {
      id: 'taxi',
      name: 'Taxi',
      category: 'taxi',
      items: [
        { id: 'tx-01', action: 'Taxi speed', response: 'WALKING PACE on ramp / controlled speed on taxiway' },
        { id: 'tx-02', action: 'Brakes', response: 'TEST — brief application, verify effectiveness' },
        {
          id: 'tx-03',
          action: 'Flight controls — crosswind',
          response: 'INTO wind (aileron toward wind, elevator as required)',
          severity: 'caution',
        },
        { id: 'tx-04', action: 'Turn coordinator', response: 'CHECK — correct direction during turns' },
        { id: 'tx-05', action: 'AI / attitude indicator', response: 'STABLE — no flag or unusual precession' },
        { id: 'tx-06', action: 'DI / heading indicator', response: 'TRACKING — verify matches compass through turns' },
        { id: 'tx-07', action: 'Hold short lines', response: 'DO NOT CROSS without clearance', severity: 'warning' },
      ],
    },
    {
      id: 'runup',
      name: 'Run-Up / Before Takeoff',
      category: 'runup',
      items: [
        { id: 'ru-01', action: 'Parking brake', response: 'SET' },
        { id: 'ru-02', action: 'Flight controls', response: 'FREE AND CORRECT — full travel check' },
        { id: 'ru-03', action: 'Fuel selector', response: 'FULLEST TANK' },
        { id: 'ru-04', action: 'Mixture', response: 'RICH (or as altitude requires)' },
        { id: 'ru-05', action: 'Engine instruments', response: 'ALL GREEN — oil temp/pressure before high power' },
        { id: 'ru-06', action: 'Throttle', response: '2000 RPM' },
        {
          id: 'ru-07',
          action: 'Carb heat',
          response: 'ON — check RPM drop 100–175 RPM, then OFF',
          severity: 'warning',
          note: 'Drop then full recovery = no ice. Rise then drop to pre-test = ice cleared. No drop at all = suspect gauge.',
        },
        {
          id: 'ru-08',
          action: 'Magnetos',
          response: 'L then BOTH then R — max 150 RPM drop; max 50 RPM differential',
          severity: 'caution',
          note: 'If drop exceeds 150 RPM or differential exceeds 50 RPM, do not take off.',
        },
        { id: 'ru-09', action: 'Ammeter', response: 'CHECK — showing charge' },
        { id: 'ru-10', action: 'Vacuum / suction', response: '4.8–5.1 inHg — GREEN ARC' },
        { id: 'ru-11', action: 'Engine instruments', response: 'ALL GREEN' },
        { id: 'ru-12', action: 'Throttle', response: 'IDLE CHECK — 400–500 RPM smooth, then set 1000 RPM' },
        { id: 'ru-13', action: 'Fuel pump', response: 'ON' },
        { id: 'ru-14', action: 'Flaps', response: 'SET — 0° normal / 25° short or soft field' },
        { id: 'ru-15', action: 'Trim', response: 'NEUTRAL / SET FOR TAKEOFF' },
        { id: 'ru-16', action: 'Heading bug', response: 'SET — runway heading' },
        { id: 'ru-17', action: 'Altitude bug', response: 'SET — target altitude' },
        { id: 'ru-18', action: 'Doors and windows', response: 'CLOSED AND LATCHED' },
        { id: 'ru-19', action: 'Seatbelts', response: 'ALL SECURE' },
        { id: 'ru-20', action: 'Transponder', response: 'ALT' },
        { id: 'ru-21', action: 'Lights', response: 'ALL ON — strobes, landing light, nav' },
      ],
    },
    {
      id: 'takeoff-brief',
      name: 'Takeoff Brief',
      category: 'takeoff',
      items: [
        { id: 'tb-01', action: 'Runway', response: 'CONFIRM — correct runway, condition, clear', severity: 'warning' },
        {
          id: 'tb-02',
          action: 'Engine failure below 300 ft AGL',
          response: 'LAND AHEAD — no turn-back; slight turn only to avoid obstacles',
          severity: 'warning',
        },
        {
          id: 'tb-03',
          action: 'Engine failure above 300 ft AGL',
          response: 'EMERGENCY LANDING FIELD — identify now; 360° return only if >1000 ft',
          severity: 'caution',
        },
        { id: 'tb-04', action: 'Abort criteria', response: 'LOSS of power, abnormal gauge, control issue — reject before Vr' },
        { id: 'tb-05', action: 'Rotation speed', response: 'Vr 55 KIAS' },
        { id: 'tb-06', action: 'Climb speed', response: 'Vy 74 KIAS — obstacle: Vx 64 KIAS' },
        { id: 'tb-07', action: 'Departure heading and frequency', response: 'REVIEWED' },
        { id: 'tb-08', action: 'Emergency landing area', response: 'IDENTIFIED', severity: 'caution' },
      ],
    },
    {
      id: 'normal-takeoff',
      name: 'Normal Takeoff',
      category: 'takeoff',
      items: [
        { id: 'nt-01', action: 'Fuel pump', response: 'ON — confirm before rolling' },
        { id: 'nt-02', action: 'Throttle', response: 'FULL AND SMOOTH — check RPM (~2300 at full power)' },
        { id: 'nt-03', action: 'Engine instruments at full power', response: 'SCAN — oil pressure, RPM, airspeed alive' },
        { id: 'nt-04', action: 'Directional control', response: 'RUDDER — maintain centerline' },
        { id: 'nt-05', action: 'Rotation', response: 'Vr 55 KIAS — smooth back pressure, 10° nose-up attitude' },
        { id: 'nt-06', action: 'Positive rate', response: 'CONFIRM — VSI and altimeter both increasing' },
        { id: 'nt-07', action: 'Pitch for Vy', response: '74 KIAS — obstacle: Vx 64 KIAS until clear' },
        { id: 'nt-08', action: 'Flaps', response: 'RETRACT — incrementally after clear of obstacles, positive rate' },
        {
          id: 'nt-09',
          action: 'Fuel pump',
          response: 'OFF above 1000 ft AGL — check pressure holds',
          severity: 'caution',
          note: 'If pressure drops when pump OFF, leave ON and investigate after landing.',
        },
      ],
    },
    {
      id: 'cruise-climb',
      name: 'Cruise Climb',
      category: 'climb',
      items: [
        { id: 'cc-01', action: 'Airspeed', response: 'Vy 74 KIAS — or cruise climb ~85 KIAS for engine cooling' },
        { id: 'cc-02', action: 'Engine instruments', response: 'MONITOR — oil temp, oil pressure, ammeter' },
        { id: 'cc-03', action: 'Mixture', response: 'RICH below 3000 ft DA — lean above for best power' },
        { id: 'cc-04', action: 'Fuel selector', response: 'FULLEST TANK — note time for tank alternation' },
        { id: 'cc-05', action: 'Traffic', response: 'SCAN — clear area at level-off' },
      ],
    },
    {
      id: 'cruise',
      name: 'Cruise',
      category: 'cruise',
      items: [
        { id: 'cr-01', action: 'Power', response: 'SET — 55–75% (refer to POH cruise tables)' },
        { id: 'cr-02', action: 'Mixture', response: 'LEAN — peak EGT minus 50°F rich of peak, or by RPM method' },
        {
          id: 'cr-03',
          action: 'Fuel selector',
          response: 'ALTERNATE TANKS every 30 min — LEFT / RIGHT / LEFT…',
          severity: 'caution',
        },
        { id: 'cr-04', action: 'Engine gauges', response: 'MONITOR — oil temp, oil pressure, ammeter within limits' },
        { id: 'cr-05', action: 'Fuel quantity', response: 'CHECK — time remaining vs. flight plan' },
        { id: 'cr-06', action: 'Altimeter', response: 'CHECK — new QNH as needed' },
        { id: 'cr-07', action: 'Weather', response: 'MONITOR — update ATIS/AWOS as needed' },
        { id: 'cr-08', action: 'Position', response: 'CROSS-CHECK — GPS track vs. planned route' },
      ],
    },
    {
      id: 'descent',
      name: 'Descent / Before Landing',
      category: 'descent',
      items: [
        { id: 'de-01', action: 'ATIS', response: 'COPIED — QNH, active runway, wind, NOTAMs' },
        { id: 'de-02', action: 'Altimeter', response: 'SET — destination QNH; verify field elevation check' },
        { id: 'de-03', action: 'Approach brief', response: 'COMPLETE — runway, pattern entry, go-around plan' },
        { id: 'de-04', action: 'G — Gas', response: 'FUEL PUMP ON; selector FULLEST TANK', severity: 'warning' },
        { id: 'de-05', action: 'U — Undercarriage', response: 'FIXED GEAR — verbalize "three green" for habit building' },
        { id: 'de-06', action: 'M — Mixture', response: 'RICH' },
        { id: 'de-07', action: 'P — Propeller', response: 'FIXED PITCH — N/A' },
        { id: 'de-08', action: 'S — Seatbelts / Switches', response: 'SEATBELTS SECURE; landing light ON' },
        {
          id: 'de-09',
          action: 'S — Speed',
          response: 'BELOW Vfe before flaps — 102 KIAS for first notch (0–25°)',
          severity: 'caution',
        },
        {
          id: 'de-10',
          action: 'Carb heat',
          response: 'AS REQUIRED — ON if icing conditions suspected',
          severity: 'caution',
          note: 'Visible moisture, OAT ≤10°C, or rough engine in descent = carb heat ON',
        },
        { id: 'de-11', action: 'Flaps', response: 'EXTEND in increments — 0°, 25°, 40° as speed permits' },
      ],
    },
    {
      id: 'normal-landing',
      name: 'Normal Landing',
      category: 'landing',
      items: [
        { id: 'la-01', action: 'Final approach speed', response: '70–75 KIAS full flaps (adjust for weight and wind)' },
        { id: 'la-02', action: 'Threshold speed', response: '65 KIAS over threshold — reduce on round-out' },
        { id: 'la-03', action: 'Round-out and flare', response: 'HOLD — back pressure, reduce power smoothly to idle' },
        { id: 'la-04', action: 'Touchdown', response: 'MAIN WHEELS FIRST — slight nose-high, on centerline' },
        { id: 'la-05', action: 'Roll-out', response: 'RUDDER for directional control, back pressure maintained' },
        { id: 'la-06', action: 'Brakes', response: 'SMOOTH and EVEN — after roll-out established' },
        { id: 'la-07', action: 'Clear runway', response: 'EXIT at taxiway speed — positively clear hold short line' },
      ],
    },
    {
      id: 'go-around',
      name: 'Go-Around / Missed Approach',
      category: 'landing',
      items: [
        { id: 'ga-01', action: 'Throttle', response: 'FULL AND SMOOTH', severity: 'warning' },
        {
          id: 'ga-02',
          action: 'Carb heat',
          response: 'OFF IMMEDIATELY',
          severity: 'warning',
          note: 'Carb heat reduces power — OFF at the same moment as full throttle.',
        },
        { id: 'ga-03', action: 'Flaps', response: 'RETRACT one notch (40° → 25°) — do not fully retract at low speed' },
        { id: 'ga-04', action: 'Pitch', response: 'ESTABLISH positive climb attitude — Vx 64 KIAS initially' },
        { id: 'ga-05', action: 'Positive rate', response: 'CONFIRM VSI climbing — flaps UP incrementally' },
        { id: 'ga-06', action: 'Airspeed', response: 'Vy 74 KIAS after flaps up' },
        { id: 'ga-07', action: 'Fuel pump', response: 'VERIFY ON' },
        { id: 'ga-08', action: 'Trim', response: 'ADJUST for climb' },
        { id: 'ga-09', action: 'ATC / CTAF', response: 'ADVISE — "going around"' },
      ],
    },
    {
      id: 'after-landing',
      name: 'After Landing / Taxi In',
      category: 'landing',
      items: [
        { id: 'al-01', action: 'Flaps', response: 'UP' },
        { id: 'al-02', action: 'Trim', response: 'NEUTRAL' },
        { id: 'al-03', action: 'Carb heat', response: 'OFF' },
        { id: 'al-04', action: 'Fuel pump', response: 'OFF' },
        { id: 'al-05', action: 'Transponder', response: 'STBY (1200 code)' },
        { id: 'al-06', action: 'Wing strobes', response: 'OFF', note: 'Anti-collision beacon remains ON' },
        { id: 'al-07', action: 'Landing light', response: 'OFF — or on for taxi visibility as required' },
        { id: 'al-08', action: 'Mixture', response: 'LEAN for taxi — prevents plug fouling' },
        { id: 'al-09', action: 'Taxi clearance', response: 'OBTAIN or self-announce on CTAF' },
      ],
    },
    {
      id: 'shutdown',
      name: 'Shutdown & Securing',
      category: 'shutdown',
      items: [
        { id: 'sd-01', action: 'Parking brake', response: 'SET' },
        { id: 'sd-02', action: 'Radios and avionics', response: 'OFF' },
        { id: 'sd-03', action: 'Lights', response: 'OFF' },
        {
          id: 'sd-04',
          action: 'Throttle',
          response: 'IDLE — 1000 RPM, 2 min cool-down',
          note: 'Allow CHTs to stabilize before shutdown — prevents shock cooling',
        },
        {
          id: 'sd-05',
          action: 'Mixture',
          response: 'IDLE CUT-OFF — engine stops',
          severity: 'warning',
          note: 'Always stop engine with mixture, not ignition',
        },
        { id: 'sd-06', action: 'Magnetos', response: 'OFF — key out' },
        { id: 'sd-07', action: 'Alternator', response: 'OFF' },
        { id: 'sd-08', action: 'Master switch', response: 'OFF' },
        { id: 'sd-09', action: 'Fuel selector', response: 'OFF' },
        { id: 'sd-10', action: 'Control lock', response: 'INSTALL' },
        { id: 'sd-11', action: 'Pitot cover', response: 'INSTALL' },
        { id: 'sd-12', action: 'Hobbs / tach', response: 'RECORD — time out' },
        { id: 'sd-13', action: 'Fuel caps', response: 'VERIFY SECURE — both wings', severity: 'warning' },
        { id: 'sd-14', action: 'Tie-downs', response: 'INSTALL — wings and tail' },
        { id: 'sd-15', action: 'Chocks', response: 'IN — if required by ramp' },
      ],
    },
```

- [ ] **Step 3: Build and verify**

```powershell
npm run build 2>&1 | Select-String -Pattern "error|warning" | Select-Object -First 20
```

Expected: Zero TypeScript errors. Zero build errors.

- [ ] **Step 4: Commit**

```bash
git add src/data/aircraft/piperWarrior.ts
git commit -m "feat(warrior): overhaul operational phases — add 16 comprehensive phases matching Archer/C172S structure"
```

---

### Task 2: Append 8 Emergency Phases

**Files:**
- Modify: `src/data/aircraft/piperWarrior.ts` — append 8 emergency phases to the phases array (after the shutdown phase, before the closing `],`)

- [ ] **Step 1: Append emergency phases**

After the shutdown phase closing brace (`},`) and before the final `],\n}`, add:

```typescript
    {
      id: 'emergency-engine-failure',
      name: 'Engine Failure In-Flight',
      category: 'emergency',
      items: [
        { id: 'ef-01', action: 'Best glide', response: 'ESTABLISH — 73 KIAS', severity: 'warning' },
        { id: 'ef-02', action: 'Landing area', response: 'SELECT — within glide range, into wind if possible' },
        { id: 'ef-03', action: 'Fuel selector', response: 'SWITCH TANKS — fullest or other tank' },
        { id: 'ef-04', action: 'Fuel pump', response: 'ON' },
        { id: 'ef-05', action: 'Mixture', response: 'RICH' },
        { id: 'ef-06', action: 'Carb heat', response: 'ON — check for carb ice', severity: 'caution' },
        { id: 'ef-07', action: 'Throttle', response: 'FULL' },
        { id: 'ef-08', action: 'Ignition', response: 'BOTH — then START if not restarting' },
        { id: 'ef-09', action: 'Primer', response: 'IN AND LOCKED' },
        { id: 'ef-10', action: 'Squawk 7700', response: 'SET', severity: 'warning' },
        { id: 'ef-11', action: 'MAYDAY — 121.5 MHz', response: 'TRANSMIT — position, altitude, intentions', severity: 'warning' },
        { id: 'ef-12', action: 'Prepare for landing', response: 'FLAPS as required; master and fuel OFF before touchdown' },
      ],
    },
    {
      id: 'emergency-engine-failure-takeoff',
      name: 'Engine Failure After Takeoff',
      category: 'emergency',
      items: [
        { id: 'efat-01', action: 'LAND AHEAD', response: 'MAINTAIN CONTROL — no turn-back below 500 ft AGL', severity: 'warning' },
        { id: 'efat-02', action: 'Throttle', response: 'IDLE' },
        { id: 'efat-03', action: 'Best glide', response: '73 KIAS' },
        { id: 'efat-04', action: 'Flaps', response: 'AS REQUIRED for terrain' },
        { id: 'efat-05', action: 'Master and fuel', response: 'OFF before touchdown' },
        { id: 'efat-06', action: 'Doors', response: 'UNLATCH before touchdown — prevents jamming on impact' },
      ],
    },
    {
      id: 'emergency-engine-roughness',
      name: 'Engine Roughness / Partial Power',
      category: 'emergency',
      items: [
        {
          id: 'er-01',
          action: 'Carb heat',
          response: 'ON — hold 30 seconds, monitor RPM',
          severity: 'warning',
          note: 'RPM rises then returns to smooth = ice was present and cleared. Normal.',
        },
        { id: 'er-02', action: 'Fuel pump', response: 'ON' },
        { id: 'er-03', action: 'Fuel selector', response: 'SWITCH TANKS' },
        { id: 'er-04', action: 'Mixture', response: 'ADJUST — try rich, then slightly lean' },
        { id: 'er-05', action: 'Ignition', response: 'CHECK — cycle BOTH, L, BOTH, R, BOTH' },
        { id: 'er-06', action: 'Engine gauges', response: 'CHECK — oil pressure, oil temp, fuel pressure' },
        { id: 'er-07', action: 'If no improvement', response: 'DIVERT — land as soon as practical', severity: 'caution' },
      ],
    },
    {
      id: 'emergency-engine-fire',
      name: 'Engine Fire In-Flight',
      category: 'emergency',
      items: [
        { id: 'enf-01', action: 'Mixture', response: 'IDLE CUT-OFF', severity: 'warning' },
        { id: 'enf-02', action: 'Fuel selector', response: 'OFF', severity: 'warning' },
        { id: 'enf-03', action: 'Fuel pump', response: 'OFF' },
        { id: 'enf-04', action: 'Throttle', response: 'CLOSE' },
        { id: 'enf-05', action: 'Heater and vents', response: 'OFF — avoid feeding fire' },
        { id: 'enf-06', action: 'Best glide', response: '73 KIAS — select emergency landing area' },
        { id: 'enf-07', action: 'Airspeed', response: 'INCREASE if fire persists — airflow may extinguish' },
        { id: 'enf-08', action: 'Mayday', response: 'SQUAWK 7700, transmit on 121.5', severity: 'warning' },
        { id: 'enf-09', action: 'Forced landing', response: 'EXECUTE — master OFF before touchdown' },
      ],
    },
    {
      id: 'emergency-electrical-fire',
      name: 'Electrical Fire',
      category: 'emergency',
      items: [
        { id: 'elef-01', action: 'Avionics master', response: 'OFF', severity: 'warning' },
        { id: 'elef-02', action: 'All electrical switches', response: 'OFF' },
        { id: 'elef-03', action: 'Master switch', response: 'OFF', severity: 'warning' },
        { id: 'elef-04', action: 'Vents / fresh air', response: 'OPEN — ventilate cockpit' },
        { id: 'elef-05', action: 'Fire extinguisher', response: 'USE if fire visible and accessible' },
        { id: 'elef-06', action: 'Land as soon as practical', response: 'RESTORE only essential electrics one at a time to identify source', severity: 'caution' },
      ],
    },
    {
      id: 'emergency-alternator-failure',
      name: 'Alternator Failure',
      category: 'emergency',
      items: [
        { id: 'af-01', action: 'Identify', response: 'AMMETER discharging; ALT WARN light ON', severity: 'warning' },
        { id: 'af-02', action: 'Alternator switch', response: 'CYCLE OFF then ON — check ammeter' },
        { id: 'af-03', action: 'Circuit breaker', response: 'CHECK — alt breaker; reset once if tripped' },
        { id: 'af-04', action: 'Electrical load', response: 'REDUCE — avionics off, lights off; essentials only' },
        {
          id: 'af-05',
          action: 'Battery time',
          response: 'ESTIMATE — ~30 min on battery alone; plan accordingly',
          severity: 'caution',
        },
        { id: 'af-06', action: 'Divert', response: 'LAND AS SOON AS PRACTICAL — before battery exhausted' },
      ],
    },
    {
      id: 'emergency-oil-pressure',
      name: 'Loss of Oil Pressure',
      category: 'emergency',
      items: [
        { id: 'lop-01', action: 'Oil pressure gauge', response: 'CONFIRM — low or zero reading', severity: 'warning' },
        { id: 'lop-02', action: 'Oil temperature', response: 'CHECK — rising confirms actual oil loss vs. gauge failure' },
        { id: 'lop-03', action: 'Power', response: 'REDUCE — lower power reduces engine stress' },
        {
          id: 'lop-04',
          action: 'Land immediately',
          response: 'SELECT NEAREST SUITABLE FIELD — engine seizure may be imminent',
          severity: 'warning',
        },
        { id: 'lop-05', action: 'Mayday', response: 'SQUAWK 7700, transmit if time permits' },
      ],
    },
    {
      id: 'emergency-open-door',
      name: 'Open Door In-Flight',
      category: 'emergency',
      items: [
        {
          id: 'od-01',
          action: 'Maintain aircraft control',
          response: 'FLY THE AIRPLANE — open door does not significantly affect controllability',
          severity: 'warning',
        },
        { id: 'od-02', action: 'Airspeed', response: 'MAINTAIN normal approach speed — door drag is minor' },
        { id: 'od-03', action: 'Door latch', response: 'ATTEMPT re-latch only if safe (not PIC during critical phase)' },
        { id: 'od-04', action: 'Land normally', response: 'CONTINUE normal pattern and landing — latch on ground' },
      ],
    },
  ],
```

- [ ] **Step 2: Build and verify**

```powershell
npm run build 2>&1 | Select-String -Pattern "error|warning" | Select-Object -First 20
```

Expected: Zero TypeScript errors. Zero build errors.

- [ ] **Step 3: Commit**

```bash
git add src/data/aircraft/piperWarrior.ts
git commit -m "feat(warrior): add 8 emergency procedures matching Archer structure (Vg 73 KIAS)"
```

---

## Spec Compliance Checklist

After both tasks complete, verify:
- [ ] 24 total phases (16 operational + 8 emergency)
- [ ] Single preflight phase with 56 items (pf-01 through pf-56)
- [ ] Vy = 74 KIAS everywhere (not 76 — that's the Archer)
- [ ] Vg = 73 KIAS everywhere (not 76 — that's the Archer)
- [ ] Magnetos: "max 150 RPM drop; max 50 RPM differential" (not 175)
- [ ] Fuel pump: ON for start/takeoff/landing, OFF in cruise with pressure check
- [ ] Carb heat: ON at run-up, OFF IMMEDIATELY at go-around (severity: 'warning')
- [ ] Fuel selector notes say "No BOTH position on Warrior"
- [ ] All existing referenceData preserved (maneuvers, IMSAFE, NWKRAFT, etc.)
- [ ] All existing vSpeeds preserved
