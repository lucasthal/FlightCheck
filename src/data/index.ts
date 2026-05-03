import { cessna172 } from './aircraft/cessna172'
import { cessna172m } from './aircraft/cessna172m'
import { cessna172n } from './aircraft/cessna172n'
import { cessna172p } from './aircraft/cessna172p'
import { cessna152 } from './aircraft/cessna152'
import { cessna182 } from './aircraft/cessna182'
import { cessna208 } from './aircraft/cessna208'
import { piperArcher } from './aircraft/piperArcher'
import { piperWarrior } from './aircraft/piperWarrior'
import { cirrusSR22 } from './aircraft/cirrusSR22'
import { diamondDA40 } from './aircraft/diamondDA40'
import { beechBonanza } from './aircraft/beechBonanza'
import { mooneyM20 } from './aircraft/mooneyM20'
import { piperSeminole } from './aircraft/piperSeminole'
import { baronG58 } from './aircraft/baronG58'
import { kingAirC90 } from './aircraft/kingAirC90'
import { kingAirB200 } from './aircraft/kingAirB200'
import { tbm960 } from './aircraft/tbm960'
import { pilatusPC12 } from './aircraft/pilatusPC12'
import { citationCJ4 } from './aircraft/citationCJ4'
import { phenom300 } from './aircraft/phenom300'
import { robinsonR44 } from './aircraft/robinsonR44'
import type { Aircraft, AircraftCategory } from '../types'

export const allAircraft: Aircraft[] = [
  // Single Engine Piston — trainers
  cessna152,
  piperWarrior,
  cessna172,
  cessna172m,
  cessna172n,
  cessna172p,
  // Single Engine Piston — touring
  cessna182,
  piperArcher,
  diamondDA40,
  cirrusSR22,
  beechBonanza,
  mooneyM20,
  // Multi-Engine Piston
  piperSeminole,
  baronG58,
  // Single Turboprop
  cessna208,
  tbm960,
  pilatusPC12,
  // Twin Turboprop
  kingAirC90,
  kingAirB200,
  // Jets
  citationCJ4,
  phenom300,
  // Helicopter
  robinsonR44,
]

export const aircraftByCategory: Record<AircraftCategory, Aircraft[]> = {
  SEP: allAircraft.filter(a => a.category === 'SEP'),
  MEP: allAircraft.filter(a => a.category === 'MEP'),
  Turboprop: allAircraft.filter(a => a.category === 'Turboprop'),
  Jet: allAircraft.filter(a => a.category === 'Jet'),
  Helicopter: allAircraft.filter(a => a.category === 'Helicopter'),
}

export const getAircraftById = (id: string): Aircraft | undefined =>
  allAircraft.find(a => a.id === id)
