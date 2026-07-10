import { idbGet, idbSet } from '../../fs/indexeddb'

const TOUR_SEEN_KEY = 'onboarding-tour-seen'
const SYNC_NUDGE_SEEN_KEY = 'sync-nudge-seen'

export async function hasSeenTour(): Promise<boolean> {
  return (await idbGet<boolean>(TOUR_SEEN_KEY)) ?? false
}

export async function markTourSeen(): Promise<void> {
  await idbSet(TOUR_SEEN_KEY, true)
}

export async function hasSeenSyncNudge(): Promise<boolean> {
  return (await idbGet<boolean>(SYNC_NUDGE_SEEN_KEY)) ?? false
}

export async function markSyncNudgeSeen(): Promise<void> {
  await idbSet(SYNC_NUDGE_SEEN_KEY, true)
}
