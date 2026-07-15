// 临时占位 OnboardingPage（Task 5 替换为完整版本）
import { useNavigate } from 'react-router-dom';

export function OnboardingPage() {
  const navigate = useNavigate();
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="text-center">
        <h1 className="text-2xl font-bold text-gray-900">FIRE 计算APP</h1>
        <p className="text-gray-500 mt-2">Onboarding 向导将在 Task 5 实现</p>
        <button
          onClick={() => navigate('/')}
          className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
        >
          临时跳转
        </button>
      </div>
    </div>
  );
}
