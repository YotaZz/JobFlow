import React, { useState, useEffect, useMemo } from 'react';
import { JobApplication, AppConfig, StepStatus } from './types';
import { DEFAULT_STEPS, STORAGE_KEYS } from './constants';
import { JobCard } from './components/JobCard';
import { JobModal } from './components/JobModal';
import { SettingsModal } from './components/SettingsModal';
import { LoginModal } from './components/LoginModal'; 
import { Plus, Settings, Search, LayoutList, Briefcase, Loader2, LogIn, LogOut, Lock, Unlock } from 'lucide-react';
import { supabase } from './supabaseClient';
import { User } from '@supabase/supabase-js';

const App: React.FC = () => {
  const [jobs, setJobs] = useState<JobApplication[]>([]);
  const [config, setConfig] = useState<AppConfig>({ defaultSteps: DEFAULT_STEPS });
  const [isJobModalOpen, setIsJobModalOpen] = useState(false);
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);
  const [isLoginModalOpen, setIsLoginModalOpen] = useState(false); 
  const [editingJob, setEditingJob] = useState<JobApplication | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [user, setUser] = useState<User | null>(null);

  // 初始化：登录状态、配置、数据拉取
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
    });

    const { data: { subscription: authListener } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });

    const savedConfig = localStorage.getItem(STORAGE_KEYS.CONFIG);
    if (savedConfig) {
      try { setConfig(JSON.parse(savedConfig)); } catch (e) { console.error(e); }
    }

    fetchJobs();

    const channel = supabase
      .channel('jobs_realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'jobs' }, () => fetchJobs())
      .subscribe();

    return () => {
      authListener.unsubscribe();
      supabase.removeChannel(channel);
    };
  }, []);

  // 1. 获取数据逻辑（含：初筛10天无回应自动结束逻辑）
  const fetchJobs = async () => {
    const { data, error } = await supabase.from('jobs').select('*').order('created_at', { ascending: false });
    if (data) {
      const now = Date.now();
      const tenDays = 10 * 24 * 60 * 60 * 1000;
      const updates: string[] = [];

      const mappedJobs: JobApplication[] = data.map((item: any) => {
        const createdAt = new Date(item.created_at).getTime();
        const stepDates = item.step_dates || {};
        
        // 自动补全旧数据中缺失的“已投递”时间
        if (!stepDates[0]) {
            stepDates[0] = createdAt;
        }

        let currentStatus = item.current_step_status;
        const currentStepIndex = item.current_step_index;
        const steps = item.steps || [];
        const currentStepName = steps[currentStepIndex];

        // 自动化逻辑：如果是“初筛”且处于“等待”状态超过10天 -> 自动转为“Rejected”(无回应)
        const isScreening = currentStepName === '初筛' || currentStepIndex === 1;
        if (isScreening && currentStatus === 'waiting') {
           // 优先使用 stepDates 中的时间，如果没有（如测试手动改库），则回退使用 updated_at
           const stepDate = stepDates[currentStepIndex] || new Date(item.updated_at).getTime();
           
           if (stepDate && (now - stepDate > tenDays)) {
               currentStatus = 'rejected';
               updates.push(item.id);
           }
        }

        return {
          id: item.id,
          company: item.company,
          position: item.position,
          jobType: item.job_type,
          salary: item.salary,
          notes: item.notes,
          steps: steps,
          currentStepIndex: currentStepIndex,
          currentStepStatus: currentStatus, // 使用可能更新后的状态
          stepDates: stepDates, 
          createdAt: createdAt,
          updatedAt: new Date(item.updated_at).getTime(),
        };
      });
      
      // 批量执行自动更新（如果在初筛等待超过10天）
      if (updates.length > 0) {
        await Promise.all(updates.map(id => 
           supabase.from('jobs').update({
             current_step_status: 'rejected',
             updated_at: new Date().toISOString()
           }).eq('id', id)
        ));
      }

      setJobs(mappedJobs);
    }
    setIsLoading(false);
  };

  // 2. 保存逻辑（初始化新投递时写入第0步时间）
  const handleSaveJob = async (jobData: any, id?: string) => {
    if (!user) return alert("请先登录");
    
    // 新记录初始化第0步日期，编辑则保留原日期
    const initialStepDates = id ? jobData.stepDates : { 0: Date.now() };

    const dbPayload = {
      company: jobData.company,
      position: jobData.position,
      job_type: jobData.jobType,
      salary: jobData.salary,
      notes: jobData.notes,
      steps: jobData.steps,
      current_step_index: jobData.currentStepIndex,
      current_step_status: jobData.currentStepStatus,
      step_dates: initialStepDates,
      updated_at: new Date().toISOString(),
    };

    if (id) {
      await supabase.from('jobs').update(dbPayload).eq('id', id);
    } else {
      await supabase.from('jobs').insert([dbPayload]);
    }
    fetchJobs();
  };

  const handleDeleteJob = async (id: string) => {
    if (!user) return;
    if (window.confirm('确定要删除这条投递记录吗？')) {
      const { error } = await supabase.from('jobs').delete().eq('id', id);
      if (error) alert('删除失败');
      fetchJobs();
    }
  };

  const handleUpdateStep = async (id: string, targetIndex: number) => {
    if (!user) return;
    const job = jobs.find(j => j.id === id);
    if (!job) return;

    const stepName = job.steps[targetIndex];
    const isOC = stepName && stepName.toUpperCase() === 'OC';
    // 初筛逻辑：名称为'初筛' 或 索引为1
    const isScreening = stepName === '初筛' || targetIndex === 1;

    let newIndex = job.currentStepIndex;
    let newStatus = job.currentStepStatus;
    let newDates = { ...job.stepDates };

    if (targetIndex === job.currentStepIndex) {
        // 点击当前节点：切换状态
        if (isOC) return; 
        // 初筛没有"in-progress"(进入)状态，直接在 waiting 和 rejected 之间切换
        let statusFlow: StepStatus[] = isScreening ? ['waiting', 'rejected'] : ['in-progress', 'waiting', 'rejected'];
        const currentStatusIndex = statusFlow.indexOf(job.currentStepStatus);
        // 如果当前状态不在流程中（比如旧数据的in-progress），重置为waiting
        const nextIndex = currentStatusIndex === -1 ? 0 : (currentStatusIndex + 1) % statusFlow.length;
        newStatus = statusFlow[nextIndex];
    } else {
        // 点击新节点：跳转
        newIndex = targetIndex;
        newDates[targetIndex] = Date.now();
        // 初筛默认直接进入 waiting 状态
        newStatus = isScreening ? 'waiting' : 'in-progress';
    }

    await supabase.from('jobs').update({
        current_step_index: newIndex,
        current_step_status: newStatus,
        step_dates: newDates,
        updated_at: new Date().toISOString()
    }).eq('id', id);
    fetchJobs();
  };

  const handleSaveSettings = (newSteps: string[]) => {
    setConfig({ defaultSteps: newSteps });
    localStorage.setItem(STORAGE_KEYS.CONFIG, JSON.stringify({ defaultSteps: newSteps }));
  };

  const filteredJobs = useMemo(() => {
    return jobs.filter(job => 
      job.company.toLowerCase().includes(searchTerm.toLowerCase()) || 
      job.position.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [jobs, searchTerm]);

  if (isLoading) return <div className="min-h-screen flex items-center justify-center"><Loader2 className="animate-spin text-blue-600 w-8 h-8"/></div>;

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <header className="sticky top-0 z-30 bg-white/80 backdrop-blur-md border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="bg-blue-600 p-1.5 rounded-lg"><LayoutList className="text-white w-6 h-6" /></div>
            <h1 className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-700 to-blue-500">JobFlow</h1>
            {user ? <Unlock size={14} className="text-green-500 ml-2" /> : <Lock size={14} className="text-slate-400 ml-2" />}
          </div>
          <div className="flex items-center gap-3">
             {user && (<button onClick={() => setIsSettingsModalOpen(true)} className="p-2 text-slate-500 hover:bg-slate-100 rounded-lg"><Settings size={20} /></button>)}
             {user ? (
               <button onClick={() => supabase.auth.signOut()} className="p-2 text-red-500 hover:bg-red-50 rounded-lg"><LogOut size={20} /></button>
             ) : (
               <button onClick={() => setIsLoginModalOpen(true)} className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg"><LogIn size={20} /></button>
             )}
            {user && (
              <button onClick={() => { setEditingJob(null); setIsJobModalOpen(true); }} className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 shadow-md active:scale-95 font-medium">
                <Plus size={18} /><span className="hidden sm:inline">记一笔</span>
              </button>
            )}
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-5xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8 grid grid-cols-2 md:grid-cols-4 gap-4">
             <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-100"><div className="text-slate-500 text-xs sm:text-sm font-medium">总投递</div><div className="text-2xl font-bold text-slate-800">{jobs.length}</div></div>
             <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-100"><div className="text-slate-500 text-xs sm:text-sm font-medium">进行中</div><div className="text-2xl font-bold text-blue-600">{jobs.filter(j => j.currentStepStatus !== 'rejected' && j.currentStepIndex < j.steps.length - 1).length}</div></div>
             <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-100"><div className="text-slate-500 text-xs sm:text-sm font-medium">已通过</div><div className="text-2xl font-bold text-emerald-500">{jobs.filter(j => j.currentStepStatus !== 'rejected' && j.currentStepIndex === j.steps.length - 1).length}</div></div>
             <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-100"><div className="text-slate-500 text-xs sm:text-sm font-medium">已挂</div><div className="text-2xl font-bold text-red-500">{jobs.filter(j => j.currentStepStatus === 'rejected').length}</div></div>
        </div>

        <div className="mb-6 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-5 h-5" />
          <input type="text" placeholder="搜索公司或岗位..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="w-full pl-10 pr-4 py-3 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-100 outline-none shadow-sm" />
        </div>

        <div className="space-y-4">
          {filteredJobs.length === 0 ? (
            <div className="text-center py-20 bg-white rounded-2xl border border-dashed border-slate-300">
              <Briefcase className="w-8 h-8 text-slate-300 mx-auto mb-4" /><h3 className="text-lg font-medium text-slate-900">暂无投递记录</h3>
            </div>
          ) : (
            filteredJobs.map(job => (
              <JobCard key={job.id} job={job} onUpdateStep={handleUpdateStep} onEdit={(j) => { setEditingJob(j); setIsJobModalOpen(true); }} onDelete={handleDeleteJob} isEditable={!!user} />
            ))
          )}
        </div>
      </main>

      <JobModal isOpen={isJobModalOpen} onClose={() => setIsJobModalOpen(false)} onSave={handleSaveJob} editingJob={editingJob} defaultSteps={config.defaultSteps} />
      <SettingsModal isOpen={isSettingsModalOpen} onClose={() => setIsSettingsModalOpen(false)} defaultSteps={config.defaultSteps} onSave={handleSaveSettings} />
      <LoginModal isOpen={isLoginModalOpen} onClose={() => setIsLoginModalOpen(false)} />
    </div>
  );
};

export default App;