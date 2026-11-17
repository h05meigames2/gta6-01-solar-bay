// SOLAR BAY — shared constants: city size, speeds, wanted rules, mission pay.
// All names, places and people here are original fiction for this game.
export const CITY = 3190; // city is CITY x CITY world units
export const ROAD = 110; // road band width
export const BLOCK = 330; // block side
export const STEP = 1 / 60;
export const SAVE_KEY = 'solarbay-save-v1';

export const PLAYER_WALK = 175;
export const PLAYER_RUN = 245;
export const CAR_TOP_SPEED = 430;
export const CAR_ACCEL = 300;
export const CAR_REVERSE = 170;
export const CAR_TURN = 2.6;

export const WANTED_MAX = 5;
export const WANTED_DECAY_SECONDS = 26;
export const POLICE_MAX = 8;

export const PISTOL_DAMAGE = 34;
export const PISTOL_RANGE = 340;
export const PISTOL_COOLDOWN = 0.28;
export const PUNCH_DAMAGE = 18;
export const PUNCH_RANGE = 46;

export const MISSIONS = [
  {
    id: 'm1',
    name: 'First Wheels',
    giver: 'Mara Sol',
    pay: 300,
    brief: 'Mara needs wheels for her garage. Take any parked car on the street and bring it to the garage on Coral Row.',
    objective: 'Steal a car and drive it to Mara\u2019s Garage',
  },
  {
    id: 'm2',
    name: 'Sunset Run',
    giver: 'Mara Sol',
    pay: 500,
    brief: 'A sealed crate waits at the old depot. The Vex crew wants it too. Grab the crate and deliver it to the pier before the tide turns.',
    objective: 'Pick up the crate at the depot, then reach the pier',
  },
  {
    id: 'm3',
    name: 'Heat Wave',
    giver: 'Dario Flint',
    pay: 400,
    brief: 'The Bay Patrol is all over the marina after the depot job. Shake the heat: lose your wanted level, or outlast the chase for a full minute.',
    objective: 'Lose the cops — drop to 0 stars or survive 60s at 2+ stars',
  },
];

export const STORY_INTRO = [
  'SOLAR BAY — a sun-soaked port city where the tide brings in more than fish.',
  'You are RIKO VALE, new in town, broke, with a borrowed jacket and a fast pair of hands.',
  'MARA SOL runs a garage on Coral Row and pays cash for drivers who ask no questions.',
  'The VEX CREW owns the night docks. The BAY PATROL owns the streets.',
  'Take the work. Keep the wheels. Don\u2019t get caught.',
];
