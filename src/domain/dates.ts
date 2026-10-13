const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

/**
 * How a calendar day reads on History, Stats and Settings: `Tue 13 Oct` this year, `13 Oct 2025`
 * in another year. An ISO `YYYY-MM-DD` string is read as a local calendar day.
 */
export function formatDay(date: string | Date, now: Date): string {
  let day: Date
  if (typeof date === 'string') {
    const [y, m, d] = date.slice(0, 10).split('-').map(Number)
    day = new Date(y, m - 1, d)
  } else {
    day = date
  }
  const text = `${day.getDate()} ${MONTHS[day.getMonth()]}`
  return day.getFullYear() === now.getFullYear()
    ? `${WEEKDAYS[day.getDay()]} ${text}`
    : `${text} ${day.getFullYear()}`
}
