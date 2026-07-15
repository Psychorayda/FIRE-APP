// src/utils/time.ts

/**
 * 当前Unix时间戳（毫秒）
 */
export function nowMs(): number {
  return Date.now();
}

/**
 * 从毫秒时间戳提取 "YYYY-MM" 格式字符串
 */
export function toYearMonth(timestampMs: number): string {
  const date = new Date(timestampMs);
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  return `${year}-${month}`;
}

/**
 * 在时间戳上增加N个月，返回新的时间戳
 * 保持日历日不变（如1月15日 + 3月 = 4月15日）
 */
export function addMonths(timestampMs: number, months: number): number {
  const date = new Date(timestampMs);
  const day = date.getUTCDate();
  date.setUTCMonth(date.getUTCMonth() + months);
  // 处理月末溢出（如1月31日 + 1月 = 3月3日 → 修正为2月28/29日）
  if (date.getUTCDate() < day) {
    date.setUTCDate(0); // 回退到上月最后一天
  }
  return date.getTime();
}

/**
 * 计算两个时间戳之间的月数差（向上取整到完整月）
 */
export function monthsBetween(startMs: number, endMs: number): number {
  const start = new Date(startMs);
  const end = new Date(endMs);
  const yearDiff = end.getUTCFullYear() - start.getUTCFullYear();
  const monthDiff = end.getUTCMonth() - start.getUTCMonth();
  return yearDiff * 12 + monthDiff;
}
