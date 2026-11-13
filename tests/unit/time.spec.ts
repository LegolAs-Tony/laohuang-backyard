import { describe, expect, it } from 'vitest'
import { formatFull, formatTime } from '@/lib/time'

// 固定"现在"为 2026-11-13 10:30:00，避免测试依赖真实时钟
const NOW = new Date(2026, 10, 13, 10, 30, 0).getTime()
const MINUTE = 60 * 1000
const HOUR = 60 * MINUTE

describe('formatTime', () => {
  it('30 秒内显示「刚刚」', () => {
    expect(formatTime(NOW - 30 * 1000, NOW)).toBe('刚刚')
  })

  it('未来时间也显示「刚刚」', () => {
    expect(formatTime(NOW + 5 * MINUTE, NOW)).toBe('刚刚')
  })

  it('一小时内显示分钟数', () => {
    expect(formatTime(NOW - 1 * MINUTE, NOW)).toBe('1 分钟前')
    expect(formatTime(NOW - 59 * MINUTE, NOW)).toBe('59 分钟前')
  })

  it('当天更早的时间显示时:分', () => {
    expect(formatTime(NOW - 3 * HOUR, NOW)).toBe('07:30')
  })

  it('同年的其它日期显示月日与时:分', () => {
    const yesterday = new Date(2026, 10, 12, 8, 5, 0).getTime()
    expect(formatTime(yesterday, NOW)).toBe('11 月 12 日 08:05')
  })

  it('跨年时带上年份', () => {
    const lastYear = new Date(2025, 0, 2, 9, 7, 0).getTime()
    expect(formatTime(lastYear, NOW)).toBe('2025 年 1 月 2 日 09:07')
  })
})

describe('formatFull', () => {
  it('输出 YYYY-MM-DD HH:mm', () => {
    const stamp = new Date(2026, 0, 5, 7, 8, 0).getTime()
    expect(formatFull(stamp)).toBe('2026-01-05 07:08')
  })
})
