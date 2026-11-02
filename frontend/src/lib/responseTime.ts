// "15 minutes", "1 hour", "1 hour 30 minutes".
export function formatMinutes(total: number): string {
  const hours = Math.floor(total / 60)
  const minutes = total % 60
  const part = (n: number, unit: string) => `${n} ${unit}${n === 1 ? '' : 's'}`
  if (hours === 0) return part(minutes, 'minute')
  return minutes === 0 ? part(hours, 'hour') : `${part(hours, 'hour')} ${part(minutes, 'minute')}`
}

function short(minutes: number): string {
  return minutes < 60 ? `${minutes}m` : `${Math.floor(minutes / 60)}h ${minutes % 60}m`
}

export interface ResponseClock {
  overdue: boolean
  // Under a fifth of the target left.
  urgent: boolean
  label: string
}

// Where a waiting chat stands against the team's first-response target.
export function responseClock(waitingSince: string, targetMinutes: number, now: number): ResponseClock {
  const waited = (now - new Date(waitingSince).getTime()) / 60_000
  const left = targetMinutes - waited
  if (left <= 0) return { overdue: true, urgent: true, label: `${short(Math.floor(-left))} overdue` }
  return { overdue: false, urgent: left < targetMinutes / 5, label: `${short(Math.ceil(left))} left` }
}
