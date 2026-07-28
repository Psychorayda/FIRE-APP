// Onboarding 向导页 / Onboarding wizard page
// 5 步引导：欢迎 → 显示名称 → 市场选择 → 利率偏好 → 确认完成

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '../components/base/Button.js';
import { Input } from '../components/base/Input.js';
import { dataAccess } from '../data/data-access.js';
import { useAppStore } from '../stores/app-store.js';
import { useToastStore } from '../stores/toast-store.js';

interface OnboardingFormData {
  display_name: string;
  is_china_market: number;
  default_withdrawal_rate: number;
  default_expected_return: number;
  default_inflation_rate: number;
}

const MARKET_DEFAULTS = {
  china: { withdrawal: 350, expected: 700, inflation: 300, currency: 'CNY' },
  global: { withdrawal: 400, expected: 700, inflation: 300, currency: 'USD' },
};

export function OnboardingPage() {
  const navigate = useNavigate();
  const completeOnboarding = useAppStore((s) => s.completeOnboarding);
  const showSuccess = useToastStore((s) => s.showSuccess);
  const showError = useToastStore((s) => s.showError);

  const [step, setStep] = useState(1);
  const [formData, setFormData] = useState<OnboardingFormData>({
    display_name: '',
    is_china_market: 1,
    default_withdrawal_rate: 350,
    default_expected_return: 700,
    default_inflation_rate: 300,
  });
  const [errors, setErrors] = useState<Partial<Record<keyof OnboardingFormData, string>>>({});
  const [submitting, setSubmitting] = useState(false);

  const updateField = <K extends keyof OnboardingFormData>(field: K, value: OnboardingFormData[K]) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    setErrors((prev) => ({ ...prev, [field]: undefined }));
  };

  const handleMarketChange = (isChina: number) => {
    const defaults = isChina ? MARKET_DEFAULTS.china : MARKET_DEFAULTS.global;
    setFormData((prev) => ({
      ...prev,
      is_china_market: isChina,
      default_withdrawal_rate: defaults.withdrawal,
      default_expected_return: defaults.expected,
      default_inflation_rate: defaults.inflation,
    }));
  };

  const validateStep = (stepNum: number): boolean => {
    const newErrors: Partial<Record<keyof OnboardingFormData, string>> = {};

    if (stepNum === 2) {
      const name = formData.display_name.trim();
      if (!name) {
        newErrors.display_name = '请输入显示名称';
      } else if (name.length > 20) {
        newErrors.display_name = '显示名称不能超过 20 字符';
      }
    }

    if (stepNum === 4) {
      if (formData.default_withdrawal_rate < 200 || formData.default_withdrawal_rate > 600) {
        newErrors.default_withdrawal_rate = '提现率范围为 200-600 基点';
      }
      if (formData.default_expected_return < 0 || formData.default_expected_return > 2000) {
        newErrors.default_expected_return = '预期回报范围为 0-2000 基点';
      }
      if (formData.default_inflation_rate < 0 || formData.default_inflation_rate > 1000) {
        newErrors.default_inflation_rate = '通胀率范围为 0-1000 基点';
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleNext = () => {
    if (validateStep(step)) {
      setStep((s) => Math.min(s + 1, 5));
    }
  };

  const handlePrev = () => {
    setStep((s) => Math.max(s - 1, 1));
  };

  const handleSubmit = async () => {
    setSubmitting(true);
    try {
      const user = await dataAccess.createUser({
        display_name: formData.display_name.trim(),
        is_china_market: formData.is_china_market,
        base_currency: formData.is_china_market ? 'CNY' : 'USD',
        default_withdrawal_rate: formData.default_withdrawal_rate,
        default_expected_return: formData.default_expected_return,
        default_inflation_rate: formData.default_inflation_rate,
      });

      await dataAccess.seedCategories(user.id);

      completeOnboarding(user);
      showSuccess('账户创建成功，欢迎使用 FIRE 计算APP！');
      navigate('/');
    } catch (err) {
      showError(`创建失败：${(err as Error).message}`);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="w-full max-w-lg bg-white rounded-lg shadow-sm p-8">
        {/* 步骤进度条 */}
        <div className="flex items-center justify-center mb-8">
          {[1, 2, 3, 4, 5].map((s, i) => (
            <div key={s} className="flex items-center">
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                  s <= step ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-400'
                }`}
              >
                {s}
              </div>
              {i < 4 && <div className={`w-12 h-0.5 ${s < step ? 'bg-blue-600' : 'bg-gray-200'}`} />}
            </div>
          ))}
        </div>

        {/* 步骤 1: 欢迎页 */}
        {step === 1 && (
          <div className="text-center">
            <h1 className="text-2xl font-bold text-gray-900 mb-4">FIRE 计算APP</h1>
            <p className="text-gray-600 mb-2"> Financial Independence, Retire Early</p>
            <p className="text-sm text-gray-500 mb-8">
              帮助你规划财务自由之路，从记账到退休投影，一站式管理你的 FIRE 旅程。
            </p>
            <Button variant="primary" size="lg" onClick={handleNext}>
              开始使用
            </Button>
          </div>
        )}

        {/* 步骤 2: 输入显示名称 */}
        {step === 2 && (
          <div>
            <h2 className="text-lg font-semibold text-gray-900 mb-4">输入显示名称</h2>
            <Input
              type="text"
              label="显示名称"
              value={formData.display_name}
              error={errors.display_name}
              placeholder="例如：张三"
              required
              onChange={(v) => updateField('display_name', v)}
            />
            <div className="flex justify-end gap-2 mt-6">
              <Button variant="secondary" size="md" onClick={handlePrev}>上一步</Button>
              <Button variant="primary" size="md" onClick={handleNext}>下一步</Button>
            </div>
          </div>
        )}

        {/* 步骤 3: 选择市场 */}
        {step === 3 && (
          <div>
            <h2 className="text-lg font-semibold text-gray-900 mb-4">选择市场</h2>
            <p className="text-sm text-gray-500 mb-4">选择你的主要投资市场，影响默认利率偏好。</p>
            <div className="space-y-3">
              <label className={`flex items-center gap-3 p-4 rounded-md border cursor-pointer ${
                formData.is_china_market === 1 ? 'border-blue-500 bg-blue-50' : 'border-gray-300'
              }`}>
                <input
                  type="radio"
                  name="market"
                  checked={formData.is_china_market === 1}
                  onChange={() => handleMarketChange(1)}
                  className="w-4 h-4"
                />
                <div>
                  <p className="font-medium text-gray-900">中国市场</p>
                  <p className="text-sm text-gray-500">货币：CNY，默认提现率 3.5%</p>
                </div>
              </label>
              <label className={`flex items-center gap-3 p-4 rounded-md border cursor-pointer ${
                formData.is_china_market === 0 ? 'border-blue-500 bg-blue-50' : 'border-gray-300'
              }`}>
                <input
                  type="radio"
                  name="market"
                  checked={formData.is_china_market === 0}
                  onChange={() => handleMarketChange(0)}
                  className="w-4 h-4"
                />
                <div>
                  <p className="font-medium text-gray-900">全球市场</p>
                  <p className="text-sm text-gray-500">货币：USD，默认提现率 4%</p>
                </div>
              </label>
            </div>
            <div className="flex justify-end gap-2 mt-6">
              <Button variant="secondary" size="md" onClick={handlePrev}>上一步</Button>
              <Button variant="primary" size="md" onClick={handleNext}>下一步</Button>
            </div>
          </div>
        )}

        {/* 步骤 4: 确认利率偏好 */}
        {step === 4 && (
          <div>
            <h2 className="text-lg font-semibold text-gray-900 mb-4">确认默认利率偏好</h2>
            <p className="text-sm text-gray-500 mb-4">以下为基于市场选择的默认值，可调整（单位：基点）。</p>
            <div className="space-y-4">
              <Input
                type="number"
                label="默认提现率"
                value={formData.default_withdrawal_rate}
                error={errors.default_withdrawal_rate}
                suffix="bps"
                onChange={(v) => updateField('default_withdrawal_rate', Number(v))}
              />
              <Input
                type="number"
                label="默认预期回报率"
                value={formData.default_expected_return}
                error={errors.default_expected_return}
                suffix="bps"
                onChange={(v) => updateField('default_expected_return', Number(v))}
              />
              <Input
                type="number"
                label="默认通胀率"
                value={formData.default_inflation_rate}
                error={errors.default_inflation_rate}
                suffix="bps"
                onChange={(v) => updateField('default_inflation_rate', Number(v))}
              />
            </div>
            <div className="flex justify-end gap-2 mt-6">
              <Button variant="secondary" size="md" onClick={handlePrev}>上一步</Button>
              <Button variant="primary" size="md" onClick={handleNext}>下一步</Button>
            </div>
          </div>
        )}

        {/* 步骤 5: 确认完成 */}
        {step === 5 && (
          <div>
            <h2 className="text-lg font-semibold text-gray-900 mb-4">确认信息</h2>
            <div className="space-y-3 bg-gray-50 rounded-md p-4">
              <div className="flex justify-between">
                <span className="text-sm text-gray-500">显示名称</span>
                <span className="text-sm font-medium text-gray-900">{formData.display_name.trim()}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-gray-500">市场</span>
                <span className="text-sm font-medium text-gray-900">
                  {formData.is_china_market ? '中国市场 (CNY)' : '全球市场 (USD)'}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-gray-500">提现率</span>
                <span className="text-sm font-medium text-gray-900">{formData.default_withdrawal_rate} bps ({formData.default_withdrawal_rate / 100}%)</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-gray-500">预期回报率</span>
                <span className="text-sm font-medium text-gray-900">{formData.default_expected_return} bps ({formData.default_expected_return / 100}%)</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-gray-500">通胀率</span>
                <span className="text-sm font-medium text-gray-900">{formData.default_inflation_rate} bps ({formData.default_inflation_rate / 100}%)</span>
              </div>
            </div>
            <div className="flex justify-end gap-2 mt-6">
              <Button variant="secondary" size="md" onClick={handlePrev} disabled={submitting}>上一步</Button>
              <Button variant="primary" size="md" onClick={handleSubmit} loading={submitting}>
                完成创建
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
