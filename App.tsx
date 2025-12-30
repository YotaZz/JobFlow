import React, { useState, useEffect, useMemo } from 'react';
import { JobApplication, AppConfig, StepStatus } from './types';
import { DEFAULT_STEPS, STORAGE_KEYS } from './constants';
import { JobCard } from './components/JobCard';
import { JobModal } from './components/JobModal';
import { SettingsModal } from './components/SettingsModal';
import { WelcomeModal } from './components/WelcomeModal';
import { Plus, Settings, Search, LayoutList, Briefcase, Loader2, LogIn, LogOut, Lock, Unlock, Eye, Filter } from 'lucide-react'; // 新增 Filter 图标
import { supabase } from './supabaseClient';
import { User } from '@supabase/supabase-js';

const App: React.FC = () => {
  const [jobs, setJobs] = useState<JobApplication[]>([]);
  const [config, setConfig] = useState<AppConfig>({ defaultSteps: DEFAULT_STEPS });
  
  // Modals
  const [isJobModalOpen, setIsJobModalOpen] = useState(false);
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);
  const [showWelcome, setShowWelcome] = useState(false);
  const [welcomeInitialMode, setWelcomeInitialMode] = useState<'selection' | 'auth'>('selection');
  
  const [editingJob, setEditingJob] = useState<JobApplication | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  
  // 核心变更：当前选中的标签 (默认 'all')
  const [activeTag, setActiveTag] = useState<string>('all'); 
  
  const [user, setUser] = useState<User | null>(null);
  const [viewModeEmail, setViewModeEmail] = useState<string | null>(null);

  const isManageMode = !!user;
  const isViewMode = !!viewModeEmail && !user;

  // ... (Initialization Logic useEffect - 保持不变) ...
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
            base: item.base,
            tags: item.tags || [], // 映射 tags
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


  const handleSaveJob = async (jobData: any, id?: string) => {
    if (!user) return alert("请先登录");
    const initialStepDates = id 
        ? jobData.stepDates 
        : { ...jobData.stepDates, 0: jobData.stepDates[0] || Date.now() };

    const dbPayload = {
      user_id: user.id, 
      email: user.email, 
      company: jobData.company,
      position: jobData.position,
      job_type: jobData.jobType,
      base: jobData.base,
      tags: jobData.tags || [], 
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
    fetchJobs(user.id, undefined, false);
  };

  // ... (handleDeleteJob, handleUpdateStep, etc. 保持不变) ...
  const handleDeleteJob = async (id: string) => {
    if (!user) return;
    if (window.confirm('确定要删除这条投递记录吗？')) {
      await supabase.from('jobs').delete().eq('id', id);
      fetchJobs(user.id, undefined, false);
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
        if (!newDates[targetIndex]) newDates[targetIndex] = Date.now();
        newStatus = isScreening ? 'waiting' : 'in-progress';
    }
    setJobs(prevJobs => prevJobs.map(j => {
        if (j.id === id) return { ...j, currentStepIndex: newIndex, currentStepStatus: newStatus, stepDates: newDates, updatedAt: Date.now() };
        return j;
    }));
    await supabase.from('jobs').update({ current_step_index: newIndex, current_step_status: newStatus, step_dates: newDates, updated_at: new Date().toISOString() }).eq('id', id);
    fetchJobs(user.id, undefined, false);
  };
  // ... (其他 handlers) ...

  const handleSaveSettings = (newSteps: string[]) => {
    setConfig({ defaultSteps: newSteps });
    localStorage.setItem(STORAGE_KEYS.CONFIG, JSON.stringify({ defaultSteps: newSteps }));
  };

  const handleLogout = async () => {
    if (window.confirm("确定要退出登录吗？")) {
      setUser(null); setJobs([]); localStorage.removeItem(STORAGE_KEYS.VIEW_MODE_EMAIL); setWelcomeInitialMode('selection'); setShowWelcome(true);
      try { await supabase.auth.signOut(); } catch (error) { console.error(error); }
    }
  };

  const handleSelectView = (email: string) => { localStorage.setItem(STORAGE_KEYS.VIEW_MODE_EMAIL, email); setViewModeEmail(email); setShowWelcome(false); fetchJobs(undefined, email); };
  const handleExitView = () => { localStorage.removeItem(STORAGE_KEYS.VIEW_MODE_EMAIL); setViewModeEmail(null); setJobs([]); setWelcomeInitialMode('selection'); setShowWelcome(true); };
  const handleHeaderLoginClick = () => { setWelcomeInitialMode('auth'); setShowWelcome(true); }

  // 3. 计算: 获取所有唯一的 Tags
  const uniqueTags = useMemo(() => {
      const tags = new Set<string>();
      jobs.forEach(job => {
          if (job.tags) job.tags.forEach(t => tags.add(t));
      });
      return Array.from(tags).sort(); // 字母排序
  }, [jobs]);

  // 4. 计算: 根据 Tag 筛选后的 Jobs (用于统计和列表)
  const filteredByTagJobs = useMemo(() => {
      if (activeTag === 'all') return jobs;
      return jobs.filter(job => job.tags && job.tags.includes(activeTag));
  }, [jobs, activeTag]);

  // 5. 计算: 最终列表 (搜索过滤)
  const finalDisplayJobs = useMemo(() => {
    return filteredByTagJobs.filter(job => 
      job.company.toLowerCase().includes(searchTerm.toLowerCase()) || 
      job.position.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [filteredByTagJobs, searchTerm]);

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <header className="sticky top-0 z-30 bg-white/80 backdrop-blur-md border-b border-slate-200">
         {/* Header content unchanged, omitted for brevity */}
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
                {/* 6. Tag 筛选栏 (新增) */}
                <div className="mb-6 flex items-center gap-3 overflow-x-auto pb-2 no-scrollbar mask-linear-fade">
                    <div className="flex items-center gap-1.5 text-slate-500 text-sm font-medium mr-2">
                        <Filter size={16} />
                        <span>分组:</span>
                    </div>
                    <button 
                        onClick={() => setActiveTag('all')}
                        className={`px-4 py-1.5 rounded-full text-sm font-medium transition-all whitespace-nowrap
                        ${activeTag === 'all' 
                            ? 'bg-slate-800 text-white shadow-md' 
                            : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'}`}
                    >
                        全部
                    </button>
                    {uniqueTags.map(tag => (
                        <button 
                            key={tag}
                            onClick={() => setActiveTag(tag)}
                            className={`px-4 py-1.5 rounded-full text-sm font-medium transition-all whitespace-nowrap
                            ${activeTag === tag
                                ? 'bg-blue-600 text-white shadow-md' 
                                : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'}`}
                        >
                            {tag}
                        </button>
                    ))}
                </div>

                {/* 统计卡片 (使用 filteredByTagJobs 统计) */}
                <div className="mb-8 grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-100"><div className="text-slate-500 text-xs sm:text-sm font-medium">总投递 ({activeTag === 'all' ? '全部' : activeTag})</div><div className="text-2xl font-bold text-slate-800">{filteredByTagJobs.length}</div></div>
                    <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-100"><div className="text-slate-500 text-xs sm:text-sm font-medium">进行中</div><div className="text-2xl font-bold text-blue-600">{filteredByTagJobs.filter(j => j.currentStepStatus !== 'rejected' && j.currentStepIndex < j.steps.length - 1).length}</div></div>
                    <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-100"><div className="text-slate-500 text-xs sm:text-sm font-medium">已通过</div><div className="text-2xl font-bold text-emerald-500">{filteredByTagJobs.filter(j => j.currentStepStatus !== 'rejected' && j.currentStepIndex === j.steps.length - 1).length}</div></div>
                    <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-100"><div className="text-slate-500 text-xs sm:text-sm font-medium">已挂</div><div className="text-2xl font-bold text-red-500">{filteredByTagJobs.filter(j => j.currentStepStatus === 'rejected').length}</div></div>
                </div>

                {/* 搜索框 */}
                <div className="mb-6 relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-5 h-5" />
                    <input type="text" placeholder="在当前分组中搜索公司或岗位..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="w-full pl-10 pr-4 py-3 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-100 outline-none shadow-sm" />
                </div>

                {/* 列表 */}
                <div className="space-y-4">
                {finalDisplayJobs.length === 0 ? (
                    <div className="text-center py-20 bg-white rounded-2xl border border-dashed border-slate-300">
                    <Briefcase className="w-8 h-8 text-slate-300 mx-auto mb-4" />
                    <h3 className="text-lg font-medium text-slate-900">
                        {isViewMode ? '暂无记录' : '暂无记录'}
                    </h3>
                    <p className="text-sm text-slate-500 mt-2">当前分组或搜索条件下未找到匹配项</p>
                    </div>
                ) : (
                    finalDisplayJobs.map(job => (
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

      <WelcomeModal isOpen={showWelcome} initialMode={welcomeInitialMode} onSelectView={handleSelectView} onClose={(isManageMode || isViewMode) ? () => setShowWelcome(false) : undefined} onLoginSuccess={() => setShowWelcome(false)} />
      <JobModal isOpen={isJobModalOpen} onClose={() => setIsJobModalOpen(false)} onSave={handleSaveJob} editingJob={editingJob} defaultSteps={config.defaultSteps} />
      <SettingsModal isOpen={isSettingsModalOpen} onClose={() => setIsSettingsModalOpen(false)} defaultSteps={config.defaultSteps} onSave={handleSaveSettings} />
    </div>
  );
};

export default App;