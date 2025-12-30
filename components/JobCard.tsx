import React from 'react';
import { JobApplication, JobType } from '../types';
import { Stepper } from './Stepper';
import { Trash2, Edit2, Wallet, CalendarDays, Timer, MapPin } from 'lucide-react'; // [Modified] 引入 MapPin

interface JobCardProps {
  job: JobApplication;
  onUpdateStep: (id: string, stepIndex: number) => void;
  onEdit: (job: JobApplication) => void;
  onDelete: (id: string) => void;
  isEditable: boolean;
}

export const JobCard: React.FC<JobCardProps> = ({ job, onUpdateStep, onEdit, onDelete, isEditable }) => {
  const formatDate = (timestamp: number) => {
      return new Date(timestamp).toLocaleDateString('zh-CN', {
          month: '2-digit',
          day: '2-digit',
          timeZone: 'Asia/Shanghai' 
      });
  };

  const formattedDate = formatDate(job.updatedAt);

  const calculateEfficiency = () => {
      const rounds = Math.max(0, job.steps.length - 3);
      if (rounds === 0) return null;
      const startDate = job.stepDates[0] || job.createdAt;
      let endDate = Date.now();
      if (job.currentStepStatus === 'rejected') {
          endDate = job.updatedAt;
      } else if (job.currentStepIndex === job.steps.length - 1) {
          endDate = job.stepDates[job.currentStepIndex] || job.updatedAt;
      }
      const totalDays = Math.max(0, (endDate - startDate) / (1000 * 60 * 60 * 24));
      const avgDays = totalDays / rounds;
      return { avg: avgDays.toFixed(1), rounds: rounds, total: totalDays.toFixed(0) };
  };

  const efficiency = calculateEfficiency();

  const getBadgeStyle = (type: JobType) => {
    switch (type) {
      case 'internship': return 'bg-amber-50 text-amber-600 border-amber-200';
      case 'campus': return 'bg-indigo-50 text-indigo-600 border-indigo-200';
      case 'social': return 'bg-blue-50 text-blue-600 border-blue-200';
      default: return 'bg-slate-50 text-slate-600 border-slate-200';
    }
  };

  const getBadgeLabel = (type: JobType) => {
    switch (type) {
      case 'internship': return '实习';
      case 'campus': return '校招';
      case 'social': return '社招';
      default: return '未知';
    }
  };

  return (
    <div className="bg-white rounded-lg border border-slate-200 hover:shadow-md transition-all duration-300 hover:border-blue-200 group">
      <div className="p-3">
        {/* Row 1: Header Info & Actions */}
        <div className="flex items-start justify-between gap-3 mb-2">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1 flex-wrap">
              <span className={`flex-shrink-0 px-1.5 py-0.5 text-[10px] font-bold rounded border ${getBadgeStyle(job.jobType)}`}>
                {getBadgeLabel(job.jobType)}
              </span>

              {/* Tag Badges */}
              {job.tags && job.tags.map(tag => (
                 <span key={tag} className="flex-shrink-0 px-1.5 py-0.5 text-[10px] font-medium rounded border bg-slate-50 text-slate-500 border-slate-200">
                  {tag}
                </span>
              ))}

              <h3 className="text-sm font-bold text-slate-800 truncate ml-0.5" title={job.company}>
                {job.company}
              </h3>
              <span className="text-slate-300 text-xs">/</span>
              <span className="text-xs text-slate-600 truncate font-medium" title={job.position}>
                {job.position}
              </span>
            </div>
            
            <div className="flex items-center gap-3 text-xs text-slate-500 mt-2 flex-wrap">
               {job.salary && (
                <div className="flex items-center gap-1 text-emerald-600 bg-emerald-50/50 px-1.5 py-0.5 rounded">
                  <Wallet size={10} />
                  <span className="font-medium truncate max-w-[100px]">{job.salary}</span>
                </div>
              )}

              {/* [Modified] Base Display (工作地点) */}
              {job.base && (
                <div className="flex items-center gap-1 text-slate-600 bg-slate-100 px-1.5 py-0.5 rounded">
                  <MapPin size={10} />
                  <span className="font-medium truncate max-w-[100px]">{job.base}</span>
                </div>
              )}

              <div className="flex items-center gap-1">
                <CalendarDays size={10} />
                <span>{formattedDate}</span>
              </div>
               {/* 修复：找回 title 属性，并增加鼠标手势 */}
               {efficiency && (
                  <div 
                    className="flex items-center gap-1 text-[10px] text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full cursor-help hover:bg-slate-200 transition-colors"
                    title={`总耗时 ${efficiency.total} 天 / ${efficiency.rounds} 轮面试`}
                  >
                      <Timer size={10} />
                      <span className="font-medium">{efficiency.avg} 天/轮</span>
                  </div>
              )}
            </div>
          </div>

          {isEditable && (
            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity z-20 relative self-start">
              <button onClick={(e) => { e.stopPropagation(); onEdit(job); }} className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors"><Edit2 size={14} /></button>
              <button onClick={(e) => { e.stopPropagation(); onDelete(job.id); }} className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"><Trash2 size={14} /></button>
            </div>
          )}
        </div>

        {/* Row 2: Progress Stepper */}
        <div className="bg-slate-50 rounded-md border border-slate-100/50 relative mt-2">
            <div className="absolute left-0 top-0 bottom-0 w-4 bg-gradient-to-r from-slate-50 to-transparent z-10 pointer-events-none" />
            <div className="absolute right-0 top-0 bottom-0 w-4 bg-gradient-to-l from-slate-50 to-transparent z-10 pointer-events-none" />
            <Stepper 
              steps={job.steps} 
              currentStepIndex={job.currentStepIndex}
              currentStepStatus={job.currentStepStatus || 'in-progress'}
              stepDates={job.stepDates || {}}
              interactive={isEditable} 
              onStepClick={(idx) => isEditable && onUpdateStep(job.id, idx)}
            />
        </div>

        {/* Row 3: Notes */}
        {job.notes && (
          <div className="mt-2 text-[11px] text-slate-500 leading-relaxed truncate px-1" title={job.notes}>
            <span className="text-amber-500 font-medium mr-1">Note:</span>
            {job.notes}
          </div>
        )}
      </div>
    </div>
  );
};