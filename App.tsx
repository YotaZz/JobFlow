import React, { useState, useEffect, useMemo } from 'react';
import { JobApplication, AppConfig, StepStatus } from './types';
import { DEFAULT_STEPS, STORAGE_KEYS } from './constants';
import { JobCard } from './components/JobCard';
import { JobModal } from './components/JobModal';
import { SettingsModal } from './components/SettingsModal';
// import { LoginModal } from './components/LoginModal'; // 删除引用
import { WelcomeModal } from './components/WelcomeModal';
import { Plus, Settings, Search, LayoutList, Briefcase, Loader2, LogIn, LogOut, Lock, Unlock, Eye } from 'lucide-react';
import { supabase } from './supabaseClient';
import { User } from '@supabase/supabase-js';

const App: React.FC = () => {
  const [jobs, setJobs] = useState<JobApplication[]>([]);
  const [config, setConfig] = useState<AppConfig>({ defaultSteps: DEFAULT_STEPS });
  
  // Modals
  const [isJobModalOpen, setIsJobModalOpen] = useState(false);
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);
  // const [isLoginModalOpen, setIsLoginModalOpen] = useState(false); // 删除
  
  const [showWelcome, setShowWelcome] = useState(false);
  const [welcomeInitialMode, setWelcomeInitialMode] = useState<'selection' | 'auth'>('selection'); // 新增：控制欢迎页初始模式

  const [editingJob, setEditingJob] = useState<JobApplication | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  
  const [user, setUser] = useState<User | null>(null);
  const [viewModeEmail, setViewModeEmail] = useState<string | null>(null);

  const isManageMode = !!user;
  const isViewMode = !!viewModeEmail && !user;

  useEffect(() => {
    const init = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (session?.user) {
        setUser(session.user);
        fetchJobs(session.user.id); 
      } else if (!viewModeEmail) {
        setWelcomeInitialMode('selection'); // 默认进入选择模式
        setShowWelcome(true);
        setIsLoading(false); 
      }
    };

    init();

    const { data: { subscription: authListener } } = supabase.auth.onAuthStateChange((_event, session) => {
      const currentUser = session?.user ?? null;
      setUser(currentUser);
      if (currentUser) {
        setShowWelcome(false); 
        setViewModeEmail(null); 
        fetchJobs(currentUser.id);
      } else if (!viewModeEmail) {
        setJobs([]);
        setWelcomeInitialMode('selection');
        setShowWelcome(true);
      }
    });

    const savedConfig = localStorage.getItem(STORAGE_KEYS.CONFIG);
    if (savedConfig) {
      try { setConfig(JSON.parse(savedConfig)); } catch (e) { console.error(e); }
    }

    return () => {
      authListener.unsubscribe();
    };
  }, [viewModeEmail]);

  // ... (fetchJobs, handleSaveJob, handleDeleteJob, handleUpdateStep, handleSaveSettings 保持不变)
  const fetchJobs = async (userId?: string, targetEmail?: string) => {
    setIsLoading(true);
    let query = supabase.from('jobs').select('*').order('created_at', { ascending: false });

    if (userId) {
      query = query.eq('user_id', userId);
    } else if (targetEmail) {
      query = query.eq('email', targetEmail);
    } else {
      setJobs([]);
      setIsLoading(false);
      return;
    }

    const { data } = await query;
    // ... (内部逻辑保持不变)
    if (data) {
        const now = Date.now();
        const tenDays = 10 * 24 * 60 * 60 * 1000;
        const updates: string[] = [];
  
        const mappedJobs: JobApplication[] = data.map((item: any) => {
          const createdAt = new Date(item.created_at).getTime();
          const stepDates = item.step_dates || {};
          
          if (!stepDates[0]) stepDates[0] = createdAt;
  
          let currentStatus = item.current_step_status;
          const currentStepIndex = item.current_step_index;
          const steps = item.steps || [];
          
          if (userId) {
              const currentStepName = steps[currentStepIndex];
              const isScreening = currentStepName === '初筛' || currentStepIndex === 1;
              if (isScreening && currentStatus === 'waiting') {
                  const stepDate = stepDates[currentStepIndex] || new Date(item.updated_at).getTime();
                  if (stepDate && (now - stepDate > tenDays)) {
                      currentStatus = 'rejected';
                      updates.push(item.id);
                  }
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
            currentStepStatus: currentStatus,
            stepDates: stepDates, 
            createdAt: createdAt,
            updatedAt: new Date(item.updated_at).getTime(),
          };
        });
        
        if (updates.length > 0 && userId) {
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

  const handleSaveJob = async (jobData: any, id?: string) => {
    if (!user) return alert("请先登录");
    
    const initialStepDates = id ? jobData.stepDates : { 0: Date.now() };

    const dbPayload = {
      user_id: user.id, 
      email: user.email, 
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
    fetchJobs(user.id);
  };

  const handleDeleteJob = async (id: string) => {
    if (!user) return;
    if (window.confirm('确定要删除这条投递记录吗？')) {
      await supabase.from('jobs').delete().eq('id', id);
      fetchJobs(user.id);
    }
  };

  const handleUpdateStep = async (id: string, targetIndex: number) => {
    if (!user) return; 
    const job = jobs.find(j => j.id === id);
    if (!job) return;

    const stepName = job.steps[targetIndex];
    const isOC = stepName && stepName.toUpperCase() === 'OC';
    const isScreening = stepName === '初筛' || targetIndex === 1;

    let newIndex = job.currentStepIndex;
    let newStatus = job.currentStepStatus;
    let newDates = { ...job.stepDates };

    if (targetIndex === job.currentStepIndex) {
        if (isOC) return; 
        let statusFlow: StepStatus[] = isScreening ? ['waiting', 'rejected'] : ['in-progress', 'waiting', 'rejected'];
        const currentStatusIndex = statusFlow.indexOf(job.currentStepStatus);
        newStatus = statusFlow[(currentStatusIndex + 1) % statusFlow.length] || statusFlow[0];
    } else {
        newIndex = targetIndex;
        newDates[targetIndex] = Date.now();
        newStatus = isScreening ? 'waiting' : 'in-progress';
    }

    await supabase.from('jobs').update({
        current_step_index: newIndex,
        current_step_status: newStatus,
        step_dates: newDates,
        updated_at: new Date().toISOString()
    }).eq('id', id);
    fetchJobs(user.id);
  };

  const handleSaveSettings = (newSteps: string[]) => {
    setConfig({ defaultSteps: newSteps });
    localStorage.setItem(STORAGE_KEYS.CONFIG, JSON.stringify({ defaultSteps: newSteps }));
  };

  // 统一由 WelcomeModal 处理
  const handleSelectManage = () => {
    // 之前是关闭Welcome打开Login，现在直接内部切换mode，所以这里的回调可能不需要做关闭，
    // 但因为逻辑都移到了Modal内部，这里只需要负责处理那些非Modal内部的逻辑（如果有）
    // 其实 WelcomeModal 内部自己切换 state 即可，这个 props 主要是给外部控制
    // 不过我们的 WelcomeModal 接收 onSelectView 和 onSelectManage 吗？
    // 注意：修改后的 WelcomeModal 不再需要 onSelectManage 回调，因为它在内部切换了。
    // 所以我们需要去修改 WelcomeModal 的 props 定义，或者保留它但为空实现。
    // 实际上，上面的 WelcomeModal 代码去掉了 onSelectManage prop，改为了内部 setMode。
    // 所以这里不需要传 onSelectManage 了。
  };

  const handleSelectView = (email: string) => {
    setViewModeEmail(email);
    setShowWelcome(false);
    fetchJobs(undefined, email);
  };

  const handleExitView = () => {
    setViewModeEmail(null);
    setJobs([]);
    setWelcomeInitialMode('selection');
    setShowWelcome(true);
  };

  // Header 上的登录点击
  const handleHeaderLoginClick = () => {
    setWelcomeInitialMode('auth');
    setShowWelcome(true);
  }

  const filteredJobs = useMemo(() => {
    return jobs.filter(job => 
      job.company.toLowerCase().includes(searchTerm.toLowerCase()) || 
      job.position.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [jobs, searchTerm]);

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <header className="sticky top-0 z-30 bg-white/80 backdrop-blur-md border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className={`p-1.5 rounded-lg ${isViewMode ? 'bg-emerald-600' : 'bg-blue-600'}`}>
                <LayoutList className="text-white w-6 h-6" />
            </div>
            <h1 className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-700 to-blue-500">
                {isViewMode ? 'JobFlow (Viewer)' : 'JobFlow'}
            </h1>
            {isManageMode && <Unlock size={14} className="text-green-500 ml-2" />}
            {isViewMode && <Eye size={14} className="text-emerald-500 ml-2" />}
          </div>
          
          <div className="flex items-center gap-3">
             {isViewMode && (
                 <div className="flex items-center gap-3">
                     <span className="text-xs text-slate-500 bg-slate-100 px-2 py-1 rounded hidden sm:inline">Viewing: {viewModeEmail}</span>
                     <button onClick={handleExitView} className="px-3 py-1.5 text-sm bg-slate-200 text-slate-700 hover:bg-slate-300 rounded-lg font-medium transition-colors">
                        退出查看
                     </button>
                 </div>
             )}

             {isManageMode && (
                <>
                 <button onClick={() => setIsSettingsModalOpen(true)} className="p-2 text-slate-500 hover:bg-slate-100 rounded-lg"><Settings size={20} /></button>
                 <button onClick={() => supabase.auth.signOut()} className="p-2 text-red-500 hover:bg-red-50 rounded-lg"><LogOut size={20} /></button>
                 <button onClick={() => { setEditingJob(null); setIsJobModalOpen(true); }} className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 shadow-md active:scale-95 font-medium">
                    <Plus size={18} /><span className="hidden sm:inline">记一笔</span>
                 </button>
                </>
             )}

             {!isManageMode && !isViewMode && (
               <button onClick={handleHeaderLoginClick} className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg"><LogIn size={20} /></button>
             )}
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-5xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {isLoading ? (
            <div className="flex h-64 items-center justify-center"><Loader2 className="animate-spin text-blue-600 w-8 h-8"/></div>
        ) : (
            <>
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
                    <Briefcase className="w-8 h-8 text-slate-300 mx-auto mb-4" />
                    <h3 className="text-lg font-medium text-slate-900">
                        {isViewMode ? '该用户暂无公开投递记录' : '暂无投递记录'}
                    </h3>
                    </div>
                ) : (
                    filteredJobs.map(job => (
                    <JobCard 
                        key={job.id} 
                        job={job} 
                        onUpdateStep={handleUpdateStep} 
                        onEdit={(j) => { setEditingJob(j); setIsJobModalOpen(true); }} 
                        onDelete={handleDeleteJob} 
                        isEditable={isManageMode} 
                    />
                    ))
                )}
                </div>
            </>
        )}
      </main>


      <WelcomeModal 
        isOpen={showWelcome} 
        initialMode={welcomeInitialMode} 
        onSelectView={handleSelectView} 
        // 【关键修改】只有在 管理模式(isManageMode) 或 查看模式(isViewMode) 下，才传入关闭函数
        // 否则传 undefined，WelcomeModal 内部会自动隐藏关闭按钮
        onClose={(isManageMode || isViewMode) ? () => setShowWelcome(false) : undefined} 
        onLoginSuccess={() => setShowWelcome(false)}
      />


      <JobModal isOpen={isJobModalOpen} onClose={() => setIsJobModalOpen(false)} onSave={handleSaveJob} editingJob={editingJob} defaultSteps={config.defaultSteps} />
      <SettingsModal isOpen={isSettingsModalOpen} onClose={() => setIsSettingsModalOpen(false)} defaultSteps={config.defaultSteps} onSave={handleSaveSettings} />
      {/* LoginModal Removed */}
    </div>
  );
};

export default App;