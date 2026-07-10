import { forwardRef, useEffect, useImperativeHandle, useState } from 'react'
import { useToasts } from '../notifications/ToastContext'
import { hasSeenSyncNudge, hasSeenTour, markSyncNudgeSeen, markTourSeen } from './first-run-flags'
import { WelcomeTour } from './WelcomeTour'

const SYNC_NUDGE_MESSAGE =
  "Tip: install the Dropbox, Google Drive, or OneDrive desktop app, then save this folder inside the location it backs up. Refrain doesn't need any of them — but if it's already there, you get automatic backups for free."

export interface OnboardingControllerHandle {
  replay: () => void
}

interface OnboardingControllerProps {
  /** True only right after a fresh sample workspace was created. */
  showTourOnMount: boolean
}

export const OnboardingController = forwardRef<OnboardingControllerHandle, OnboardingControllerProps>(
  function OnboardingController({ showTourOnMount }, forwardedRef) {
    const { push } = useToasts()
    const [tourOpen, setTourOpen] = useState(false)

    useImperativeHandle(forwardedRef, () => ({
      replay: () => setTourOpen(true),
    }))

    function maybeShowSyncNudge() {
      void hasSeenSyncNudge().then((seen) => {
        if (seen) return
        push({ kind: 'info', message: SYNC_NUDGE_MESSAGE, persistent: true })
        void markSyncNudgeSeen()
      })
    }

    useEffect(() => {
      let cancelled = false

      async function run() {
        if (showTourOnMount) {
          const seen = await hasSeenTour()
          if (!cancelled && !seen) {
            setTourOpen(true)
            await markTourSeen()
            return // sync nudge fires once the tour is dismissed, so they don't stack
          }
        }
        if (!cancelled) maybeShowSyncNudge()
      }

      void run()
      return () => {
        cancelled = true
      }
      // oxlint-disable-next-line react-hooks/exhaustive-deps -- runs once per mount, not on every re-render
    }, [])

    return tourOpen ? (
      <WelcomeTour
        onClose={() => {
          setTourOpen(false)
          maybeShowSyncNudge()
        }}
      />
    ) : null
  },
)
