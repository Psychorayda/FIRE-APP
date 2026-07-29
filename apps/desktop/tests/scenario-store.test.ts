// 场景 store 测试 / Scenario store tests

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { useScenarioStore } from '@renderer/stores/scenario-store.js';
import type { FireScenario } from '@shared/types/index.js';
import type { ProjectionResult } from '@shared/services/fire-calc.js';

function makeScenario(overrides: Partial<FireScenario>): FireScenario {
  return {
    id: 'scn-1',
    user_id: 'user-1',
    name: '标准计划',
    description: null,
    current_age: 30,
    retirement_age: 55,
    current_portfolio_value: 10000000,
    auto_sync_assets: 0,
    monthly_savings: 100000,
    annual_expenses: 6000000,
    expected_return_rate: 700,
    inflation_rate: 300,
    withdrawal_rate: 400,
    retirement_years: 30,
    post_retirement_monthly_income: 0,
    is_china_market: 1,
    is_active: 1,
    sync_version: 0,
    updated_at: 0,
    deleted_flag: 0,
    ...overrides,
  };
}

function makeProjection(): ProjectionResult {
  return {
    fire_number: 1500000000,
    adjusted_fire_number: 1500000000,
    retirement_portfolio: 2000000000,
    progress: 66.7,
    monthly_projection: [],
  };
}

describe('scenario-store', () => {
  beforeEach(() => {
    useScenarioStore.getState().clear();
    vi.clearAllMocks();
    // 重置 mock 返回值
    (window.dataAccess.scenario.list as any).mockResolvedValue([]);
    (window.dataAccess.scenario.create as any).mockResolvedValue(undefined);
    (window.dataAccess.scenario.update as any).mockResolvedValue(undefined);
    (window.dataAccess.fireCalc.runProjection as any).mockResolvedValue(makeProjection());
  });

  it('初始状态：currentScenarioId=null, projectionResult=null, projectionLoading=false', () => {
    const state = useScenarioStore.getState();
    expect(state.currentScenarioId).toBeNull();
    expect(state.projectionResult).toBeNull();
    expect(state.projectionLoading).toBe(false);
  });

  it('fetchScenarios 加载后选中第一个并触发 runProjection', async () => {
    const scenarios = [makeScenario({ id: 'scn-1' }), makeScenario({ id: 'scn-2' })];
    (window.dataAccess.scenario.list as any).mockResolvedValue(scenarios);

    await useScenarioStore.getState().fetchScenarios('user-1');

    const state = useScenarioStore.getState();
    expect(state.scenarios).toHaveLength(2);
    expect(state.currentScenarioId).toBe('scn-1');
    expect(state.projectionLoading).toBe(false);
    expect(state.projectionResult).not.toBeNull();
    expect(window.dataAccess.fireCalc.runProjection).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'scn-1' })
    );
  });

  it('fetchScenarios 空列表不触发 runProjection', async () => {
    (window.dataAccess.scenario.list as any).mockResolvedValue([]);

    await useScenarioStore.getState().fetchScenarios('user-1');

    const state = useScenarioStore.getState();
    expect(state.scenarios).toEqual([]);
    expect(state.currentScenarioId).toBeNull();
    expect(window.dataAccess.fireCalc.runProjection).not.toHaveBeenCalled();
  });

  it('selectScenario 切换并触发 runProjection', async () => {
    const scenarios = [makeScenario({ id: 'scn-1' }), makeScenario({ id: 'scn-2' })];
    (window.dataAccess.scenario.list as any).mockResolvedValue(scenarios);
    await useScenarioStore.getState().fetchScenarios('user-1');
    vi.clearAllMocks();

    useScenarioStore.getState().selectScenario('scn-2');

    const state = useScenarioStore.getState();
    expect(state.currentScenarioId).toBe('scn-2');
    expect(window.dataAccess.fireCalc.runProjection).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'scn-2' })
    );
  });

  it('createScenario 后选中新场景并触发 runProjection', async () => {
    (window.dataAccess.scenario.list as any)
      .mockResolvedValueOnce([]) // fetchScenarios
      .mockResolvedValueOnce([makeScenario({ id: 'scn-new', name: '新场景' })]); // createScenario 后刷新

    await useScenarioStore.getState().fetchScenarios('user-1');
    vi.clearAllMocks();

    await useScenarioStore.getState().createScenario({
      user_id: 'user-1',
      name: '新场景',
      current_age: 30,
      retirement_age: 55,
      annual_expenses: 6000000,
      expected_return_rate: 700,
      withdrawal_rate: 400,
    }, 'user-1');

    const state = useScenarioStore.getState();
    expect(state.currentScenarioId).toBe('scn-new');
    expect(window.dataAccess.fireCalc.runProjection).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'scn-new' })
    );
  });

  it('updateScenario 乐观更新本地并直接持久化（无 debounce）', async () => {
    (window.dataAccess.scenario.list as any).mockResolvedValue(
      [makeScenario({ id: 'scn-1', current_age: 30 })]
    );
    await useScenarioStore.getState().fetchScenarios('user-1');
    vi.clearAllMocks();

    // 更新后 list 返回已更新的场景
    // After update, list returns updated scenario
    (window.dataAccess.scenario.list as any).mockResolvedValue(
      [makeScenario({ id: 'scn-1', current_age: 35 })]
    );

    await useScenarioStore.getState().updateScenario('scn-1', { current_age: 35 }, 'user-1');

    const state = useScenarioStore.getState();
    // 乐观更新立即反映
    expect(state.scenarios[0].current_age).toBe(35);
    // 直接调用 scenario.update（无 debounce 延迟）
    expect(window.dataAccess.scenario.update).toHaveBeenCalledWith('scn-1', { current_age: 35 });
  });

  it('runProjection 设置 projectionLoading 并存储结果', async () => {
    const scenario = makeScenario({ id: 'scn-1' });
    (window.dataAccess.fireCalc.runProjection as any).mockResolvedValue(makeProjection());

    const promise = useScenarioStore.getState().runProjection(scenario);
    expect(useScenarioStore.getState().projectionLoading).toBe(true);

    await promise;

    const state = useScenarioStore.getState();
    expect(state.projectionLoading).toBe(false);
    expect(state.projectionResult).not.toBeNull();
    expect(state.projectionResult!.fire_number).toBe(1500000000);
  });

  it('runProjection 失败设置 error', async () => {
    const scenario = makeScenario({ id: 'scn-1' });
    (window.dataAccess.fireCalc.runProjection as any).mockRejectedValue(new Error('IPC 失败'));

    await useScenarioStore.getState().runProjection(scenario);

    const state = useScenarioStore.getState();
    expect(state.projectionLoading).toBe(false);
    expect(state.error).toBe('IPC 失败');
  });

  it('clear 重置所有状态', async () => {
    const scenarios = [makeScenario({ id: 'scn-1' })];
    (window.dataAccess.scenario.list as any).mockResolvedValue(scenarios);
    await useScenarioStore.getState().fetchScenarios('user-1');

    useScenarioStore.getState().clear();

    const state = useScenarioStore.getState();
    expect(state.scenarios).toEqual([]);
    expect(state.currentScenarioId).toBeNull();
    expect(state.projectionResult).toBeNull();
  });
});
