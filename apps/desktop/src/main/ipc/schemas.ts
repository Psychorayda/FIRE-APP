// IPC 输入参数 zod schemas
// IPC input zod schemas: 校验渲染进程传入参数，拒绝非法值并剔除不可信字段。
// IPC input zod schemas: validate renderer-supplied args, reject invalid values
// and strip untrusted fields (e.g. user_id / sync_version on update paths).

import { z } from 'zod';

/**
 * 创建交易输入 schema
 * - amount 必须为有限正数（拒绝 NaN / Infinity / 负数）
 * Create transaction input schema.
 * amount must be a finite positive number (rejects NaN / Infinity / negative).
 */
export const createTransactionSchema = z.object({
  user_id: z.string().min(1),
  account_id: z.string().min(1),
  to_account_id: z.string().nullable().optional(),
  category_id: z.string().nullable().optional(),
  recurring_id: z.string().nullable().optional(),
  transaction_type: z.enum(['income', 'expense', 'transfer', 'initial_balance']),
  amount: z.number().finite().positive(),
  transaction_date: z.number().finite(),
  description: z.string().nullable().optional(),
});

/**
 * 创建账户输入 schema
 * - asset_class / account_type 必须为合法枚举
 * Create account input schema.
 * asset_class / account_type must be valid enums.
 */
export const createAccountSchema = z.object({
  user_id: z.string().min(1),
  name: z.string().min(1).max(255),
  asset_class: z.enum(['liquid', 'invested', 'use_asset', 'liability']),
  account_type: z.enum([
    'checking', 'savings', 'cash',
    'investment', 'retirement', 'fund',
    'real_estate', 'vehicle',
    'credit_card', 'loan', 'mortgage',
  ]),
  initial_balance: z.number().finite().optional(),
  note: z.string().max(1024).nullable().optional(),
});

/**
 * 编辑账户输入 schema（.strict() 拒绝未知字段，防止 sync_version/user_id 篡改）
 * Edit account input schema. .strict() rejects unknown fields to prevent
 * tampering with sync_version / user_id.
 */
export const editAccountSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  asset_class: z.enum(['liquid', 'invested', 'use_asset', 'liability']).optional(),
  account_type: z.enum([
    'checking', 'savings', 'cash',
    'investment', 'retirement', 'fund',
    'real_estate', 'vehicle',
    'credit_card', 'loan', 'mortgage',
  ]).optional(),
  note: z.string().max(1024).nullable().optional(),
  display_order: z.number().int().nonnegative().optional(),
}).strict();

/**
 * 编辑交易输入 schema
 * Edit transaction input schema.
 */
export const editTransactionSchema = z.object({
  account_id: z.string().min(1).optional(),
  to_account_id: z.string().nullable().optional(),
  category_id: z.string().nullable().optional(),
  transaction_type: z.enum(['income', 'expense', 'transfer', 'initial_balance']).optional(),
  amount: z.number().finite().positive().optional(),
  transaction_date: z.number().finite().optional(),
  description: z.string().nullable().optional(),
}).strict();

/**
 * 创建定期交易输入 schema
 * Create recurring transaction input schema.
 */
export const createRecurringSchema = z.object({
  user_id: z.string().min(1),
  account_id: z.string().min(1),
  to_account_id: z.string().nullable().optional(),
  category_id: z.string().nullable().optional(),
  transaction_type: z.enum(['income', 'expense', 'transfer', 'initial_balance']),
  amount: z.number().finite().positive(),
  frequency: z.enum(['daily', 'weekly', 'monthly', 'yearly']),
  interval: z.number().int().positive().optional(),
  start_date: z.number().finite(),
  end_date: z.number().finite().nullable().optional(),
  next_due_date: z.number().finite(),
  description: z.string().nullable().optional(),
  is_active: z.number().int().min(0).max(1).optional(),
  auto_create: z.number().int().min(0).max(1).optional(),
});

/**
 * 更新场景输入 schema
 * - 默认 strip 行为：未声明的字段（如 user_id / sync_version / updated_at /
 *   deleted_flag / id）会被静默丢弃，防止渲染层篡改归属与同步元数据。
 * Update scenario input schema.
 * Default strip behavior drops undeclared fields (e.g. user_id / sync_version /
 * updated_at / deleted_flag / id), preventing the renderer from tampering with
 * ownership or sync metadata. The returned data therefore never carries those
 * keys, so updateScenario cannot be coerced into mutating them.
 */
export const updateScenarioSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  description: z.string().max(1024).nullable().optional(),
  current_age: z.number().int().nonnegative().optional(),
  retirement_age: z.number().int().positive().optional(),
  current_portfolio_value: z.number().int().nonnegative().optional(),
  auto_sync_assets: z.number().int().min(0).max(1).optional(),
  monthly_savings: z.number().int().nonnegative().optional(),
  annual_expenses: z.number().int().positive().optional(),
  expected_return_rate: z.number().int().min(-1000).max(5000).optional(),
  inflation_rate: z.number().int().min(-1000).max(5000).optional(),
  withdrawal_rate: z.number().int().min(200).max(600).optional(),
  retirement_years: z.number().int().positive().optional(),
  post_retirement_monthly_income: z.number().int().nonnegative().optional(),
  is_china_market: z.number().int().min(0).max(1).optional(),
  is_active: z.number().int().min(0).max(1).optional(),
});

/**
 * 更新用户输入 schema（剔除 encryption_key_hash / last_sync_at / sync_version 等服务端字段）
 * Update user input schema. Strips server-controlled fields like
 * encryption_key_hash / last_sync_at / sync_version.
 */
export const updateUserSchema = z.object({
  display_name: z.string().min(1).max(255).optional(),
  base_currency: z.string().min(1).max(16).optional(),
  is_china_market: z.number().int().min(0).max(1).optional(),
  default_withdrawal_rate: z.number().int().min(200).max(600).optional(),
  default_expected_return: z.number().int().min(-1000).max(5000).optional(),
  default_inflation_rate: z.number().int().min(-1000).max(5000).optional(),
}).strict();
