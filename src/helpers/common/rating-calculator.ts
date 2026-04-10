/**
 * Pure utility for rating calculations.
 * Extracted from pending-ratings-store to decouple business logic from stores.
 */

export interface RatingUpdate {
  myVal: number
  scoreSum: number
  scoreCnt: number
}

/**
 * Calculates new post rating values after a vote is confirmed.
 *
 * @param oldMyVal - Previous user vote (0 if first vote)
 * @param newMyVal - Newly confirmed vote value
 * @param currentScoreSum - Current total score sum
 * @param currentScoreCnt - Current total voter count
 * @returns Updated rating fields
 */
export function calculateRatingUpdate(
  oldMyVal: number,
  newMyVal: number,
  currentScoreSum: number,
  currentScoreCnt: number
): RatingUpdate {
  let scoreSum = currentScoreSum
  let scoreCnt = currentScoreCnt

  if (oldMyVal === 0) {
    // First vote — increment voter count
    scoreCnt += 1
    scoreSum += newMyVal
  } else {
    // Changed vote — adjust sum, keep count
    scoreSum = scoreSum - oldMyVal + newMyVal
  }

  return { myVal: newMyVal, scoreSum, scoreCnt }
}
