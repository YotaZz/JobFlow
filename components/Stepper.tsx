import React, { useRef, useEffect } from 'react';
import { Check, Circle, Clock, XCircle, Loader2 } from 'lucide-react';
import { StepStatus } from '../types';

interface StepperProps {
  steps: string[];
  currentStepIndex: number;
  currentStepStatus: StepStatus;
  stepDates: Record<number, number>;
  onStepClick?: (index: number) => void;
  interactive?: boolean;
}

export const Stepper: React.FC<StepperProps> = ({ 
  steps, 
  currentStepIndex, 
  currentStepStatus,
  stepDates,
  onStepClick, 
  interactive = false 
}) => {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (containerRef.current && currentStepIndex > 0) {
      const stepWidth = 100;
      const targetScroll = (currentStepIndex - 1) * stepWidth;
      containerRef.current.scrollTo({ left: targetScroll, behavior: 'smooth' });
    }
  }, [currentStepIndex]);

  const formatDate = (timestamp?: number) => {
    if (!timestamp) return '';
    return new Date(timestamp).toLocaleDateString('zh-CN', {
      month: '2-digit',
      day: '2-digit'
    });
  };

  const getStepIcon = (isCompleted: boolean, isCurrent: boolean, status: StepStatus, isOC: boolean) => {
    if (isCompleted || (isCurrent && isOC)) return <Check size={12} strokeWidth={3} />;
    if (isCurrent) {
      if (status === 'waiting') return <Clock size={12} />;
      if (status === 'rejected') return <XCircle size={12} />;
      return <Loader2 size={12} className="animate-spin" />; 
    }
    return <Circle size={8} fill="none" />;
  };

  const getStepColorClasses = (isCompleted: boolean, isCurrent: boolean, status: StepStatus, isOC: boolean) => {
    if (isCompleted || (isCurrent && isOC)) {
      return 'bg-emerald-500 border-emerald-500 text-white';
    }
    if (isCurrent) {
      switch (status) {
        case 'waiting':
          return 'bg-white border-orange-500 text-orange-500 ring-2 ring-orange-100';
        case 'rejected':
          return 'bg-white border-red-500 text-red-500 ring-2 ring-red-100';
        case 'in-progress':
        default:
          return 'bg-white border-emerald-500 text-emerald-500 ring-2 ring-emerald-100';
      }
    }
    return 'bg-white border-slate-300 text-slate-300';
  };

  const getLabelColorClass = (isCompleted: boolean, isCurrent: boolean, status: StepStatus, isOC: boolean) => {
    if (isCompleted) return 'text-emerald-600';
    if (isCurrent) {
      if (isOC) return 'text-emerald-600 font-bold';
      switch (status) {
        case 'waiting': return 'text-orange-600 font-bold';
        case 'rejected': return 'text-red-600 font-bold';
        default: return 'text-emerald-600 font-bold';
      }
    }
    return 'text-slate-400';
  };

  return (
    <div 
      ref={containerRef}
      className="w-full overflow-x-auto no-scrollbar py-2 px-1 mask-linear-fade"
    >
      <div className="flex items-center min-w-max pt-4">
        {steps.map((step, index) => {
          const isCompleted = index < currentStepIndex;
          const isCurrent = index === currentStepIndex;
          const isLast = index === steps.length - 1;
          
          const stepNameUpper = step.toUpperCase();
          const isApplied = stepNameUpper === '已投递';
          const isOC = stepNameUpper === 'OC';
          const hasDate = !!stepDates[index];

// Date Display Logic
          // 1. Applied / OC: Show if entered (hasDate)
          // 2. Others: Show if completed OR (current AND rejected)
          let showDate = false;
          
          if (isApplied || isOC) {
            // 对于“已投递”和“OC”，只要有日期就显示
            showDate = hasDate;
          } else {
            // 对于中间步骤（如面试），完成或挂掉时显示
            if (index > 0) {
               showDate = isCompleted || (isCurrent && currentStepStatus === 'rejected');
            }
          }
          
          const dateStr = showDate ? formatDate(stepDates[index]) : '';

          return (
            <div key={`${step}-${index}`} className="flex items-center flex-1 last:flex-none relative">
              
              {/* Step Node */}
              <div className="relative flex flex-col items-center group min-w-[60px]">
                {/* Date Label (Above) */}
                <div className={`
                  absolute -top-5 text-[10px] font-medium whitespace-nowrap transition-all
                  ${showDate ? 'opacity-100 text-slate-500' : 'opacity-0'}
                `}>
                  {dateStr}
                </div>

                <button
                  onClick={() => interactive && onStepClick && onStepClick(index)}
                  disabled={!interactive}
                  className={`
                    flex items-center justify-center w-6 h-6 rounded-full border-[1.5px] transition-all duration-300 z-10
                    ${interactive ? 'cursor-pointer hover:scale-110' : 'cursor-default'}
                    ${getStepColorClasses(isCompleted, isCurrent, currentStepStatus, isOC)}
                  `}
                  title={isCurrent && interactive ? "点击切换状态: 进入/等待/结束" : ""}
                >
                  {getStepIcon(isCompleted, isCurrent, currentStepStatus, isOC)}
                </button>
                
                {/* Step Label (Below) */}
                <div className={`
                  mt-1.5 whitespace-nowrap text-[10px] font-medium transition-colors duration-300
                  ${getLabelColorClass(isCompleted, isCurrent, currentStepStatus, isOC)}
                `}>
                  {step}
                </div>
              </div>

              {/* Connecting Line */}
              {!isLast && (
                <div className="flex-1 w-8 sm:w-12 h-[2px] mx-1 bg-slate-100 -mt-4">
                  <div 
                    className={`h-full transition-all duration-500 ease-out ${isCompleted ? 'bg-emerald-500' : 'bg-transparent'}`}
                    style={{ width: isCompleted ? '100%' : '0%' }}
                  />
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};