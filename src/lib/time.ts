const MINUTE = 60 * 1000
const HOUR = 60 * MINUTE

function pad(value: number): string {
  return value < 10 ? `0${value}` : String(value)
}

/**
 * 把时间戳格式化成列表里用的相对时间：
 * 刚刚 / N 分钟前 / 今日时:分 / 月日时:分 / 跨年带年份
 */
export function formatTime(timestamp: number, now: number = Date.now()): string {
  const diff = now - timestamp

  if (diff < MINUTE) return '刚刚'
  if (diff < HOUR) return `${Math.floor(diff / MINUTE)} 分钟前`

  const date = new Date(timestamp)
  const today = new Date(now)
  const clock = `${pad(date.getHours())}:${pad(date.getMinutes())}`

  const sameDay =
    date.getFullYear() === today.getFullYear() &&
    date.getMonth() === today.getMonth() &&
    date.getDate() === today.getDate()

  if (sameDay) return clock

  const day = `${date.getMonth() + 1} 月 ${date.getDate()} 日 ${clock}`

  return date.getFullYear() === today.getFullYear() ? day : `${date.getFullYear()} 年 ${day}`
}

/** 悬停时展示的完整时间：YYYY-MM-DD HH:mm */
export function formatFull(timestamp: number): string {
  const date = new Date(timestamp)
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(
    date.getHours()
  )}:${pad(date.getMinutes())}`
}

/** 供 <time datetime> 使用的 ISO 字符串 */
export function toIsoString(timestamp: number): string {
  return new Date(timestamp).toISOString()
}
