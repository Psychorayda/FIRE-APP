// 场景列表侧边栏 / Scenario list sidebar
// 展示场景列表 + 新建按钮，纯展示组件
// Displays scenario list + create button, pure presentational

import type { FireScenario } from '@shared/types/index.js';

interface ScenarioSidebarProps {
  scenarios: FireScenario[];
  currentId: string;
  onSelect: (id: string) => void;
  onCreate: () => void;
}

export function ScenarioSidebar({ scenarios, currentId, onSelect, onCreate }: ScenarioSidebarProps) {
  return (
    <div className="w-60 border-r border-gray-200 bg-gray-50 flex flex-col">
      <div className="p-4">
        <button
          onClick={onCreate}
          className="w-full bg-blue-500 text-white px-3 py-2 rounded text-sm hover:bg-blue-600"
        >
          + 新建场景
        </button>
      </div>
      <div className="flex-1 overflow-auto px-2 pb-4 space-y-1">
        {scenarios.map((s) => (
          <button
            key={s.id}
            onClick={() => onSelect(s.id)}
            className={`w-full text-left px-3 py-2 rounded text-sm border-l-2 ${
              s.id === currentId
                ? 'bg-blue-50 border-blue-500 text-gray-900'
                : 'border-transparent text-gray-600 hover:bg-gray-100'
            }`}
          >
            <div className="font-medium truncate">{s.name}</div>
            {s.description && (
              <div className="text-xs text-gray-400 truncate mt-0.5">{s.description}</div>
            )}
          </button>
        ))}
      </div>
    </div>
  );
}
