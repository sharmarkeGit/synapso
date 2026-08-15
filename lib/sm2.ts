type SM2Input = {
  quality: number // 0 to 5
  previousEaseFactor: number
  previousIntervalDays: number
}

type SM2Result = {
  easeFactor: number
  intervalDays: number
  nextReviewAt: Date
}

export function calculateSM2({
  quality,
  previousEaseFactor,
  previousIntervalDays,
}: SM2Input): SM2Result {
  // Update the ease factor based on how well the user recalled the card
  let easeFactor =
    previousEaseFactor +
    (0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02))

  if (easeFactor < 1.3) easeFactor = 1.3

  let intervalDays: number

  if (quality < 3) {
    // Poor recall: reset to the beginning
    intervalDays = 1
  } else if (previousIntervalDays <= 1) {
    // First successful review after a reset (or the very first review ever)
    intervalDays = 6
  } else {
    // Subsequent successful reviews: interval grows by the ease factor
    intervalDays = Math.round(previousIntervalDays * easeFactor)
  }

  const nextReviewAt = new Date()
  nextReviewAt.setDate(nextReviewAt.getDate() + intervalDays)

  return { easeFactor, intervalDays, nextReviewAt }
}