import React, { useState, useEffect, useMemo } from 'react';
import { JobApplication, AppConfig, StepStatus } from './types';
import { DEFAULT_STEPS, STORAGE_KEYS } from './constants';
import { JobCard } from './components/JobCard';
import { JobModal } from './components/JobModal';
import { SettingsModal } from './components/SettingsModal';
import { LoginModal } from './components/LoginModal'; // 引入新组件
import { Plus, Settings, Search, LayoutList, Briefcase, Loader2, LogIn, LogOut, Lock, Unlock } from 'lucide-react';
import { supabase } from './supabaseClient';
import { User } from '@supabase/supabase-js';

const App: React.FC = () => {
  const [jobs, setJobs] = useState<JobApplication[]>([]);
  const [config, setConfig] = useState<AppConfig>({ defaultSteps: DEFAULT_STEPS });
  const [isJobModalOpen, setIsJobModalOpen] = useState(false);
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);
  const [isLoginModalOpen, setIsLoginModalOpen] = useState(false); // 登录窗口状态
  const [editingJob, setEditingJob] = useState<JobApplication | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  
  // 用户状态
  const [user, setUser] = useState<User | null>(null);

  // 初始化：加载配置、数据、监听 Auth
  useEffect(() => {
    // 1. 获取当前 session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
    });

    // 2. 监听登录/登出变化
    const { data: { subscription: authListener } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });

    // 3. 加载本地配置
    const savedConfig = localStorage.getItem(STORAGE_KEYS.CONFIG);
    if (savedConfig) {
      try { setConfig(JSON.parse(savedConfig)); } catch (e) { console.error(e); }
    }

    // 4. 加载数据 & 开启 Realtime
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

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.CONFIG, JSON.stringify(config));
  }, [config]);

  const fetchJobs = async () => {
    const { data, error } = await supabase.from('jobs').select('*').order('updated_at', { ascending: false });
    if (data) {
      const mappedJobs: JobApplication[] = data.map((item: any) => ({
        id: item.id,
        company: item.company,
        position: item.position,
        jobType: item.job_type,
        salary: item.salary,
        notes: item.notes,
        steps: item.steps || [],
        currentStepIndex: item.current_step_index,
        currentStepStatus: item.current_step_status,
        stepDates: item.step_dates || {},
        createdAt: new Date(item.created_at).getTime(),
        updatedAt: new Date(item.updated_at).getTime(),
      }));
      setJobs(mappedJobs);
    }
    setIsLoading(false);
  };

  // 数据库操作 (只有 user 存在时才会被调用)
  const handleSaveJob = async (jobData: any, id?: string) => {
    if (!user) return alert("请先登录"); // 双重保险
    const dbPayload = {
      company: jobData.company,
      position: jobData.position,
      job_type: jobData.jobType,
      salary: jobData.salary,
      notes: jobData.notes,
      steps: jobData.steps,
      current_step_index: jobData.currentStepIndex,
      current_step_status: jobData.currentStepStatus,
      step_dates: jobData.stepDates,
      updated_at: new Date().toISOString(),
    };
    if (id) await supabase.from('jobs').update(dbPayload).eq('id', id);
    else await supabase.from('jobs').insert([dbPayload]);
    fetchJobs();
  };

  const handleDeleteJob = async (id: string) => {
    if (!user) return;
    if (window.confirm('确定要删除这条投递记录吗？')) {
      setJobs(prev => prev.filter(job => job.id !== id));
      const { error } = await supabase.from('jobs').delete().eq('id', id);
      if (error) { alert('删除失败'); fetchJobs(); }
    }
  };

  const handleUpdateStep = async (id: string, targetIndex: number) => {
    if (!user) return; // 未登录不可更改状态
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

    setJobs(prev => prev.map(j => j.id === id ? { ...j, currentStepIndex: newIndex, currentStepStatus: newStatus, stepDates: newDates, updatedAt: Date.now() } : j));
    await supabase.from('jobs').update({ current_step_index: newIndex, current_step_status: newStatus, step_dates: newDates, updated_at: new Date().toISOString() }).eq('id', id);
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
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
            <div className="bg-blue-600 p-1.5 rounded-lg">
                <LayoutList className="text-white w-6 h-6" />
            </div>
            <h1 className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-700 to-blue-500">
              JobFlow
            </h1>
            {/* 状态指示器：仅显示小锁图标 */}
            {user ? <Unlock size={14} className="text-green-500 ml-2" /> : <Lock size={14} className="text-slate-400 ml-2" />}
          </div>
          
          <div className="flex items-center gap-3">
             {/* 只有登录后才显示设置按钮 */}
             {user && (
               <button onClick={() => setIsSettingsModalOpen(true)} className="p-2 text-slate-500 hover:bg-slate-100 rounded-lg">
                 <Settings size={20} />
               </button>
             )}

             {/* 登录/登出 按钮 */}
             {user ? (
               <button onClick={handleLogout} className="p-2 text-red-500 hover:bg-red-50 rounded-lg" title="退出登录">
                 <LogOut size={20} />
               </button>
             ) : (
               <button onClick={() => setIsLoginModalOpen(true)} className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg" title="管理员登录">
                 <LogIn size={20} />
               </button>
             )}

            {/* 只有登录后才显示添加按钮 */}
            {user && (
              <button
                onClick={() => { setEditingJob(null); setIsJobModalOpen(true); }}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 shadow-md active:scale-95 font-medium"
              >
                <Plus size={18} />
                <span className="hidden sm:inline">记一笔</span>
              </button>
            )}
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-5xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* 统计卡片 (代码略，与之前相同，直接保留即可) */}
        <div className="mb-8 grid grid-cols-2 md:grid-cols-4 gap-4">
             {/* ...这里保留你的统计代码... */}
             {/* 为了完整性这里简单写一个示例 */}
             <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-100"><div className="text-slate-500 text-xs sm:text-sm font-medium">总投递</div><div className="text-2xl font-bold text-slate-800">{jobs.length}</div></div>
             <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-100"><div className="text-slate-500 text-xs sm:text-sm font-medium">进行中</div><div className="text-2xl font-bold text-blue-600">{jobs.filter(j => j.currentStepStatus !== 'rejected' && j.currentStepIndex < j.steps.length - 1).length}</div></div>
             <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-100"><div className="text-slate-500 text-xs sm:text-sm font-medium">已通过</div><div className="text-2xl font-bold text-emerald-500">{jobs.filter(j => j.currentStepStatus !== 'rejected' && j.currentStepIndex === j.steps.length - 1).length}</div></div>
             <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-100"><div className="text-slate-500 text-xs sm:text-sm font-medium">已挂</div><div className="text-2xl font-bold text-red-500">{jobs.filter(j => j.currentStepStatus === 'rejected').length}</div></div>
        </div>

        {/* 搜索栏 */}
        <div className="mb-6 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-5 h-5" />
          <input 
            type="text" 
            placeholder="搜索公司或岗位..." 
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-3 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-100 outline-none shadow-sm"
          />
        </div>

        {/* 列表 */}
        <div className="space-y-4">
          {filteredJobs.length === 0 ? (
            <div className="text-center py-20 bg-white rounded-2xl border border-dashed border-slate-300">
              <Briefcase className="w-8 h-8 text-slate-300 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-slate-900">暂无投递记录</h3>
            </div>
          ) : (
            filteredJobs.map(job => (
              <JobCard
                key={job.id}
                job={job}
                onUpdateStep={handleUpdateStep}
                onEdit={(j) => { setEditingJob(j); setIsJobModalOpen(true); }}
                onDelete={handleDeleteJob}
                isEditable={!!user} // 关键：将登录状态传给卡片
              />
            ))
          )}
        </div>
      </main>

      <JobModal 
        isOpen={isJobModalOpen}
        onClose={() => setIsJobModalOpen(false)}
        onSave={handleSaveJob}
        editingJob={editingJob}
        defaultSteps={config.defaultSteps}
      />
      <SettingsModal 
        isOpen={isSettingsModalOpen}
        onClose={() => setIsSettingsModalOpen(false)}
        defaultSteps={config.defaultSteps}
        onSave={handleSaveSettings}
      />
      <LoginModal 
        isOpen={isLoginModalOpen}
        onClose={() => setIsLoginModalOpen(false)}
      />
    </div>
  );
};

export default App;