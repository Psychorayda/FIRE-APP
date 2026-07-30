// 设置页更新区 / Settings page update section
// 显示当前版本 + 最新版本 + 手动检查按钮

import { useUpdateStore } from '../../stores/update-store.js';

export function UpdateSection() {
  const currentVersion = useUpdateStore((s) => s.currentVersion);
  const latestVersion = useUpdateStore((s) => s.latestVersion);
  const phase = useUpdateStore((s) => s.phase);
  const checkForUpdates = useUpdateStore((s) => s.checkForUpdates);
  const openDialog = useUpdateStore((s) => s.openDialog);

  const handleCheck = () => {
    checkForUpdates();
    openDialog();
  };

  // 判断最新版本显示文案
  let latestText = '检查中...';
  if (phase === 'idle' || phase === 'checking') {
    latestText = '未知';
  } else if (phase === 'not-available') {
    latestText = '已是最新';
  } else if (phase === 'available' && latestVersion) {
    latestText = `v${latestVersion}（有更新）`;
  } else if (latestVersion) {
    latestText = `v${latestVersion}`;
  }

  return (
    <div className="rounded-lg border border-gray-200 p-4">
      <h3 className="mb-3 text-base font-semibold text-gray-900">关于 / 更新</h3>
      <div className="space-y-1 text-sm text-gray-600">
        <p>当前版本：v{currentVersion}</p>
        <p>最新版本：{latestText}</p>
      </div>
      <button
        onClick={handleCheck}
        className="mt-3 rounded-md bg-blue-600 px-3 py-1.5 text-sm text-white hover:bg-blue-700"
      >
        检查更新
      </button>
    </div>
  );
}
