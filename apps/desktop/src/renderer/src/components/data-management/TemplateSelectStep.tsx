// 步骤 1：选择导入模板 / Step 1: Select import template

import { getAllTemplates } from '@shared/import-templates/registry.js';

interface TemplateSelectStepProps {
  selectedTemplateId: string;
  onSelect: (id: string) => void;
}

export function TemplateSelectStep({ selectedTemplateId, onSelect }: TemplateSelectStepProps) {
  const templates = getAllTemplates();
  return (
    <div className="space-y-3">
      <h3 className="text-base font-semibold text-gray-900">选择导入模板</h3>
      <div className="grid grid-cols-2 gap-3">
        {templates.map(t => (
          <button
            key={t.id}
            onClick={() => onSelect(t.id)}
            className={`p-4 text-left rounded-lg border transition ${
              selectedTemplateId === t.id ? 'border-blue-600 bg-blue-50' : 'border-gray-200 hover:border-blue-300'
            }`}
          >
            <div className="font-medium text-gray-900">{t.displayName}</div>
            <div className="text-xs text-gray-500 mt-1">{t.description}</div>
          </button>
        ))}
      </div>
    </div>
  );
}
