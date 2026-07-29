// 场景参数表单 / Scenario parameter form
// 分两组渲染（基本参数/投资参数），受控组件
// 校验失败时不触发 onFieldChange
// auto_sync 时 current_portfolio_value 只读

import { useState } from 'react';
import type { FireScenario } from '@shared/types/index.js';
import { centsToYuan, yuanToCents } from '@shared/utils/money.js';
import {
  FORM_FIELD_GROUPS,
  basisPointsToPercent,
  percentToBasisPoints,
  validateScenarioField,
  CHINA_WITHDRAWAL_RATE_HINT,
} from './fire-calc-constants.js';

interface ScenarioFormProps {
  scenario: FireScenario;
  onFieldChange: (field: keyof FireScenario, value: number) => void;
  investableBalance: number | null; // auto_sync 时传入，null 表示未开启
}

export function ScenarioForm({ scenario, onFieldChange, investableBalance }: ScenarioFormProps) {
  // 本地草稿：用户输入未提交时的中间值
  // Local draft: intermediate values before commit
  const [draft, setDraft] = useState<Partial<Record<keyof FireScenario, string>>>({});

  function getDisplayValue(field: typeof FORM_FIELD_GROUPS[number]['fields'][number]): string {
    const draftVal = draft[field.key];
    if (draftVal !== undefined) return draftVal;
    const raw = scenario[field.key] as number;
    if (field.type === 'percent') return String(basisPointsToPercent(raw));
    if (field.type === 'amount') return String(centsToYuan(raw));
    if (field.type === 'toggle') return String(raw);
    return String(raw);
  }

  function handleChange(field: typeof FORM_FIELD_GROUPS[number]['fields'][number], inputVal: string) {
    setDraft((d) => ({ ...d, [field.key]: inputVal }));

    let storedValue: number;
    if (field.type === 'percent') {
      storedValue = percentToBasisPoints(Number(inputVal));
    } else if (field.type === 'amount') {
      storedValue = yuanToCents(Number(inputVal));
    } else if (field.type === 'toggle') {
      // toggle 由专用 handler 处理，此处不触发
      return;
    } else {
      storedValue = Number(inputVal);
    }

    const err = validateScenarioField(field.key, storedValue, { current_age: scenario.current_age });
    if (err) return; // 校验失败不回调
    onFieldChange(field.key, storedValue);
  }

  function handleToggle(field: typeof FORM_FIELD_GROUPS[number]['fields'][number]) {
    const current = scenario[field.key] as number;
    const next = current === 1 ? 0 : 1;
    onFieldChange(field.key, next);
  }

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
      <div className="space-y-6">
        {FORM_FIELD_GROUPS.map((group) => (
          <div key={group.title}>
            <h3 className="text-base font-semibold text-gray-900 mb-3">{group.title}</h3>
            <div className="grid grid-cols-2 gap-4">
              {group.fields.map((field) => {
                const isAutoSyncedAmount =
                  field.key === 'current_portfolio_value' && scenario.auto_sync_assets === 1;
                const displayVal = isAutoSyncedAmount
                  ? String(centsToYuan(investableBalance ?? 0))
                  : getDisplayValue(field);
                const err = validateScenarioField(field.key, (() => {
                  const raw = scenario[field.key] as number;
                  if (field.type === 'percent') return raw;
                  return raw;
                })(), { current_age: scenario.current_age });

                if (field.type === 'toggle') {
                  const checked = (scenario[field.key] as number) === 1;
                  return (
                    <div key={field.key} className="flex flex-col">
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        {field.label}
                      </label>
                      <label className="inline-flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => handleToggle(field)}
                          aria-label={field.label}
                          className="form-checkbox h-4 w-4 text-blue-600"
                        />
                        <span className="text-sm text-gray-600">{checked ? '已开启' : '已关闭'}</span>
                      </label>
                    </div>
                  );
                }

                return (
                  <div key={field.key} className="flex flex-col">
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      {field.label}
                      {field.required && <span className="text-red-500 ml-1">*</span>}
                    </label>
                    <div className="relative">
                      <input
                        type="number"
                        step={field.step ?? 1}
                        min={field.min}
                        max={field.max}
                        value={displayVal}
                        disabled={isAutoSyncedAmount}
                        onChange={(e) => handleChange(field, e.target.value)}
                        aria-label={field.label}
                        className={`w-full h-10 rounded-md border bg-white px-3 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-50 disabled:cursor-not-allowed ${
                          err ? 'border-red-300' : 'border-gray-300'
                        } ${field.type === 'amount' ? 'pr-8' : ''} ${field.type === 'percent' ? 'pr-8' : ''}`}
                      />
                      {field.type === 'amount' && (
                        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">元</span>
                      )}
                      {field.type === 'percent' && (
                        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">%</span>
                      )}
                    </div>
                    {err && <p className="mt-1 text-xs text-red-500">{err}</p>}
                    {field.key === 'withdrawal_rate' && scenario.is_china_market === 1 && (
                      <p className="mt-1 text-xs text-gray-400">{CHINA_WITHDRAWAL_RATE_HINT}</p>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
