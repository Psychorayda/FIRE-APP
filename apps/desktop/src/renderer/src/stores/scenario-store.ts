// FIRE 场景状态管理 / FIRE scenario state management

import { create } from 'zustand';
import type { FireScenario } from '@shared/types/index.js';
import type { CreateScenarioInput } from '@shared/models/scenario.js';
import { dataAccess } from '../data/data-access.js';

interface ScenarioStore {
  scenarios: FireScenario[];
  loading: boolean;
  error: string | null;

  fetchScenarios: (userId: string) => Promise<void>;
  createScenario: (input: CreateScenarioInput, userId: string) => Promise<void>;
  updateScenario: (id: string, updates: Partial<FireScenario>, userId: string) => Promise<void>;
  clear: () => void;
}

export const useScenarioStore = create<ScenarioStore>((set) => ({
  scenarios: [],
  loading: false,
  error: null,

  fetchScenarios: async (userId) => {
    set({ loading: true, error: null });
    try {
      const scenarios = await dataAccess.getScenarios(userId);
      set({ scenarios, loading: false });
    } catch (err) {
      set({ error: (err as Error).message, loading: false });
    }
  },

  createScenario: async (input, userId) => {
    set({ loading: true, error: null });
    try {
      await dataAccess.createScenario(input);
      const scenarios = await dataAccess.getScenarios(userId);
      set({ scenarios, loading: false });
    } catch (err) {
      set({ error: (err as Error).message, loading: false });
    }
  },

  updateScenario: async (id, updates, userId) => {
    set({ loading: true, error: null });
    try {
      await dataAccess.updateScenario(id, updates);
      const scenarios = await dataAccess.getScenarios(userId);
      set({ scenarios, loading: false });
    } catch (err) {
      set({ error: (err as Error).message, loading: false });
    }
  },

  clear: () => set({ scenarios: [], error: null, loading: false }),
}));
