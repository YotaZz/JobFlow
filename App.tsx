import React, { useState, useEffect, useMemo } from 'react';
import { JobApplication, AppConfig, StepStatus } from './types';
import { DEFAULT_STEPS, STORAGE_KEYS } from './constants';
import { JobCard } from './components/JobCard';
import { JobModal } from './components/JobModal';
import { SettingsModal } from './components/SettingsModal';
import { Plus, Settings, Search, LayoutList, Briefcase, Loader2 } from 'lucide-react';
// 直接引入同级目录下的 supabaseClient
import { supabase } from './supabaseClient';

const App: React.FC = () => {
  // State
  const [jobs, setJobs] = useState<JobApplication[]>([]);
  const [config, setConfig] = useState<AppConfig>({ defaultSteps: DEFAULT_STEPS });
  const [isJobModalOpen, setIsJobModalOpen] = useState(false);
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);
  const [editingJob, setEditingJob] = useState<JobApplication | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [isLoading, setIsLoading] = useState(true);

  // 1. 初始化：加载数据并开启实时监听
  useEffect(() => {
    fetchJobs();

    // 开启 Supabase 实时监听
    const channel = supabase
      .channel('jobs_realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'jobs' }, () => {
        fetchJobs(); // 数据库变动时重新拉取
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  // 2. 初始化：加载本地配置 (Config 仍保存在本地)
  useEffect(() => {
    const savedConfig = localStorage.getItem(STORAGE_KEYS.CONFIG);
    if (savedConfig) {
      try {
        setConfig(JSON.parse(savedConfig));
      } catch (e) {
        console.error("Failed to parse config", e);
      }
    }
  }, []);

  // 3. 监听配置变更并保存到本地
  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.CONFIG, JSON.stringify(config));
  }, [config]);

  // 从 Supabase 拉取数据
  const fetchJobs = async () => {
    // 这里不立即设为 true，以免实时更新时页面闪烁，仅在首次加载时依赖 isLoading
    const { data, error } = await supabase
      .from('jobs')
      .select('*')
      .order('updated_at', { ascending: false });

    if (error) {
      console.error('Error fetching jobs:', error);
    } else if (data) {
      // 字段映射：DB(下划线) -> App(驼峰)
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

  // 保存 (新增或编辑)
  const handleSaveJob = async (jobData: Omit<JobApplication, 'id' | 'updatedAt' | 'createdAt'>, id?: string) => {
    // 构造写入数据库的数据
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

    if (id) {
      // 编辑模式
      await supabase.from('jobs').update(dbPayload).eq('id', id);
    } else {
      // 新增模式
      await supabase.from('jobs').insert([dbPayload]);
    }
    // 注意：fetchJobs 会通过 Realtime 触发，这里其实不需要手动调，但为了UI响应更快可以手动调一次
    fetchJobs();
  };

  // 删除
  const handleDeleteJob = async (id: string) => {
    if (window.confirm('确定要删除这条投递记录吗？')) {
      // 先在本地乐观更新 (Optimistic UI)，让用户感觉更快
      setJobs(prev => prev.filter(job => job.id !== id));
      
      const { error } = await supabase.from('jobs').delete().eq('id', id);
      if (error) {
        alert('删除失败，请重试');
        fetchJobs(); // 回滚
      }
    }
  };

  // 更新步骤状态
  const handleUpdateStep = async (id: string, targetIndex: number) => {
    const job = jobs.find(j => j.id === id);
    if (!job) return;

    // --- 复用原有的业务逻辑计算新状态 ---
    const stepName = job.steps[targetIndex];
    const isOC = stepName && stepName.toUpperCase() === 'OC';
    const isScreening = stepName === '初筛' || targetIndex === 1;

    let newIndex = job.currentStepIndex;
    let newStatus: StepStatus = job.currentStepStatus;
    let newDates = { ...job.stepDates };

    if (targetIndex === job.currentStepIndex) {
        // 点击当前步骤：在状态间循环
        if (isOC) return; // OC 只有完成态

        let statusFlow: StepStatus[] = ['in-progress', 'waiting', 'rejected'];
        if (isScreening) {
            statusFlow = ['waiting', 'rejected'];
        }

        const currentStatusIndex = statusFlow.indexOf(job.currentStepStatus);
        // 如果当前状态不在流程中（比如旧数据），默认跳到第一个
        let nextStatusIndex = 0;
        if (currentStatusIndex !== -1) {
             nextStatusIndex = (currentStatusIndex + 1) % statusFlow.length;
        }
        newStatus = statusFlow[nextStatusIndex];

    } else {
        // 点击新步骤：跳转进度
        newIndex = targetIndex;
        newDates[targetIndex] = Date.now(); // 记录时间
        
        // 初始状态逻辑
        newStatus = isScreening ? 'waiting' : 'in-progress';
    }
    // ------------------------------------

    // 乐观更新 (本地先变，防止网络延迟导致卡顿感)
    setJobs(prev => prev.map(j => j.id === id ? {
        ...j,
        currentStepIndex: newIndex,
        currentStepStatus: newStatus,
        stepDates: newDates,
        updatedAt: Date.now()
    } : j));

    // 写入数据库
    await supabase.from('jobs').update({
        current_step_index: newIndex,
        current_step_status: newStatus,
        step_dates: newDates,
        updated_at: new Date().toISOString()
    }).eq('id', id);
  };

  // UI Handlers
  const openAddModal = () => {
    setEditingJob(null);
    setIsJobModalOpen(true);
  };

  const openEditModal = (job: JobApplication) => {
    setEditingJob(job);
    setIsJobModalOpen(true);
  };

  const handleSaveSettings = (newDefaultSteps: string[]) => {
    setConfig({ defaultSteps: newDefaultSteps });
  };

  // Filtering
  const filteredJobs = useMemo(() => {
    return jobs.filter(job => 
      job.company.toLowerCase().includes(searchTerm.toLowerCase()) || 
      job.position.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [jobs, searchTerm]);

  // Loading View
  if (isLoading) {
      return (
        <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50 gap-3">
            <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />
            <p className="text-slate-400 text-sm">正在同步数据...</p>
        </div>
      );
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      {/* Navbar */}
      <header className="sticky top-0 z-30 bg-white/80 backdrop-blur-md border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="bg-blue-600 p-1.5 rounded-lg">
                <LayoutList className="text-white w-6 h-6" />
            </div>
            <h1 className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-700 to-blue-500">
              JobFlow
            </h1>
          </div>
          
          <div className="flex items-center gap-3">
             <button
              onClick={() => setIsSettingsModalOpen(true)}
              className="p-2 text-slate-500 hover:bg-slate-100 rounded-lg transition-colors"
              title="设置"
            >
              <Settings size={20} />
            </button>
            <button
              onClick={openAddModal}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-all shadow-md shadow-blue-200 active:scale-95 font-medium"
            >
              <Plus size={18} />
              <span className="hidden sm:inline">记一笔</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 max-w-5xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
        
        {/* Statistics Area */}
        <div className="mb-8 grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-100">
                <div className="text-slate-500 text-xs sm:text-sm font-medium">总投递</div>
                <div className="text-2xl lg:text-3xl font-bold text-slate-800 mt-1">{jobs.length}</div>
            </div>
            
            <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-100">
                <div className="text-slate-500 text-xs sm:text-sm font-medium">进行中</div>
                <div className="text-2xl lg:text-3xl font-bold text-blue-600 mt-1">
                    {jobs.filter(j => j.currentStepStatus !== 'rejected' && j.currentStepIndex < j.steps.length - 1).length}
                </div>
            </div>

            <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-100">
                <div className="text-slate-500 text-xs sm:text-sm font-medium">已通过</div>
                <div className="text-2xl lg:text-3xl font-bold text-emerald-500 mt-1">
                    {jobs.filter(j => j.currentStepStatus !== 'rejected' && j.currentStepIndex === j.steps.length - 1).length}
                </div>
            </div>

            <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-100">
                <div className="text-slate-500 text-xs sm:text-sm font-medium">已挂</div>
                <div className="text-2xl lg:text-3xl font-bold text-red-500 mt-1">
                    {jobs.filter(j => j.currentStepStatus === 'rejected').length}
                </div>
            </div>
        </div>

        {/* Search Bar */}
        <div className="mb-6 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-5 h-5" />
          <input 
            type="text" 
            placeholder="搜索公司或岗位..." 
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-3 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-100 focus:border-blue-400 outline-none transition-all shadow-sm"
          />
        </div>

        {/* Job List */}
        <div className="space-y-4">
          {filteredJobs.length === 0 ? (
            <div className="text-center py-20 bg-white rounded-2xl border border-dashed border-slate-300">
              <div className="bg-slate-50 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Briefcase className="w-8 h-8 text-slate-300" />
              </div>
              <h3 className="text-lg font-medium text-slate-900">暂无投递记录</h3>
              <p className="text-slate-500 mt-1">点击右上角的按钮开始添加你的第一个投递</p>
            </div>
          ) : (
            filteredJobs.map(job => (
              <JobCard
                key={job.id}
                job={job}
                onUpdateStep={handleUpdateStep}
                onEdit={openEditModal}
                onDelete={handleDeleteJob}
              />
            ))
          )}
        </div>
      </main>

      {/* Modals */}
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
    </div>
  );
};

export default App;