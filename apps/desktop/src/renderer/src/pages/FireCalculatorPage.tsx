// FIRE 计算器页 / FIRE calculator page
// 多场景管理 + 参数表单（手动保存）+ 实时投影 + 结果展示
// Multi-scenario + form (manual save) + realtime projection + results

import { useEffect, useState } from 'react';
import { useAppStore } from '../stores/app-store.js';
import { useScenarioStore } from '../stores/scenario-store.js';
import { dataAccess } from '../data/data-access.js';
import { createDefaultScenarioInput } from '../components/fire-calculator/fire-calc-constants.js';
import { FireIntro } from '../components/fire-calculator/FireIntro.js';
import { ScenarioSidebar } from '../components/fire-calculator/ScenarioSidebar.js';
import { ScenarioForm } from '../components/fire-calculator/ScenarioForm.js';
import { ResultCards } from '../components/fire-calculator/ResultCards.js';
import { ProgressGauge } from '../components/fire-calculator/ProgressGauge.js';
import { ProjectionChart } from '../components/fire-calculator/ProjectionChart.js';

export function FireCalculatorPage() {
  const currentUser = useAppStore((s) => s.currentUser);
  const {
    scenarios,
    currentScenarioId,
    projectionResult,
    projectionLoading,
    loading,
    error,
    fetchScenarios,
    createScenario,
    updateScenario,
    selectScenario,
    runProjection,
  } = useScenarioStore();
  const [investableBalance, setInvestableBalance] = useState<number | null>(null);

  useEffect(() => {
    if (currentUser) {
      void fetchScenarios(currentUser.id);
    }
  }, [currentUser, fetchScenarios]);

  const currentScenario = scenarios.find((s) => s.id === currentScenarioId);

  // auto_sync 时获取 investableBalance
  // Fetch investableBalance when auto_sync is on
  useEffect(() => {
    if (currentUser && currentScenario?.auto_sync_assets === 1) {
      dataAccess
        .getInvestableBalance(currentUser.id)
        .then((v) => setInvestableBalance(v))
        .catch(() => setInvestableBalance(null));
    } else {
      setInvestableBalance(null);
    }
  }, [currentUser, currentScenario?.auto_sync_assets, currentScenario?.id]);

  if (loading && scenarios.length === 0) {
    return <div className="p-8">加载中...</div>;
  }

  if (error && scenarios.length === 0) {
    return <div className="p-8 text-red-600">数据加载失败，请重试</div>;
  }

  // 无场景 → 介绍页
  // No scenarios → intro
  if (scenarios.length === 0) {
    return (
      <FireIntro
        onCreate={() =>
          createScenario(
            createDefaultScenarioInput(currentUser!, '我的 FIRE 计划'),
            currentUser!.id
          )
        }
      />
    );
  }

  return (
    <div className="flex h-full">
      <ScenarioSidebar
        scenarios={scenarios}
        currentId={currentScenario!.id}
        onSelect={selectScenario}
        onCreate={() =>
          createScenario(
            createDefaultScenarioInput(currentUser!, '新场景'),
            currentUser!.id
          )
        }
      />
      <div className="flex-1 flex flex-col overflow-auto">
        <div className="p-8 space-y-6">
          <h1 className="text-2xl font-bold text-gray-900">FIRE 计算器</h1>

          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700 text-sm">
              {error}
            </div>
          )}

          <ScenarioForm
            scenario={currentScenario!}
            onSave={(updates) => {
              const updated = { ...currentScenario!, ...updates };
              updateScenario(currentScenario!.id, updates, currentUser!.id);
              void runProjection(updated);
            }}
            investableBalance={investableBalance}
          />

          <ResultCards result={projectionResult} loading={projectionLoading} />

          <div className="grid grid-cols-2 gap-4">
            <ProgressGauge
              progress={projectionResult?.progress ?? 0}
              fireNumber={projectionResult?.adjusted_fire_number ?? 0}
              currentValue={
                currentScenario?.auto_sync_assets === 1
                  ? investableBalance ?? 0
                  : currentScenario?.current_portfolio_value ?? 0
              }
            />
            <ProjectionChart
              data={projectionResult?.monthly_projection ?? []}
              fireNumber={projectionResult?.fire_number ?? 0}
              loading={projectionLoading}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
