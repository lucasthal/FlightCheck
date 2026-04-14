import type { Aircraft } from '../../types'

export const piperWarrior: Aircraft = {
  id: 'piper-warrior-iii',
  name: 'Piper PA-28-161 Warrior III',
  manufacturer: 'Piper',
  model: 'PA-28-161',
  category: 'SEP',
  description: 'Widely used four-seat trainer and rental aircraft. Tapered wing Warrior is docile and forgiving — ideal for PPL and instrument training.',
  specs: {
    engines: 1,
    engineType: 'Lycoming O-320-D3G (160 HP)',
    maxSpeed: '120 KTAS',
    range: '440 NM',
    ceiling: '11,000 ft',
    seats: 4,
  },
  phases: [
    {
      id: 'preflight', name: 'Preflight Inspection', category: 'preflight',
      items: [
        { id: 'pf-01', action: 'Aircraft documents (AROW)', response: 'CHECK' },
        { id: 'pf-02', action: 'Fuel quantity', response: 'CHECK — 50 gal total, 48 usable' },
        { id: 'pf-03', action: 'Fuel drains (6 locations)', response: 'DRAIN — check for water', severity: 'warning' },
        { id: 'pf-04', action: 'Oil quantity', response: 'CHECK — 6–8 qts (min 5 qts)' },
        { id: 'pf-05', action: 'Propeller', response: 'CHECK — nicks, cracks', severity: 'warning' },
        { id: 'pf-06', action: 'Engine cowling', response: 'LATCHED' },
        { id: 'pf-07', action: 'Nose gear', response: 'CHECK — inflation, shimmy' },
        { id: 'pf-08', action: 'Main gear / brakes', response: 'CHECK — tires, fluid' },
        { id: 'pf-09', action: 'Pitot tube', response: 'REMOVE cover, check clear' },
        { id: 'pf-10', action: 'Stall warning', response: 'CHECK — blow test' },
        { id: 'pf-11', action: 'Fuel vents (under wing)', response: 'CHECK — clear, not blocked' },
        { id: 'pf-12', action: 'Control surfaces', response: 'FREE & CORRECT' },
        { id: 'pf-13', action: 'Flaps', response: 'EXTEND & INSPECT' },
        { id: 'pf-14', action: 'ELT', response: 'ARMED' },
        { id: 'pf-15', action: 'Tie-downs', response: 'REMOVE' },
      ],
    },
    {
      id: 'before-start', name: 'Before Engine Start', category: 'startup',
      items: [
        { id: 'bs-01', action: 'Seats / belts', response: 'ADJUSTED & LOCKED' },
        { id: 'bs-02', action: 'Fuel selector', response: 'FULLEST TANK' },
        { id: 'bs-03', action: 'Avionics', response: 'OFF' },
        { id: 'bs-04', action: 'Mixture', response: 'RICH' },
        { id: 'bs-05', action: 'Throttle', response: 'OPEN 1/4 INCH' },
        { id: 'bs-06', action: 'Primer', response: '2–4 strokes cold / 0 warm, LOCKED' },
      ],
    },
    {
      id: 'engine-start', name: 'Engine Start', category: 'startup',
      items: [
        { id: 'es-01', action: 'Beacon', response: 'ON' },
        { id: 'es-02', action: 'Area', response: 'CLEAR', severity: 'warning' },
        { id: 'es-03', action: 'Master', response: 'ON' },
        { id: 'es-04', action: 'Ignition', response: 'START' },
        { id: 'es-05', action: 'Throttle', response: 'ADJUST 1000–1200 RPM' },
        { id: 'es-06', action: 'Oil pressure', response: 'CHECK — green within 30 sec', severity: 'warning' },
        { id: 'es-07', action: 'Avionics', response: 'ON' },
        { id: 'es-08', action: 'Altimeter', response: 'SET' },
      ],
    },
    {
      id: 'runup', name: 'Engine Run-Up', category: 'runup',
      items: [
        { id: 'ru-01', action: 'Parking brake', response: 'SET' },
        { id: 'ru-02', action: 'Controls', response: 'FREE & CORRECT' },
        { id: 'ru-03', action: 'Mixture', response: 'RICH' },
        { id: 'ru-04', action: 'Carb heat', response: 'ON — warm at 1800 RPM, then COLD' },
        { id: 'ru-05', action: 'Magnetos', response: 'CHECK — max 125 RPM drop / 50 RPM diff', severity: 'caution' },
        { id: 'ru-06', action: 'Engine gauges', response: 'CHECK GREEN' },
      ],
    },
    {
      id: 'before-takeoff', name: 'Before Takeoff', category: 'takeoff',
      items: [
        { id: 'to-01', action: 'Doors', response: 'CLOSED & LATCHED' },
        { id: 'to-02', action: 'Flaps', response: '0° normal / 25° short field' },
        { id: 'to-03', action: 'Carb heat', response: 'COLD' },
        { id: 'to-04', action: 'Mixture', response: 'RICH' },
        { id: 'to-05', action: 'Transponder', response: 'ALT' },
        { id: 'to-06', action: 'Lights', response: 'ON' },
      ],
    },
    {
      id: 'after-takeoff', name: 'After Takeoff / Climb', category: 'climb',
      items: [
        { id: 'atc-01', action: 'Airspeed', response: 'Vx 63 KIAS / Vy 73 KIAS' },
        { id: 'atc-02', action: 'Flaps', response: 'RETRACT above 60 KIAS' },
        { id: 'atc-03', action: 'Carb heat', response: 'COLD' },
        { id: 'atc-04', action: 'Engine gauges', response: 'CHECK GREEN' },
      ],
    },
    {
      id: 'cruise', name: 'Cruise', category: 'cruise',
      items: [
        { id: 'cr-01', action: 'Power', response: 'SET 65–75%' },
        { id: 'cr-02', action: 'Mixture', response: 'LEAN — peak EGT method' },
        { id: 'cr-03', action: 'Fuel selector', response: 'SWITCH every 30 min' },
        { id: 'cr-04', action: 'Gauges', response: 'MONITOR' },
      ],
    },
    {
      id: 'descent', name: 'Descent', category: 'descent',
      items: [
        { id: 'de-01', action: 'ATIS', response: 'COPY' },
        { id: 'de-02', action: 'Altimeter', response: 'SET' },
        { id: 'de-03', action: 'Mixture', response: 'ENRICH' },
        { id: 'de-04', action: 'Carb heat', response: 'ON during power reduction' },
      ],
    },
    {
      id: 'approach', name: 'Approach', category: 'approach',
      items: [
        { id: 'ap-01', action: 'Fuel selector', response: 'FULLEST TANK' },
        { id: 'ap-02', action: 'Mixture', response: 'RICH' },
        { id: 'ap-03', action: 'Carb heat', response: 'ON' },
        { id: 'ap-04', action: 'Flaps', response: 'AS REQUIRED — Vfe 103 KIAS' },
        { id: 'ap-05', action: 'Final speed', response: '70 KIAS' },
        { id: 'ap-06', action: 'Landing light', response: 'ON' },
      ],
    },
    {
      id: 'landing', name: 'Landing', category: 'landing',
      items: [
        { id: 'la-01', action: 'Speed threshold', response: '70 KIAS' },
        { id: 'la-02', action: 'After landing', response: 'FLAPS UP — carb heat OFF' },
      ],
    },
    {
      id: 'shutdown', name: 'Shutdown & Securing', category: 'shutdown',
      items: [
        { id: 'sd-01', action: 'Throttle', response: 'IDLE' },
        { id: 'sd-02', action: 'Avionics', response: 'OFF' },
        { id: 'sd-03', action: 'Mixture', response: 'IDLE CUT-OFF' },
        { id: 'sd-04', action: 'Ignition', response: 'OFF' },
        { id: 'sd-05', action: 'Master', response: 'OFF' },
        { id: 'sd-06', action: 'Tie-downs / control lock', response: 'SECURE' },
      ],
    },
    {
      id: 'emergency-engine-failure', name: 'Engine Failure In Flight', category: 'emergency',
      items: [
        { id: 'ef-01', action: 'BEST GLIDE', response: '73 KIAS', severity: 'warning' },
        { id: 'ef-02', action: 'Landing area', response: 'SELECT' },
        { id: 'ef-03', action: 'Carb heat', response: 'ON — 1 min' },
        { id: 'ef-04', action: 'Fuel selector', response: 'FULLEST TANK' },
        { id: 'ef-05', action: 'Mixture', response: 'RICH' },
        { id: 'ef-06', action: 'Ignition', response: 'BOTH' },
        { id: 'ef-07', action: 'Squawk 7700 / 121.5', response: 'TRANSMIT', severity: 'warning' },
      ],
    },
  ],
}
