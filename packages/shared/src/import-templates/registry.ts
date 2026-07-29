import type { CsvImportTemplate } from './types.js';
import { alipayTemplate } from './alipay.js';
import { wechatPayTemplate } from './wechat-pay.js';
import { cmbDebitTemplate } from './cmb-debit.js';
import { icbcDebitTemplate } from './icbc-debit.js';
import { ccbDebitTemplate } from './ccb-debit.js';
import { bocDebitTemplate } from './boc-debit.js';
import { rcuDebitTemplate } from './rcu-debit.js';

const TEMPLATES: CsvImportTemplate[] = [
  alipayTemplate, wechatPayTemplate, cmbDebitTemplate,
  icbcDebitTemplate, ccbDebitTemplate, bocDebitTemplate, rcuDebitTemplate,
];

export function getAllTemplates(): CsvImportTemplate[] {
  return TEMPLATES;
}

export function getTemplate(id: string): CsvImportTemplate | undefined {
  return TEMPLATES.find(t => t.id === id);
}

export function detectTemplate(fileHeadContent: string): string | null {
  for (const template of TEMPLATES) {
    if (template.fileSignatures.every(sig => fileHeadContent.includes(sig))) {
      return template.id;
    }
  }
  return null;
}
