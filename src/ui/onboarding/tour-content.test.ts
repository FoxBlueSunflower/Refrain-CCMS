import { describe, expect, it } from 'vitest'
import { TOUR_STEPS } from './tour-content'

describe('TOUR_STEPS', () => {
  it('has at least three steps, each with non-empty title and body', () => {
    expect(TOUR_STEPS.length).toBeGreaterThanOrEqual(3)
    for (const step of TOUR_STEPS) {
      expect(step.title.trim().length).toBeGreaterThan(0)
      expect(step.body.trim().length).toBeGreaterThan(0)
    }
  })
})
