import React, { useState, useEffect } from 'react';
import { X, Plus, Trash, GripVertical, RotateCcw, Briefcase, GraduationCap, Building } from 'lucide-react';
import { JobApplication, JobType, StepStatus } from '../types';

interface JobModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (job: Omit<JobApplication, 'id' | 'updatedAt' | 'createdAt'>, id?: string) => void;
  editingJob: JobApplication | null;
  defaultSteps: string[];
}

export const JobModal: React.FC<JobModalProps> = ({ 
  isOpen, 
  onClose, 
  onSave, 
  editingJob,
  defaultSteps 
}) => {
  const [formData, setFormData] = useState({
    company: '',
    position: '',
    jobType: 'internship' as JobType,
    salary: '',
    notes: '',
    currentStepIndex: 0,
    steps: [] as string[],
    currentStepStatus: 'in-progress' as StepStatus,
    stepDates: {} as Record<number, number>
  });

  // Load data when opening
  useEffect(() => {
    if (isOpen) {
      if (editingJob) {
        setFormData({
          company: editingJob.company,
          position: editingJob.position,
          jobType: editingJob.jobType || 'internship', // Fallback for old data if any
          salary: editingJob.salary,
          notes: editingJob.notes,
          currentStepIndex: editingJob.currentStepIndex,
          steps: [...editingJob.steps],
          currentStepStatus: editingJob.currentStepStatus || 'in-progress',
          stepDates: editingJob.stepDates || {}
        });
      } else {
        setFormData({
          company: '',
          position: '',
          jobType: 'internship', // Default is Internship
          salary: '',
          notes: '',
          currentStepIndex: 0,
          steps: [...defaultSteps],
          currentStepStatus: 'in-progress',
          stepDates: {}
        });
      }
    }
  }, [isOpen, editingJob, defaultSteps]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave(formData, editingJob?.id);
    onClose();
  };

  const updateStepName = (index: number, val: string) => {
    const newSteps = [...formData.steps];
    newSteps[index] = val;
    setFormData(prev => ({ ...prev, steps: newSteps }));
  };

  const addStep = () => {
    // Insert before the last node (OC)
    const newSteps = [...formData.steps];
    const insertIndex = Math.max(0, newSteps.length - 1);
    newSteps.splice(insertIndex, 0, "新节点");
    setFormData(prev => ({ ...prev, steps: newSteps }));
  };

  const removeStep = (index: number) => {
    if (formData.steps.length <= 1) return;
    const newSteps = formData.steps.filter((_, i) => i !== index);
    // Adjust current index if needed
    let newIndex = formData.currentStepIndex;
    if (newIndex >= index && newIndex > 0) newIndex--;
    
    setFormData(prev => ({ 
      ...prev, 
      steps: newSteps,
      currentStepIndex: newIndex
    }));
  };

  const resetSteps = () => {
    if (window.confirm('确定要重置为系统默认流程吗？自定义的修改将丢失。')) {
       setFormData(prev => ({ ...prev, steps: [...defaultSteps], currentStepIndex: 0 }));
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden animate-in fade-in zoom-in duration-200">
        
        <div className="p-5 border-b border-slate-100 flex justify-between items-center bg-slate-50">
          <h2 className="text-xl font-bold text-slate-800">
            {editingJob ? '编辑投递记录' : '添加新投递'}
          </h2>
          <button onClick={onClose} className="p-2 hover:bg-slate-200 rounded-full text-slate-500 transition-colors">
            <X size={20} />
          </button>
        </div>

        <div className="overflow-y-auto p-6 space-y-6">
          <form id="jobForm" onSubmit={handleSubmit} className="space-y-6">
            
            {/* Job Type Selector */}
            <div className="grid grid-cols-3 gap-3">
               <label className={`
                  flex flex-col items-center justify-center gap-2 p-3 rounded-xl border-2 cursor-pointer transition-all
                  ${formData.jobType === 'internship' ? 'border-amber-500 bg-amber-50 text-amber-700' : 'border-slate-200 hover:border-slate-300 text-slate-600'}
               `}>
                 <input 
                   type="radio" 
                   name="jobType"
                   value="internship"
                   className="hidden"
                   checked={formData.jobType === 'internship'}
                   onChange={() => setFormData(prev => ({...prev, jobType: 'internship'}))}
                 />
                 <GraduationCap size={20} />
                 <span className="font-semibold text-sm">实习岗位</span>
               </label>

               <label className={`
                  flex flex-col items-center justify-center gap-2 p-3 rounded-xl border-2 cursor-pointer transition-all
                  ${formData.jobType === 'campus' ? 'border-indigo-500 bg-indigo-50 text-indigo-700' : 'border-slate-200 hover:border-slate-300 text-slate-600'}
               `}>
                 <input 
                   type="radio" 
                   name="jobType"
                   value="campus"
                   className="hidden"
                   checked={formData.jobType === 'campus'}
                   onChange={() => setFormData(prev => ({...prev, jobType: 'campus'}))}
                 />
                 <Briefcase size={20} />
                 <span className="font-semibold text-sm">校招</span>
               </label>

               <label className={`
                  flex flex-col items-center justify-center gap-2 p-3 rounded-xl border-2 cursor-pointer transition-all
                  ${formData.jobType === 'social' ? 'border-blue-500 bg-blue-50 text-blue-700' : 'border-slate-200 hover:border-slate-300 text-slate-600'}
               `}>
                 <input 
                   type="radio" 
                   name="jobType"
                   value="social"
                   className="hidden"
                   checked={formData.jobType === 'social'}
                   onChange={() => setFormData(prev => ({...prev, jobType: 'social'}))}
                 />
                 <Building size={20} />
                 <span className="font-semibold text-sm">社招</span>
               </label>
            </div>

            {/* Basic Info */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div className="space-y-2">
                <label className="text-sm font-semibold text-slate-700">公司名称 <span className="text-red-500">*</span></label>
                <input
                  required
                  type="text"
                  value={formData.company}
                  onChange={e => setFormData({...formData, company: e.target.value})}
                  placeholder="例如：字节跳动"
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-semibold text-slate-700">投递岗位 <span className="text-red-500">*</span></label>
                <input
                  required
                  type="text"
                  value={formData.position}
                  onChange={e => setFormData({...formData, position: e.target.value})}
                  placeholder="例如：前端工程师"
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-semibold text-slate-700">正职待遇</label>
              <input
                type="text"
                value={formData.salary}
                onChange={e => setFormData({...formData, salary: e.target.value})}
                placeholder={formData.jobType === 'internship' ? "转正后薪资，例如：25k * 15" : "例如：25k * 15 + 期权"}
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-semibold text-slate-700">备注信息</label>
              <textarea
                value={formData.notes}
                onChange={e => setFormData({...formData, notes: e.target.value})}
                placeholder="面试感受、HR联系方式、内推码等..."
                rows={3}
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all resize-none"
              />
            </div>

            {/* Steps Configuration */}
            <div className="pt-4 border-t border-slate-100">
              <div className="flex justify-between items-center mb-4">
                <label className="text-sm font-semibold text-slate-700 flex items-center gap-2">
                  求职流程节点配置
                  <span className="text-xs font-normal text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full">此记录专属</span>
                </label>
                <button 
                  type="button" 
                  onClick={resetSteps}
                  className="text-xs flex items-center gap-1 text-slate-500 hover:text-blue-600 transition-colors"
                >
                  <RotateCcw size={12} /> 重置
                </button>
              </div>
              
              <div className="bg-slate-50 rounded-lg p-4 border border-slate-200 space-y-3">
                {formData.steps.map((step, idx) => {
                  // Fixed nodes: First 2 and Last 1
                  const isFixed = idx === 0 || idx === 1 || idx === formData.steps.length - 1;
                  
                  return (
                    <div key={idx} className="flex items-center gap-3 group">
                      <div className={`text-slate-300 ${isFixed ? 'opacity-50 cursor-not-allowed' : 'cursor-move'}`}>
                        <GripVertical size={16} />
                      </div>
                      <div className="flex-1 flex items-center gap-3">
                        <span className="text-xs font-mono text-slate-400 w-4">{idx + 1}</span>
                        <input
                          type="text"
                          value={step}
                          onChange={(e) => updateStepName(idx, e.target.value)}
                          disabled={isFixed}
                          className={`flex-1 px-3 py-1.5 text-sm border rounded outline-none transition-colors
                            ${isFixed 
                                ? 'bg-slate-100 text-slate-500 border-slate-200' 
                                : 'border-slate-300 hover:border-blue-400 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 bg-white'
                            }`}
                        />
                      </div>
                      
                      {/* Status Selector for this step (Quick Select) */}
                      <div className="flex items-center gap-2">
                          <input 
                              type="radio" 
                              name="currentStep"
                              checked={formData.currentStepIndex === idx}
                              onChange={() => setFormData(prev => ({ ...prev, currentStepIndex: idx }))}
                              className="w-4 h-4 text-blue-600 cursor-pointer"
                              title="设为当前进度"
                          />
                          <button
                          type="button"
                          onClick={() => removeStep(idx)}
                          disabled={isFixed}
                          className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded disabled:opacity-0 disabled:pointer-events-none transition-all"
                          >
                          <Trash size={14} />
                          </button>
                      </div>
                    </div>
                  );
                })}

                <button
                  type="button"
                  onClick={addStep}
                  className="w-full mt-2 py-2 border-2 border-dashed border-slate-300 text-slate-500 rounded-lg hover:border-blue-400 hover:text-blue-600 transition-colors flex items-center justify-center gap-2 text-sm font-medium"
                >
                  <Plus size={16} /> 添加流程节点
                </button>
              </div>
            </div>

          </form>
        </div>

        <div className="p-5 border-t border-slate-100 bg-slate-50 flex justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2.5 text-slate-600 font-medium hover:bg-slate-200 rounded-lg transition-colors"
          >
            取消
          </button>
          <button
            type="submit"
            form="jobForm"
            className="px-6 py-2.5 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 shadow-sm shadow-blue-200 transition-all active:scale-95"
          >
            保存记录
          </button>
        </div>
      </div>
    </div>
  );
};