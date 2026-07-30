// FIRE 场景状态管理 / FIRE scenario state management
// 含选中场景、投影结果、手动保存（直接持久化）

import { create } from 'zustand';
import type { FireScenario } from '@shared/types/index.js';
import type { CreateScenarioInput } from '@shared/models/scenario.js';
import type { ProjectionResult } from '@shared/services/fire-calc.js';
import { dataAccess } from '../data/data-access.js';

interface ScenarioStore {
  scenarios: FireScenario[];
  loading: boolean;
  error: string | null;
  currentScenarioId: string | null;
  projectionResult: ProjectionResult | null;
  projectionLoading: boolean;

  fetchScenarios: (userId: string) => Promise<void>;
  createScenario: (input: CreateScenarioInput, userId: string) => Promise<void>;
  updateScenario: (id: string, updates: Partial<FireScenario>, userId: string) => Promise<void>;
  selectScenario: (id: string) => void;
  runProjection: (scenario: FireScenario) => Promise<void>;
  clear: () => void;
}

export const useScenarioStore = create<ScenarioStore>((set, get) => ({
  scenarios: [],
  loading: false,
  error: null,
  currentScenarioId: null,
  projectionResult: null,
  projectionLoading: false,

  fetchScenarios: async (userId) => {
    set({ loading: true, error: null });
    try {
      const scenarios = await dataAccess.getScenarios(userId);
      const firstId = scenarios.length > 0 ? scenarios[0].id : null;
      set({ scenarios, loading: false, currentScenarioId: firstId });
      if (firstId) {
        await get().runProjection(scenarios[0]);
      }
    } catch (err) {
      set({ error: (err as Error).message, loading: false });
    }
  },

  createScenario: async (input, userId) => {
    set({ loading: true, error: null });
    try {
      await dataAccess.createScenario(input);
      const scenarios = await dataAccess.getScenarios(userId);
      // 新场景按 updated_at DESC 排在第一个
      // New scenario is first (ORDER BY updated_at DESC)
      const newScenario = scenarios[0];
      set({ scenarios, loading: false, currentScenarioId: newScenario.id });
      await get().runProjection(newScenario);
    } catch (err) {
      set({ error: (err as Error).message, loading: false });
    }
  },

  updateScenario: async (id, updates, userId) => {
    // 乐观更新本地（立即反映 UI）+ 清除上一次 error
    // Optimistic local update (immediate UI reflect) + clear previous error
    set((state) => ({
      scenarios: state.scenarios.map((s) =>
        s.id === id ? { ...s, ...updates } : s
      ),
      error: null,
    }));

    // 直接持久化（手动保存，不再 debounce）
    // Direct persistence (manual save, no debounce)
    try {
      await dataAccess.updateScenario(id, updates);
      const scenarios = await dataAccess.getScenarios(userId);
      set({ scenarios });
    } catch (err) {
      set({ error: (err as Error).message });
    }
  },

  selectScenario: (id) => {
    set({ currentScenarioId: id });
    const scenario = get().scenarios.find((s) => s.id === id);
    if (scenario) {
      void get().runProjection(scenario);
    }
  },

  runProjection: async (scenario) => {
    set({ projectionLoading: true });
    try {
      const result = await dataAccess.runProjection(scenario);
      set({ projectionResult: result, projectionLoading: false });
    } catch (err) {
      set({ error: (err as Error).message, projectionLoading: false });
    }
  },

  clear: () => {
    set({
      scenarios: [],
      error: null,
      loading: false,
      currentScenarioId: null,
      projectionResult: null,
      projectionLoading: false,
    });
  },
}));
