import React, { useState, useEffect, useMemo } from 'react';
import { JobApplication, AppConfig, StepStatus } from './types';
import { DEFAULT_STEPS, STORAGE_KEYS } from './constants';
import { JobCard } from './components/JobCard';
import { JobModal } from './components/JobModal';
import { SettingsModal } from './components/SettingsModal';
import { WelcomeModal } from './components/WelcomeModal';
import { Plus, Settings, Search, LayoutList, Briefcase, Loader2, LogIn, LogOut, Lock, Unlock, Eye } from 'lucide-react';
import { supabase } from './supabaseClient';
import { User } from '@supabase/supabase-js';

const App: React.FC = () => {
  const [jobs, setJobs] = useState<JobApplication[]>([]);
  const [config, setConfig] = useState<AppConfig>({ defaultSteps: DEFAULT_STEPS });
  
  // Modals State
  const [isJobModalOpen, setIsJobModalOpen] = useState(false);
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);
  
  // Welcome Modal State
  const [showWelcome, setShowWelcome] = useState(false);
  const [welcomeInitialMode, setWelcomeInitialMode] = useState<'selection' | 'auth'>('selection');

  const [editingJob, setEditingJob] = useState<JobApplication | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  
  // User & Mode State
  const [user, setUser] = useState<User | null>(null);
  const [viewModeEmail, setViewModeEmail] = useState<string | null>(null);

  // Computed Modes
  const isManageMode = !!user;
  const isViewMode = !!viewModeEmail && !user;

  // 1. 初始化逻辑
  useEffect(() => {
    const init = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (session?.user) {
        setUser(session.user);
        fetchJobs(session.user.id); 
      } else {
        const savedViewEmail = localStorage.getItem(STORAGE_KEYS.VIEW_MODE_EMAIL);
        if (savedViewEmail) {
            setViewModeEmail(savedViewEmail);
            fetchJobs(undefined, savedViewEmail);
            setShowWelcome(false);
        } else {
            setWelcomeInitialMode('selection');
            setShowWelcome(true);
        }
        setIsLoading(false); 
      }
    };

    init();

    const { data: { subscription: authListener } } = supabase.auth.onAuthStateChange((_event, session) => {
      const currentUser = session?.user ?? null;
      setUser(currentUser);
      
      if (currentUser) {
        localStorage.removeItem(STORAGE_KEYS.VIEW_MODE_EMAIL);
        setViewModeEmail(null);
        setShowWelcome(false); 
        fetchJobs(currentUser.id);
      } else {
        if (!localStorage.getItem(STORAGE_KEYS.VIEW_MODE_EMAIL)) {
            setJobs([]);
            setWelcomeInitialMode('selection');
            setShowWelcome(true);
        }
      }
    });

    const savedConfig = localStorage.getItem(STORAGE_KEYS.CONFIG);
    if (savedConfig) {
      try { setConfig(JSON.parse(savedConfig)); } catch (e) { console.error(e); }
    }

    return () => {
      authListener.unsubscribe();
    };
  }, []);

  // 2. 数据获取逻辑
  // showLoading 参数：默认为 true。但在更新操作时传入 false，实现“静默刷新”，防止界面闪烁
  const fetchJobs = async (userId?: string, targetEmail?: string, showLoading = true) => {
    if (showLoading) setIsLoading(true);
    
    let query = supabase.from('jobs').select('*').order('created_at', { ascending: false });

    if (userId) {
      query = query.eq('user_id', userId);
    } else if (targetEmail) {
      query = query.eq('email', targetEmail);
    } else {
      setJobs([]);
      if (showLoading) setIsLoading(false);
      return;
    }

    const { data } = await query;

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
    if (showLoading) setIsLoading(false);
  };

  // 3. 业务操作逻辑
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
    // 使用静默刷新 (false)，防止列表重置导致闪烁
    fetchJobs(user.id, undefined, false);
  };

  const handleDeleteJob = async (id: string) => {
    if (!user) return;
    if (window.confirm('确定要删除这条投递记录吗？')) {
      await supabase.from('jobs').delete().eq('id', id);
      // 使用静默刷新
      fetchJobs(user.id, undefined, false);
    }
  };

  // 【核心修改】增加乐观更新 (Optimistic UI) 逻辑
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

    // 计算新状态
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

    // 1. 乐观更新：立即修改本地状态，让 UI 瞬间响应（丝滑动画的关键）
    setJobs(prevJobs => prevJobs.map(j => {
        if (j.id === id) {
            return {
                ...j,
                currentStepIndex: newIndex,
                currentStepStatus: newStatus,
                stepDates: newDates,
                updatedAt: Date.now() // 更新本地显示的时间
            };
        }
        return j;
    }));

    // 2. 后台同步：发送请求到数据库
    await supabase.from('jobs').update({
        current_step_index: newIndex,
        current_step_status: newStatus,
        step_dates: newDates,
        updated_at: new Date().toISOString()
    }).eq('id', id);

    // 3. 静默校验：后台更新完后，静默拉取一次最新数据以确保一致性，但不显示 loading
    fetchJobs(user.id, undefined, false);
  };

  const handleSaveSettings = (newSteps: string[]) => {
    setConfig({ defaultSteps: newSteps });
    localStorage.setItem(STORAGE_KEYS.CONFIG, JSON.stringify({ defaultSteps: newSteps }));
  };


  const handleLogout = async () => {
    if (window.confirm("确定要退出登录吗？")) {
      // 1. 【乐观更新】不等待网络请求，立即清理前端状态
      // 这样用户点击确认后，界面会瞬间反应，体验极佳
      setUser(null);
      setJobs([]);
      
      // 2. 清理可能存在的本地缓存（如查看模式的邮箱）
      localStorage.removeItem(STORAGE_KEYS.VIEW_MODE_EMAIL);

      // 3. 立即重置并显示欢迎页
      setWelcomeInitialMode('selection');
      setShowWelcome(true);

      // 4. 【后台执行】发送登出请求给 Supabase
      // 即使这个请求因为网络原因失败，前端也已经完成了“退出”的视觉操作，
      // 且 LocalStorage 中的 Token 通常会被 Supabase 客户端自动清理或失效。
      try {
        await supabase.auth.signOut();
      } catch (error) {
        console.error("后台登出请求异常:", error);
        // 极端情况下手动清理 Supabase 的本地存储 Key（通常不需要，视情况而定）
        // Object.keys(localStorage).forEach(key => {
        //   if (key.startsWith('sb-')) localStorage.removeItem(key);
        // });
      }
    }
  };


  const handleSelectView = (email: string) => {
    localStorage.setItem(STORAGE_KEYS.VIEW_MODE_EMAIL, email); 
    setViewModeEmail(email);
    setShowWelcome(false);
    fetchJobs(undefined, email);
  };

  const handleExitView = () => {
    localStorage.removeItem(STORAGE_KEYS.VIEW_MODE_EMAIL); 
    setViewModeEmail(null);
    setJobs([]);
    setWelcomeInitialMode('selection');
    setShowWelcome(true);
  };

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
                 <span className="text-xs text-slate-500 bg-slate-100 px-2 py-1 rounded hidden sm:inline">{user?.email}</span>
                 
                 <button onClick={() => setIsSettingsModalOpen(true)} className="p-2 text-slate-500 hover:bg-slate-100 rounded-lg"><Settings size={20} /></button>
                 <button onClick={handleLogout} className="p-2 text-red-500 hover:bg-red-50 rounded-lg"><LogOut size={20} /></button>
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
        onClose={(isManageMode || isViewMode) ? () => setShowWelcome(false) : undefined} 
        onLoginSuccess={() => setShowWelcome(false)}
      />

      <JobModal isOpen={isJobModalOpen} onClose={() => setIsJobModalOpen(false)} onSave={handleSaveJob} editingJob={editingJob} defaultSteps={config.defaultSteps} />
      <SettingsModal isOpen={isSettingsModalOpen} onClose={() => setIsSettingsModalOpen(false)} defaultSteps={config.defaultSteps} onSave={handleSaveSettings} />
    </div>
  );
};

export default App;