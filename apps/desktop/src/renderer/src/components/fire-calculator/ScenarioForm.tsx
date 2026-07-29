// 场景参数表单 / Scenario parameter form
// 浏览/编辑双模式：默认只读浏览，点击编辑进入表单修改，保存/取消
// View/Edit dual mode: read-only by default, click edit to modify, save/cancel
// auto_sync 时 current_portfolio_value 只读

import { useState, useEffect } from 'react';
import type { FireScenario } from '@shared/types/index.js';
import { centsToYuan, yuanToCents } from '@shared/utils/money.js';
import {
  FORM_FIELD_GROUPS,
  basisPointsToPercent,
  percentToBasisPoints,
  validateScenarioField,
  formatFireAmount,
  CHINA_WITHDRAWAL_RATE_HINT,
  type FormFieldConfig,
} from './fire-calc-constants.js';

interface ScenarioFormProps {
  scenario: FireScenario;
  onSave: (updates: Partial<FireScenario>) => void;
  investableBalance: number | null; // auto_sync 时传入，null 表示未开启
}

export function ScenarioForm({ scenario, onSave, investableBalance }: ScenarioFormProps) {
  const [mode, setMode] = useState<'view' | 'edit'>('view');
  const [formData, setFormData] = useState<FireScenario>(scenario);
  const [errors, setErrors] = useState<Partial<Record<keyof FireScenario, string>>>({});

  // 切换场景时重置为浏览模式并同步数据
  // Reset to view mode and sync data when scenario changes
  useEffect(() => {
    setFormData(scenario);
    setMode('view');
    setErrors({});
  }, [scenario.id]);

  function handleEdit() {
    setFormData(scenario);
    setErrors({});
    setMode('edit');
  }

  function handleCancel() {
    setFormData(scenario);
    setErrors({});
    setMode('view');
  }

  function handleSave() {
    // 校验所有非 toggle 字段
    // Validate all non-toggle fields
    const newErrors: Partial<Record<keyof FireScenario, string>> = {};
    for (const group of FORM_FIELD_GROUPS) {
      for (const field of group.fields) {
        if (field.type === 'toggle') continue;
        const err = validateScenarioField(field.key, formData[field.key], {
          current_age: formData.current_age,
        });
        if (err) newErrors[field.key] = err;
      }
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    // 构建更新对象（仅包含表单中的可编辑字段）
    // Build updates object (only editable fields from the form)
    const updates: Partial<FireScenario> = {};
    for (const group of FORM_FIELD_GROUPS) {
      for (const field of group.fields) {
        (updates as Record<string, unknown>)[field.key] = formData[field.key];
      }
    }

    onSave(updates);
    setErrors({});
    setMode('view');
  }

  // ============= 浏览模式：格式化显示值 =============
  // View mode: format display value
  function formatViewValue(field: FormFieldConfig): string {
    const raw = scenario[field.key] as number | string;
    if (field.type === 'toggle') return raw === 1 ? '已开启' : '已关闭';
    if (field.type === 'percent') return `${basisPointsToPercent(raw as number)}%`;
    if (field.type === 'amount') {
      if (field.key === 'current_portfolio_value' && scenario.auto_sync_assets === 1) {
        return formatFireAmount(investableBalance ?? 0);
      }
      return formatFireAmount(raw as number);
    }
    if (field.type === 'text') return String(raw);
    return String(raw);
  }

  // ============= 编辑模式：获取输入框显示值 =============
  // Edit mode: get input display value
  function getEditDisplayValue(field: FormFieldConfig): string {
    const raw = formData[field.key] as number | string;
    if (field.type === 'percent') return String(basisPointsToPercent(raw as number));
    if (field.type === 'amount') {
      if (field.key === 'current_portfolio_value' && formData.auto_sync_assets === 1) {
        return String(centsToYuan(investableBalance ?? 0));
      }
      return String(centsToYuan(raw as number));
    }
    if (field.type === 'toggle') return String(raw);
    if (field.type === 'text') return String(raw);
    return String(raw);
  }

  // ============= 编辑模式：字段变更处理 =============
  // Edit mode: handle field change
  function handleFieldChange(field: FormFieldConfig, inputVal: string) {
    let storedValue: number | string;
    if (field.type === 'text') {
      storedValue = inputVal;
    } else if (field.type === 'percent') {
      storedValue = percentToBasisPoints(Number(inputVal));
    } else if (field.type === 'amount') {
      storedValue = yuanToCents(Number(inputVal));
    } else if (field.type === 'toggle') {
      return; // toggle 由专用 handler 处理
    } else {
      storedValue = Number(inputVal);
    }

    setFormData((prev) => ({ ...prev, [field.key]: storedValue }));
    setErrors((prev) => ({ ...prev, [field.key]: undefined }));
  }

  function handleToggle(field: FormFieldConfig) {
    const current = formData[field.key] as number;
    const next = current === 1 ? 0 : 1;
    setFormData((prev) => ({ ...prev, [field.key]: next }));
  }

  // ============= 渲染 =============

  // 浏览模式
  // View mode
  if (mode === 'view') {
    return (
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-lg font-semibold text-gray-900">场景详情</h2>
          <button
            type="button"
            onClick={handleEdit}
            className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            编辑
          </button>
        </div>
        <div className="space-y-6">
          {FORM_FIELD_GROUPS.map((group) => (
            <div key={group.title}>
              <h3 className="text-base font-semibold text-gray-900 mb-3">{group.title}</h3>
              <div className="grid grid-cols-2 gap-4">
                {group.fields.map((field) => (
                  <div key={field.key} className="flex flex-col">
                    <span className="text-sm text-gray-500 mb-1">{field.label}</span>
                    <span className="text-sm font-medium text-gray-900">
                      {formatViewValue(field)}
                    </span>
                    {field.key === 'withdrawal_rate' && scenario.is_china_market === 1 && (
                      <span className="mt-1 text-xs text-gray-400">{CHINA_WITHDRAWAL_RATE_HINT}</span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  // 编辑模式
  // Edit mode
  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-lg font-semibold text-gray-900">编辑场景</h2>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={handleSave}
            className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            保存
          </button>
          <button
            type="button"
            onClick={handleCancel}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200 focus:outline-none focus:ring-2 focus:ring-gray-400"
          >
            取消
          </button>
        </div>
      </div>
      <div className="space-y-6">
        {FORM_FIELD_GROUPS.map((group) => (
          <div key={group.title}>
            <h3 className="text-base font-semibold text-gray-900 mb-3">{group.title}</h3>
            <div className="grid grid-cols-2 gap-4">
              {group.fields.map((field) => {
                const isAutoSyncedAmount =
                  field.key === 'current_portfolio_value' && formData.auto_sync_assets === 1;
                const err = errors[field.key];

                if (field.type === 'toggle') {
                  const checked = (formData[field.key] as number) === 1;
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
                        type={field.type === 'text' ? 'text' : 'number'}
                        step={field.step ?? 1}
                        min={field.min}
                        max={field.max}
                        value={getEditDisplayValue(field)}
                        disabled={isAutoSyncedAmount}
                        onChange={(e) => handleFieldChange(field, e.target.value)}
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
                    {field.key === 'withdrawal_rate' && formData.is_china_market === 1 && (
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
