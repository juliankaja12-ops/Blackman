import {
  createOwnedCar,
  DEFAULT_PIT_CREW,
  STARTER_TRACKS,
  STARTER_UNIQUE_PARTS,
} from '../data/catalog';
import {
  DriverProfile,
  OwnedCar,
  PitCrewUpgrades,
  TrackDefinition,
  UniqueComponent,
} from '../types/game';

export interface LocalSaveState {
  profile: DriverProfile;
  garage: OwnedCar[];
  activeCarId: string;
  inventory: UniqueComponent[];
  customTracks: TrackDefinition[];
  pitCrew: PitCrewUpgrades;
}

const STORAGE_KEY = 'apex_darwin_gp_save_v1';

export function getInitialSaveState(): LocalSaveState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<LocalSaveState>;
      if (parsed?.profile?.playerId && parsed?.garage?.length) {
        return {
          profile: {
            ...parsed.profile,
            rankPoints: parsed.profile.rankPoints ?? 0,
            claimedRankRewards: parsed.profile.claimedRankRewards ?? ['bronzo'],
          },
          garage: parsed.garage,
          activeCarId: parsed.activeCarId ?? parsed.garage[0].instanceId,
          inventory: parsed.inventory ?? [],
          customTracks: parsed.customTracks ?? [],
          pitCrew: { ...DEFAULT_PIT_CREW, ...(parsed.pitCrew ?? {}) },
        };
      }
    }
  } catch {
    // Fallback to fresh save
  }

  const playerId = `drv_${Math.random().toString(36).slice(2, 10)}`;
  const starterCar = createOwnedCar('darwin_f3', 'car_starter_01');
  const starterParts = STARTER_UNIQUE_PARTS.map((p) => ({
    ...p,
    ownerId: playerId,
    ownerName: 'Pilota Darwin',
  }));

  return {
    profile: {
      playerId,
      driverName: 'Pilota Darwin',
      credits: 24500,
      wins: 0,
      racesCompleted: 0,
      bestLapRecordMs: null,
      rankPoints: 0,
      claimedRankRewards: ['bronzo'],
    },
    garage: [starterCar],
    activeCarId: starterCar.instanceId,
    inventory: starterParts,
    customTracks: [],
    pitCrew: { ...DEFAULT_PIT_CREW },
  };
}

export function persistSaveState(state: LocalSaveState) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // Ignore storage quota errors
  }
}

export function getAllAvailableTracks(
  customTracks: TrackDefinition[],
  communityTracks: TrackDefinition[]
): TrackDefinition[] {
  const byId = new Map<string, TrackDefinition>();
  for (const t of STARTER_TRACKS) byId.set(t.id, t);
  for (const t of customTracks) byId.set(t.id, t);
  for (const t of communityTracks) {
    if (!byId.has(t.id)) byId.set(t.id, t);
  }
  return Array.from(byId.values());
}
