// src/utils/money.ts

/**
 * 元转分（金额存储为整数分，避免浮点误差）
 * 采用两阶段取整（先到毫、再到分）以规避 IEEE 754 浮点误差，
 * 例如 1.005 * 100 在浮点下为 100.4999...，直接 Math.round 会丢分。
 */
export function yuanToCents(yuan: number): number {
  return Math.round(Math.round(yuan * 1000) / 10);
}

/**
 * 分转元（用于UI展示）
 */
export function centsToYuan(cents: number): number {
  return cents / 100;
}

/**
 * 基点转小数（利率字段存储为基点整数，如350=3.5%）
 * 100基点 = 1%，所以 350基点 = 0.035
 */
export function basisPointsToDecimal(basisPoints: number): number {
  return basisPoints / 10000;
}
