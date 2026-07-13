import { useState } from 'react'
import { TOUR_STEPS } from './tour-content'

interface WelcomeTourProps {
  onClose: () => void
}

export function WelcomeTour({ onClose }: WelcomeTourProps) {
  const [stepIndex, setStepIndex] = useState(0)
  const step = TOUR_STEPS[stepIndex]
  const isLast = stepIndex === TOUR_STEPS.length - 1

  return (
    <div className="fixed inset-0 z-30 flex items-center justify-center bg-black/30 p-4" onClick={onClose}>
      <div
        className="flex w-full max-w-md flex-col gap-4 rounded-lg bg-gray-800 p-5 shadow-xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold text-gray-100">{step.title}</h3>
          <span className="text-xs text-gray-500">
            {stepIndex + 1} / {TOUR_STEPS.length}
          </span>
        </div>
        <p className="text-sm text-gray-300">{step.body}</p>
        <div className="flex items-center justify-between">
          <button type="button" className="text-xs text-gray-400 hover:text-gray-200" onClick={onClose}>
            Skip
          </button>
          <div className="flex gap-2">
            {stepIndex > 0 && (
              <button
                type="button"
                className="rounded border border-gray-600 px-3 py-1.5 text-sm text-gray-300 hover:bg-gray-700"
                onClick={() => setStepIndex((i) => i - 1)}
              >
                Back
              </button>
            )}
            <button
              type="button"
              className="rounded bg-violet-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-violet-500"
              onClick={() => (isLast ? onClose() : setStepIndex((i) => i + 1))}
            >
              {isLast ? 'Done' : 'Next'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
