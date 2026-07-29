// FIRE 计算器介绍页 / FIRE calculator intro page
// 首次进入无场景时显示，说明 FIRE 概念
// Shown when no scenarios exist, explains FIRE concepts

interface FireIntroProps {
  onCreate: () => void;
}

export function FireIntro({ onCreate }: FireIntroProps) {
  return (
    <div className="max-w-2xl mx-auto py-16 px-4 text-center">
      <h1 className="text-3xl font-bold text-gray-900 mb-6">开始你的 FIRE 之旅</h1>
      <div className="space-y-4 text-left text-gray-600">
        <p>
          <strong className="text-gray-900">FIRE Number</strong> — 退休所需资产目标，计算公式为年度支出 ÷ 提现率。例如年度支出 6 万元、提现率 4%，则 FIRE Number 为 150 万元。
        </p>
        <p>
          <strong className="text-gray-900">4% 规则</strong> — 经典的退休提现率，源于 Trinity 研究。中国市场因波动较大，建议提现率 3.0%-3.5%。
        </p>
        <p>
          <strong className="text-gray-900">积累与提取</strong> — 投影分为两阶段：退休前持续储蓄投资（积累期），退休后按提现率支取（提取期）。面积图将可视化整条路径。
        </p>
      </div>
      <button
        onClick={onCreate}
        className="mt-8 bg-blue-500 text-white px-6 py-2 rounded hover:bg-blue-600"
      >
        创建第一个场景
      </button>
    </div>
  );
}
