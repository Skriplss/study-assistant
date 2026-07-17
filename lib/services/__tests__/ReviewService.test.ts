import { ReviewService } from '../ReviewService'

// Grades as ReviewService maps them: a correct answer scores 4, a lapse 2.
const CORRECT = 4
const INCORRECT = 2
const FRESH = { easeFactor: 2.5, intervalDays: 0, repetitions: 0 }

describe('ReviewService.schedule (SM-2)', () => {
  it('sends a first correct answer to tomorrow', () => {
    const next = ReviewService.schedule(FRESH, CORRECT)

    expect(next.intervalDays).toBe(1)
    expect(next.repetitions).toBe(1)
  })

  it('uses the fixed 6-day step on the second success', () => {
    const first = ReviewService.schedule(FRESH, CORRECT)
    const second = ReviewService.schedule(first, CORRECT)

    expect(second.intervalDays).toBe(6)
    expect(second.repetitions).toBe(2)
  })

  it('multiplies by ease from the third success on', () => {
    let state = ReviewService.schedule(FRESH, CORRECT)
    state = ReviewService.schedule(state, CORRECT)
    const third = ReviewService.schedule(state, CORRECT)

    // 6 * 2.5 — the interval uses the ease carried in, per the original SM-2.
    expect(third.intervalDays).toBe(15)
    expect(third.repetitions).toBe(3)
  })

  it('leaves ease untouched on a correct answer', () => {
    // Grade 4 is chosen precisely so the SM-2 ease term cancels to zero.
    const next = ReviewService.schedule(FRESH, CORRECT)

    expect(next.easeFactor).toBeCloseTo(2.5)
  })

  it('drops ease and restarts the ladder on a lapse', () => {
    let state = ReviewService.schedule(FRESH, CORRECT)
    state = ReviewService.schedule(state, CORRECT)
    const lapsed = ReviewService.schedule(state, INCORRECT)

    expect(lapsed.intervalDays).toBe(1)
    expect(lapsed.repetitions).toBe(0)
    expect(lapsed.easeFactor).toBeCloseTo(2.18) // 2.5 - 0.32
  })

  it('floors ease at 1.3 no matter how many lapses', () => {
    let state = FRESH
    for (let i = 0; i < 20; i++) {
      state = ReviewService.schedule(state, INCORRECT)
    }

    expect(state.easeFactor).toBe(1.3)
  })

  it('grows the interval monotonically across a long correct streak', () => {
    let state = FRESH
    const intervals: number[] = []
    for (let i = 0; i < 6; i++) {
      state = ReviewService.schedule(state, CORRECT)
      intervals.push(state.intervalDays)
    }

    expect(intervals).toEqual([1, 6, 15, 38, 95, 238])
  })
})
