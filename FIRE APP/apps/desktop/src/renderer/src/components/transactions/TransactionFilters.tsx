// 交易筛选组件 / Transaction filter component
// 受控组件：5 个筛选项（类型/账户/分类/开始日期/结束日期）+ 重置按钮
// Controlled component: 5 filters (type/account/category/dateFrom/dateTo) + reset button

import type { Account, Category } from '@shared/types/index.js';
import type { TransactionFilters as Filters } from './transaction-constants.js';
import { Select } from '../base/Select.js';
import { Input } from '../base/Input.js';
import { Button } from '../base/Button.js';
import { TRANSACTION_TYPE_OPTIONS } from './transaction-constants.js';

interface TransactionFiltersProps {
  filters: Filters;
  accounts: Account[];
  categories: Category[];
  onFiltersChange: (f: Filters) => void;
  onReset: () => void;
}

// 类型选项：全部类型 + 4 种交易类型
// Type options: all types + 4 transaction types
const TYPE_OPTIONS = [{ label: '全部类型', value: '' }, ...TRANSACTION_TYPE_OPTIONS];

export function TransactionFilters({ filters, accounts, categories, onFiltersChange, onReset }: TransactionFiltersProps) {
  const accountOptions = [
    { label: '全部账户', value: '' },
    ...accounts.map((a) => ({ label: a.name, value: a.id })),
  ];
  const categoryOptions = [
    { label: '全部分类', value: '' },
    ...categories.map((c) => ({ label: c.name, value: c.id })),
  ];

  const update = (patch: Partial<Filters>) => onFiltersChange({ ...filters, ...patch });

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-4">
      <div className="grid grid-cols-5 gap-3">
        <Select options={TYPE_OPTIONS} value={filters.type} onChange={(v) => update({ type: v })} />
        <Select options={accountOptions} value={filters.account_id} onChange={(v) => update({ account_id: v })} />
        <Select options={categoryOptions} value={filters.category_id} onChange={(v) => update({ category_id: v })} />
        <Input type="date" value={filters.dateFrom} onChange={(v) => update({ dateFrom: v })} />
        <Input type="date" value={filters.dateTo} onChange={(v) => update({ dateTo: v })} />
      </div>
      <div className="mt-3 flex justify-end">
        <Button variant="secondary" size="sm" onClick={onReset}>重置</Button>
      </div>
    </div>
  );
}
