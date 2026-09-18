// Standard fill ratio for ultrasonic cleaning machines: every tank fill is
// 10% detergent, 90% water. Used to turn a machine's tank size into an
// expected detergent draw, for facilities/machines that don't have enough
// logged usage history yet to forecast from actuals alone.
export const DETERGENT_RATIO = 0.1

// Detergent volume drawn by a single fill of a tank of the given capacity.
export function detergentPerFill(tankCapacity) {
  const capacity = Number(tankCapacity)
  if (!capacity) return null
  return capacity * DETERGENT_RATIO
}

// A machine's expected weekly detergent draw, from its tank size and how
// often it's expected to be refilled. Either missing means no estimate.
export function theoreticalWeeklyUsage(machine) {
  const perFill = detergentPerFill(machine.tank_capacity)
  const frequency = Number(machine.fill_frequency_per_week)
  if (perFill === null || !frequency) return 0
  return perFill * frequency
}

// Blends logged usage history with the tank-based theoretical estimate:
// prefers real history when there's any, and falls back to the planned
// fill-schedule rate when a site/product has none logged yet (new install,
// or usage simply hasn't been entered) — so "zero stoppages" planning still
// works before there's a consumption trail to learn from.
export function computeStockForecast({
  quantityOnHand,
  reorderThreshold,
  usageLast60Days,
  reorderLeadTimeDays,
  plannedWeeklyUsage,
}) {
  const empiricalDailyRate = Number(usageLast60Days) / 60
  const plannedDailyRate = Number(plannedWeeklyUsage || 0) / 7
  const usingEmpirical = empiricalDailyRate > 0
  const dailyRate = usingEmpirical ? empiricalDailyRate : plannedDailyRate

  const daysLeft = dailyRate > 0 ? Math.round(Number(quantityOnHand) / dailyRate) : null
  const flagged = Number(quantityOnHand) < Number(reorderThreshold) ||
    (daysLeft !== null && daysLeft < Number(reorderLeadTimeDays))

  return {
    days_left: daysLeft,
    flagged,
    forecast_source: usingEmpirical ? 'usage history' : (plannedDailyRate > 0 ? 'planned fill schedule' : null),
  }
}
