import React, { useState } from 'react'; // 引入 useState
import { X, Save, RotateCcw, Lock } from 'lucide-react'; // 引入 Lock 图标
import { supabase } from '../supabaseClient'; // 引入 supabase

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  defaultSteps: string[];
  onSave: (steps: string[]) => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({ isOpen, onClose, defaultSteps, onSave }) => {
  const [steps, setSteps] = useState(defaultSteps.join('\n'));
  
  // 新增：密码修改状态
  const [newPassword, setNewPassword] = useState('');
  const [passwordStatus, setPasswordStatus] = useState<{msg: string, type: 'success'|'error'|''} >({ msg: '', type: '' });
  const [passwordLoading, setPasswordLoading] = useState(false);

  if (!isOpen) return null;

  const handleSave = () => {
    const stepsArray = steps.split('\n').map(s => s.trim()).filter(s => s);
    onSave(stepsArray);
    onClose();
  };

  const handleReset = () => {
    if (window.confirm('确定要恢复默认流程吗？')) {
      const DEFAULT_STEPS = [
        '已投递',
        '初筛',
        '笔试',
        '一面',
        '二面',
        'HR面',
        'OC'
      ];
      setSteps(DEFAULT_STEPS.join('\n'));
    }
  };

  // 新增：修改密码函数
  const handleUpdatePassword = async () => {
      if (newPassword.length < 6) {
          setPasswordStatus({ msg: '密码长度至少需要6位', type: 'error' });
          return;
      }
      setPasswordLoading(true);
      setPasswordStatus({ msg: '', type: '' });
      
      try {
          const { error } = await supabase.auth.updateUser({ password: newPassword });
          if (error) throw error;
          setPasswordStatus({ msg: '密码修改成功！', type: 'success' });
          setNewPassword('');
      } catch (err: any) {
          setPasswordStatus({ msg: err.message || '修改失败', type: 'error' });
      } finally {
          setPasswordLoading(false);
      }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6 animate-in fade-in zoom-in duration-200 flex flex-col max-h-[90vh]">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-bold text-slate-800">系统设置</h2>
          <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-full text-slate-500">
            <X size={20} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto pr-2">
            {/* 流程设置部分 */}
            <div className="mb-8">
                <label className="block text-sm font-medium text-slate-700 mb-2">默认求职流程配置</label>
                <p className="text-xs text-slate-500 mb-3">每行代表一个节点，支持自定义顺序</p>
                <textarea 
                    value={steps}
                    onChange={(e) => setSteps(e.target.value)}
                    className="w-full h-48 p-3 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none resize-none font-mono"
                    placeholder="输入流程步骤..."
                />
                <div className="mt-2 flex justify-end">
                    <button onClick={handleReset} className="text-xs text-slate-400 hover:text-red-500 flex items-center gap-1">
                        <RotateCcw size={12} /> 恢复默认
                    </button>
                </div>
            </div>

            {/* 新增：账号安全部分 */}
            <div className="border-t border-slate-100 pt-6">
                <h3 className="text-sm font-bold text-slate-800 mb-4 flex items-center gap-2">
                    <Lock size={16} className="text-slate-500"/> 账号安全
                </h3>
                <div className="bg-slate-50 p-4 rounded-lg">
                    <label className="block text-xs font-medium text-slate-600 mb-2">设置新密码</label>
                    <div className="flex gap-2">
                        <input 
                            type="password" 
                            value={newPassword}
                            onChange={(e) => setNewPassword(e.target.value)}
                            placeholder="输入新密码 (至少6位)"
                            className="flex-1 px-3 py-2 border border-slate-300 rounded-md text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                        />
                        <button 
                            onClick={handleUpdatePassword}
                            disabled={!newPassword || passwordLoading}
                            className="px-4 py-2 bg-slate-800 text-white text-sm font-medium rounded-md hover:bg-slate-900 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {passwordLoading ? '更新中...' : '更新'}
                        </button>
                    </div>
                    {passwordStatus.msg && (
                        <div className={`text-xs mt-2 ${passwordStatus.type === 'success' ? 'text-emerald-600' : 'text-red-600'}`}>
                            {passwordStatus.msg}
                        </div>
                    )}
                </div>
            </div>
        </div>

        <div className="mt-6 pt-4 border-t border-slate-100 flex justify-end gap-3">
          <button onClick={onClose} className="px-4 py-2 text-slate-600 font-medium hover:bg-slate-100 rounded-lg">取消</button>
          <button onClick={handleSave} className="px-6 py-2 bg-blue-600 text-white font-bold rounded-lg hover:bg-blue-700 shadow-md active:scale-95 flex items-center gap-2">
            <Save size={18} /> 保存配置
          </button>
        </div>
      </div>
    </div>
  );
};