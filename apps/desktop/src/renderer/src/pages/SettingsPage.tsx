// 设置页 / Settings page
// 用户偏好编辑 + 内置分类展示与重置

import { useState, useEffect } from 'react';
import { Button } from '../components/base/Button.js';
import { Input } from '../components/base/Input.js';
import { DataManagementPanel } from '../components/data-management/DataManagementPanel.js';
import { dataAccess } from '../data/data-access.js';
import { useAppStore } from '../stores/app-store.js';
import { useToastStore } from '../stores/toast-store.js';
import type { User } from '@shared/types/index.js';
import type { Category } from '@shared/types/index.js';

interface PreferenceForm {
  display_name: string;
  base_currency: string;
  is_china_market: number;
  default_withdrawal_rate: number;
  default_expected_return: number;
  default_inflation_rate: number;
}

function userToForm(user: User): PreferenceForm {
  return {
    display_name: user.display_name,
    base_currency: user.base_currency,
    is_china_market: user.is_china_market,
    default_withdrawal_rate: user.default_withdrawal_rate,
    default_expected_return: user.default_expected_return,
    default_inflation_rate: user.default_inflation_rate,
  };
}

// 基点 ↔ 百分比转换（复用 M6 逻辑）
// basis points ↔ percent conversion (reuse M6 logic)
const bpToPercent = (bp: number) => bp / 100;
const percentToBp = (p: number) => Math.round(p * 100);

