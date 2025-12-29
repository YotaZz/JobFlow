import React, { useState, useEffect } from 'react';
import { Eye, ShieldCheck, ArrowRight, Loader2, UserPlus, LogIn, Lock, KeyRound } from 'lucide-react'; // 引入 KeyRound 图标
import { supabase } from '../supabaseClient';

interface WelcomeModalProps {
  isOpen: boolean;
  onClose?: () => void;
  onLoginSuccess?: () => void;
  onSelectView: (email: string) => void;
  initialMode?: 'selection' | 'auth';
}

export const WelcomeModal: React.FC<WelcomeModalProps> = ({ 
  isOpen, 
  onClose,
  onLoginSuccess,
  onSelectView,
  initialMode = 'selection'
}) => {
  // 修改：增加 'forgot-password' 模式
  const [mode, setMode] = useState<'selection' | 'view-input' | 'auth' | 'forgot-password'>(initialMode);
  
  // Auth Form State
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [viewEmail, setViewEmail] = useState('');

  useEffect(() => {
    if (isOpen) {
      setMode(initialMode);
      resetForm();
    }
  }, [isOpen, initialMode]);

  const resetForm = () => {
    setError('');
    setMessage('');
    setLoading(false);
    setEmail('');
    setPassword('');
    setViewEmail('');
    setIsSignUp(false);
  };

  if (!isOpen) return null;

  // ... (handleViewSubmit 保持不变)
  const handleViewSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (viewEmail.trim()) {
      onSelectView(viewEmail.trim());
    }
  };

  // ... (handleAuthSubmit 保持不变)
  const handleAuthSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setMessage('');
    
    try {
      if (isSignUp) {
        const { data, error } = await supabase.auth.signUp({ email, password });
        if (error) throw error;
        if (data.user && !data.session) {
           setMessage("注册成功！请前往邮箱查收验证邮件。");
        } else {
           if (onLoginSuccess) onLoginSuccess();
        }
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        if (onLoginSuccess) onLoginSuccess();
      }
    } catch (err: any) {
      setError(err.message || '操作失败，请重试');
    } finally {
      setLoading(false);
    }
  };

  // 新增：处理重置密码请求
  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setMessage('');

    try {
        // 重定向 URL 必须在 Supabase 后台配置过 (Redirect URLs)
        const { error } = await supabase.auth.resetPasswordForEmail(email, {
            redirectTo: window.location.origin, 
        });
        if (error) throw error;
        setMessage("重置链接已发送！请查收邮件，点击链接登录后即可修改密码。");
    } catch (err: any) {
        setError(err.message || '发送失败，请检查邮箱是否正确');
    } finally {
        setLoading(false);
    }
  };

  const getHeaderContent = () => {
    switch (mode) {
      case 'view-input':
        return { bg: 'bg-gradient-to-br from-emerald-500 to-teal-600', title: '查看他人进度', subtitle: '请输入目标用户的邮箱地址' };
      case 'auth':
        return { bg: 'bg-gradient-to-br from-blue-600 to-indigo-700', title: isSignUp ? '注册新账号' : '管理员登录', subtitle: isSignUp ? '创建账号以开始追踪您的求职进度' : '登录以管理您的投递记录' };
      case 'forgot-password': // 新增
        return { bg: 'bg-gradient-to-br from-slate-600 to-slate-700', title: '重置密码', subtitle: '请输入注册邮箱以接收验证链接' };
      default: 
        return { bg: 'bg-gradient-to-br from-blue-600 to-indigo-700', title: '欢迎使用 JobFlow', subtitle: '请选择您的使用模式' };
    }
  };

  const header = getHeaderContent();

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in duration-300 flex flex-col max-h-[90vh]">
        
        <div className={`p-8 text-center text-white transition-colors duration-300 ${header.bg}`}>
          <h1 className="text-2xl font-bold mb-2">{header.title}</h1>
          <p className="text-blue-100 text-sm">{header.subtitle}</p>
        </div>

        <div className="p-6 overflow-y-auto">
          {/* ... Selection Mode 和 View Mode 代码保持不变 ... */}
          {mode === 'selection' && (
             <div className="space-y-4 animate-in slide-in-from-left duration-300">
               <button onClick={() => setMode('auth')} className="w-full group relative flex items-center gap-4 p-4 rounded-xl border border-slate-200 hover:border-blue-500 hover:bg-blue-50 transition-all text-left">
                 <div className="bg-blue-100 text-blue-600 p-3 rounded-lg group-hover:bg-blue-600 group-hover:text-white transition-colors"><ShieldCheck size={24} /></div>
                 <div className="flex-1"><h3 className="font-bold text-slate-800">我要管理</h3><p className="text-xs text-slate-500 mt-1">登录/注册账号，创建和管理我的投递记录</p></div><ArrowRight size={18} className="text-slate-300 group-hover:text-blue-600" />
               </button>

               <button onClick={() => setMode('view-input')} className="w-full group relative flex items-center gap-4 p-4 rounded-xl border border-slate-200 hover:border-emerald-500 hover:bg-emerald-50 transition-all text-left">
                 <div className="bg-emerald-100 text-emerald-600 p-3 rounded-lg group-hover:bg-emerald-600 group-hover:text-white transition-colors"><Eye size={24} /></div>
                 <div className="flex-1"><h3 className="font-bold text-slate-800">仅查看</h3><p className="text-xs text-slate-500 mt-1">输入邮箱，查看该用户的公开投递进度</p></div><ArrowRight size={18} className="text-slate-300 group-hover:text-emerald-600" />
               </button>
               {onClose && <button onClick={onClose} className="w-full mt-4 py-2 text-slate-400 hover:text-slate-600 text-sm">关闭窗口</button>}
             </div>
          )}

          {mode === 'view-input' && (
             <form onSubmit={handleViewSubmit} className="space-y-4 animate-in slide-in-from-right duration-300">
               <div><input type="email" required placeholder="例如：name@example.com" className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none text-center text-lg" value={viewEmail} onChange={e => setViewEmail(e.target.value)} autoFocus /></div>
               <div className="flex gap-3 pt-2">
                 <button type="button" onClick={() => setMode('selection')} className="flex-1 py-2.5 text-slate-600 font-medium hover:bg-slate-100 rounded-lg">返回</button>
                 <button type="submit" className="flex-1 py-2.5 bg-emerald-600 text-white font-bold rounded-lg hover:bg-emerald-700 shadow-lg shadow-emerald-200">查看记录</button>
               </div>
             </form>
          )}

          {/* Auth 模式 (登录/注册) */}
          {mode === 'auth' && (
            <div className="animate-in slide-in-from-right duration-300">
              {message ? (
                <div className="text-center py-6">
                  <div className="text-green-600 mb-6 font-medium bg-green-50 p-4 rounded-lg">{message}</div>
                  <button onClick={() => { setMessage(''); setIsSignUp(false); }} className="text-blue-600 hover:underline font-medium">返回登录</button>
                </div>
              ) : (
                <form onSubmit={handleAuthSubmit} className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">邮箱</label>
                    <input type="email" required className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" value={email} onChange={e => setEmail(e.target.value)} />
                  </div>
                  <div>
                    <div className="flex justify-between items-center mb-1">
                        <label className="block text-sm font-medium text-slate-700">密码</label>
                        {!isSignUp && (
                            <button type="button" onClick={() => { setMode('forgot-password'); setError(''); }} className="text-xs text-blue-600 hover:underline">
                                忘记密码？
                            </button>
                        )}
                    </div>
                    <input type="password" required minLength={6} className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" value={password} onChange={e => setPassword(e.target.value)} />
                  </div>

                  {error && <div className="text-red-500 text-sm bg-red-50 p-3 rounded-lg">{error}</div>}

                  <div className="flex gap-3 pt-2">
                    <button type="button" onClick={() => setMode('selection')} className="flex-1 py-2.5 text-slate-600 font-medium hover:bg-slate-100 rounded-lg">返回</button>
                    <button type="submit" disabled={loading} className="flex-1 py-2.5 bg-blue-600 text-white font-bold rounded-lg hover:bg-blue-700 disabled:opacity-50 flex justify-center items-center gap-2 shadow-lg shadow-blue-200">
                      {loading ? <Loader2 size={18} className="animate-spin"/> : (isSignUp ? '立即注册' : '登录')}
                    </button>
                  </div>

                  <div className="text-center mt-4">
                    <button type="button" onClick={() => { setIsSignUp(!isSignUp); setError(''); }} className="text-sm text-slate-500 hover:text-blue-600 transition-colors">
                        {isSignUp ? '已有账号？去登录' : '没有账号？去注册'}
                    </button>
                  </div>
                </form>
              )}
            </div>
          )}

          {/* 新增：忘记密码模式 */}
          {mode === 'forgot-password' && (
             <div className="animate-in slide-in-from-right duration-300">
                {message ? (
                    <div className="text-center py-6">
                        <div className="text-green-600 mb-6 font-medium bg-green-50 p-4 rounded-lg">{message}</div>
                        <button onClick={() => { setMode('auth'); setMessage(''); }} className="text-blue-600 hover:underline font-medium">返回登录</button>
                    </div>
                ) : (
                    <form onSubmit={handleResetPassword} className="space-y-4">
                         <div className="bg-slate-50 p-4 rounded-lg mb-4 text-sm text-slate-600 flex items-start gap-3">
                            <KeyRound className="shrink-0 text-slate-400" size={20} />
                            <p>输入您的注册邮箱。我们将向您发送一个验证链接，点击该链接即可直接登录并重置密码。</p>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">注册邮箱</label>
                            <input type="email" required className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-500 outline-none" value={email} onChange={e => setEmail(e.target.value)} />
                        </div>
                        
                        {error && <div className="text-red-500 text-sm bg-red-50 p-3 rounded-lg">{error}</div>}

                        <div className="flex gap-3 pt-2">
                            <button type="button" onClick={() => { setMode('auth'); setError(''); }} className="flex-1 py-2.5 text-slate-600 font-medium hover:bg-slate-100 rounded-lg">返回</button>
                            <button type="submit" disabled={loading} className="flex-1 py-2.5 bg-slate-800 text-white font-bold rounded-lg hover:bg-slate-900 disabled:opacity-50 flex justify-center items-center gap-2 shadow-lg">
                                {loading ? <Loader2 size={18} className="animate-spin"/> : '发送验证链接'}
                            </button>
                        </div>
                    </form>
                )}
             </div>
          )}
        </div>
      </div>
    </div>
  );
};