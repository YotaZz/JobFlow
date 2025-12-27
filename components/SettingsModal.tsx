import React, { useState, useEffect } from 'react';
import { X, Plus, Trash, RotateCcw } from 'lucide-react';
import { DEFAULT_STEPS } from '../constants';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  defaultSteps: string[];
  onSave: (steps: string[]) => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({ isOpen, onClose, defaultSteps, onSave }) => {
  const [steps, setSteps] = useState<string[]>([]);

  useEffect(() => {
    if (isOpen) {
      setSteps([...defaultSteps]);
    }
  }, [isOpen, defaultSteps]);

  const handleSave = () => {
    onSave(steps);
    onClose();
  };

  const updateStep = (idx: number, val: string) => {
    const newSteps = [...steps];
    newSteps[idx] = val;
    setSteps(newSteps);
  };

  const removeStep = (idx: number) => {
    if (steps.length <= 1) return;
    setSteps(steps.filter((_, i) => i !== idx));
  };

  const addStep = () => {
    // Insert before last node
    const newSteps = [...steps];
    const insertIndex = Math.max(0, newSteps.length - 1);
    newSteps.splice(insertIndex, 0, "新节点");
    setSteps(newSteps);
  };

  const resetToSystem = () => {
    if (confirm("确定要恢复到系统默认设置吗？")) {
        setSteps([...DEFAULT_STEPS]);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in duration-200">
        <div className="p-5 border-b border-slate-100 flex justify-between items-center">
          <h2 className="text-xl font-bold text-slate-800">全局流程设置</h2>
          <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-full text-slate-500">
            <X size={20} />
          </button>
        </div>

        <div className="p-6 max-h-[60vh] overflow-y-auto">
          <p className="text-sm text-slate-500 mb-4">
            设置默认的招聘流程节点。前两个节点（已投递、初筛）和最后一个节点（OC）为系统固定，不可修改。
          </p>

          <div className="space-y-3">
            {steps.map((step, idx) => {
               const isFixed = idx === 0 || idx === 1 || idx === steps.length - 1;

               return (
                <div key={idx} className="flex gap-2">
                    <input
                        type="text"
                        value={step}
                        onChange={(e) => updateStep(idx, e.target.value)}
                        disabled={isFixed}
                        className={`flex-1 px-3 py-2 border rounded-lg outline-none transition-colors
                           ${isFixed 
                                ? 'bg-slate-100 text-slate-500 border-slate-200' 
                                : 'border-slate-300 focus:ring-2 focus:ring-blue-500 bg-white'
                            }`}
                    />
                    <button
                        onClick={() => removeStep(idx)}
                        disabled={isFixed}
                        className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg disabled:opacity-0 disabled:pointer-events-none transition-all"
                    >
                        <Trash size={18} />
                    </button>
                </div>
               );
            })}
          </div>
            
          <button
            onClick={addStep}
            className="w-full mt-4 py-2 border-2 border-dashed border-slate-200 text-slate-500 rounded-lg hover:border-blue-400 hover:text-blue-600 transition-colors flex items-center justify-center gap-2"
          >
            <Plus size={16} /> 添加默认节点
          </button>

          <button 
             onClick={resetToSystem}
             className="mt-6 text-xs text-slate-400 hover:text-slate-600 flex items-center gap-1 mx-auto"
          >
            <RotateCcw size={12} /> 恢复系统默认
          </button>
        </div>

        <div className="p-5 border-t border-slate-100 bg-slate-50 flex justify-end gap-3">
            <button
                onClick={onClose}
                className="px-4 py-2 text-slate-600 font-medium hover:bg-slate-200 rounded-lg"
            >
                取消
            </button>
            <button
                onClick={handleSave}
                className="px-4 py-2 bg-slate-900 text-white font-medium rounded-lg hover:bg-slate-800"
            >
                保存设置
            </button>
        </div>
      </div>
    </div>
  );
};