export function SettingsPage() {
  const currentUser = useAppStore((s) => s.currentUser);
  const setCurrentUser = useAppStore((s) => s.setCurrentUser);
  const showSuccess = useToastStore((s) => s.showSuccess);
  const showError = useToastStore((s) => s.showError);

  const [formData, setFormData] = useState<PreferenceForm | null>(null);
  const [errors, setErrors] = useState<Partial<Record<keyof PreferenceForm, string>>>({});
  const [saving, setSaving] = useState(false);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loadingCats, setLoadingCats] = useState(true);
  const [confirmingReset, setConfirmingReset] = useState(false);
  const [resetting, setResetting] = useState(false);

  // 加载用户偏好到表单
  // Load user preferences into form
  useEffect(() => {
    if (currentUser) {
      setFormData(userToForm(currentUser));
    }
  }, [currentUser]);

  // 加载系统分类
  // Load system categories
  useEffect(() => {
    if (!currentUser) return;
    void loadCategories();
  }, [currentUser]);

  const loadCategories = async () => {
    if (!currentUser) return;
    setLoadingCats(true);
    try {
      const all = await dataAccess.getCategories(currentUser.id);
      setCategories(all.filter((c) => c.is_system === 1 && c.deleted_flag === 0));
    } catch (err) {
      showError(`加载分类失败：${(err as Error).message}`);
    } finally {
      setLoadingCats(false);
    }
  };

  if (!formData || !currentUser) {
    return <div className="p-6 text-gray-500">加载中...</div>;
  }

  const updateField = <K extends keyof PreferenceForm>(field: K, value: PreferenceForm[K]) => {
    setFormData((prev) => (prev ? { ...prev, [field]: value } : prev));
    setErrors((prev) => ({ ...prev, [field]: undefined }));
  };

  const handleMarketChange = (isChina: number) => {
    // 中国 350 / 全球 400，用户可手动覆盖
    // China 350 / Global 400, user can override
    const defaultWithdrawal = isChina ? 350 : 400;
    // 仅在等于另一个市场默认值时才联动（避免覆盖用户手动设置）
    // Only auto-adjust if equal to the other market's default (avoid overriding user edits)
    const otherDefault = isChina ? 400 : 350;
    setFormData((prev) => {
      if (!prev) return prev;
      const shouldAdjust = prev.default_withdrawal_rate === otherDefault;
      return {
        ...prev,
        is_china_market: isChina,
        base_currency: isChina ? 'CNY' : 'USD',
        default_withdrawal_rate: shouldAdjust ? defaultWithdrawal : prev.default_withdrawal_rate,
      };
    });
  };

  const validate = (): boolean => {
    const newErrors: Partial<Record<keyof PreferenceForm, string>> = {};
    const name = formData.display_name.trim();
    if (!name) {
      newErrors.display_name = '请输入显示名称';
    } else if (name.length > 30) {
      newErrors.display_name = '显示名称不能超过 30 字符';
    }
    if (formData.default_withdrawal_rate < 200 || formData.default_withdrawal_rate > 600) {
      newErrors.default_withdrawal_rate = '提现率范围为 200-600 基点';
    }
    if (formData.default_expected_return < 0 || formData.default_expected_return > 2000) {
      newErrors.default_expected_return = '预期回报范围为 0-2000 基点';
    }
    if (formData.default_inflation_rate < 0 || formData.default_inflation_rate > 1000) {
      newErrors.default_inflation_rate = '通胀率范围为 0-1000 基点';
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSave = async () => {
    if (!validate() || !currentUser) return;
    setSaving(true);
    try {
      const updated = await dataAccess.updateUser(currentUser.id, {
        display_name: formData.display_name.trim(),
        is_china_market: formData.is_china_market,
        base_currency: formData.base_currency,
        default_withdrawal_rate: formData.default_withdrawal_rate,
        default_expected_return: formData.default_expected_return,
        default_inflation_rate: formData.default_inflation_rate,
      });
      setCurrentUser(updated);
      showSuccess('偏好设置已保存');
    } catch (err) {
      showError(`保存失败：${(err as Error).message}`);
    } finally {
      setSaving(false);
    }
  };

  const handleReset = () => {
    setFormData(userToForm(currentUser));
    setErrors({});
  };

  const handleResetCategories = async () => {
    if (!currentUser) return;
    setResetting(true);
    try {
      await dataAccess.resetSystemCategories(currentUser.id);
      await loadCategories();
      showSuccess('内置分类已重置');
    } catch (err) {
      showError(`重置失败：${(err as Error).message}`);
    } finally {
      setResetting(false);
      setConfirmingReset(false);
    }
  };

  const expenseCats = categories.filter((c) => c.type === 'expense');
  const incomeCats = categories.filter((c) => c.type === 'income');

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-8">
      {/* 用户偏好区 / Preferences section */}
      <section>
        <h2 className="text-lg font-semibold text-gray-900 mb-4">用户偏好</h2>
        <form onSubmit={(e) => { e.preventDefault(); handleSave(); }} className="space-y-4 bg-white rounded-md border border-gray-200 p-6">
          <Input
            type="text"
            label="显示名称"
            value={formData.display_name}
            error={errors.display_name}
            placeholder="例如：张三"
            onChange={(v) => updateField('display_name', v)}
          />

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">基础货币</label>
            <input
              type="text"
              value={formData.base_currency}
              disabled
              className="w-full h-10 rounded-md border border-gray-300 bg-gray-50 px-3 text-sm text-gray-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">投资市场</label>
            <div className="space-y-2">
              <label className={`flex items-center gap-3 p-3 rounded-md border cursor-pointer ${
                formData.is_china_market === 1 ? 'border-blue-500 bg-blue-50' : 'border-gray-300'
              }`}>
                <input
                  type="radio"
                  name="market"
                  checked={formData.is_china_market === 1}
                  onChange={() => handleMarketChange(1)}
                  className="w-4 h-4"
                />
                <span className="text-sm text-gray-900">中国市场 (CNY)</span>
              </label>
              <label className={`flex items-center gap-3 p-3 rounded-md border cursor-pointer ${
                formData.is_china_market === 0 ? 'border-blue-500 bg-blue-50' : 'border-gray-300'
              }`}>
                <input
                  type="radio"
                  name="market"
                  checked={formData.is_china_market === 0}
                  onChange={() => handleMarketChange(0)}
                  className="w-4 h-4"
                />
                <span className="text-sm text-gray-900">全球市场 (USD)</span>
              </label>
            </div>
          </div>

          <Input
            type="number"
            label="默认提现率"
            value={bpToPercent(formData.default_withdrawal_rate)}
            error={errors.default_withdrawal_rate}
            suffix="%"
            onChange={(v) => updateField('default_withdrawal_rate', percentToBp(Number(v)))}
          />
          <Input
            type="number"
            label="默认预期回报率"
            value={bpToPercent(formData.default_expected_return)}
            error={errors.default_expected_return}
            suffix="%"
            onChange={(v) => updateField('default_expected_return', percentToBp(Number(v)))}
          />
          <Input
            type="number"
            label="默认通胀率"
            value={bpToPercent(formData.default_inflation_rate)}
            error={errors.default_inflation_rate}
            suffix="%"
            onChange={(v) => updateField('default_inflation_rate', percentToBp(Number(v)))}
          />

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="secondary" size="md" onClick={handleReset} disabled={saving}>重置</Button>
            <Button type="submit" variant="primary" size="md" loading={saving}>保存</Button>
          </div>
        </form>
      </section>

      {/* 内置分类区 / System categories section */}
      <section>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-900">内置分类</h2>
          <Button
            variant="danger"
            size="sm"
            onClick={() => setConfirmingReset(true)}
            disabled={resetting}
          >
            重置为默认
          </Button>
        </div>

        {loadingCats ? (
          <p className="text-sm text-gray-500">加载中...</p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="bg-white rounded-md border border-gray-200 p-4">
              <h3 className="text-sm font-medium text-gray-700 mb-3">支出分类 ({expenseCats.length})</h3>
              <ul className="space-y-1">
                {expenseCats.map((c) => (
                  <li key={c.id} className="text-sm text-gray-900">{c.name}</li>
                ))}
              </ul>
            </div>
            <div className="bg-white rounded-md border border-gray-200 p-4">
              <h3 className="text-sm font-medium text-gray-700 mb-3">收入分类 ({incomeCats.length})</h3>
              <ul className="space-y-1">
                {incomeCats.map((c) => (
                  <li key={c.id} className="text-sm text-gray-900">{c.name}</li>
                ))}
              </ul>
            </div>
          </div>
        )}
      </section>

      {/* 数据管理区 / Data management section */}
      <section>
        <DataManagementPanel />
      </section>

      {/* 重置确认对话框 / Reset confirmation dialog */}
      {confirmingReset && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-sm w-full mx-4">
            <h3 className="text-base font-semibold text-gray-900 mb-2">确认重置内置分类</h3>
            <p className="text-sm text-gray-600 mb-4">
              将软删除现有内置分类并重新生成 18 个默认分类。你的自定义分类不受影响。
            </p>
            <div className="flex justify-end gap-2">
              <Button variant="secondary" size="md" onClick={() => setConfirmingReset(false)} disabled={resetting}>
                取消
              </Button>
              <Button variant="danger" size="md" onClick={handleResetCategories} loading={resetting}>
                确认重置
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
