import React, { useState } from 'react';
import { X, Lock, Loader2, UserPlus, LogIn } from 'lucide-react'; // 引入新图标
import { supabase } from '../supabaseClient';

interface LoginModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const LoginModal: React.FC<LoginModalProps> = ({ isOpen, onClose }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [isSignUp, setIsSignUp] = useState(false); // 新增：控制注册/登录模式
  const [message, setMessage] = useState(''); // 新增：用于显示注册成功提示

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setMessage('');
    
    try {
      if (isSignUp) {
        // 注册逻辑
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
        });
        if (error) throw error;
        
        // 注册成功处理（Supabase 默认可能需要邮箱验证，视配置而定）
        if (data.user && !data.session) {
           setMessage("注册成功！请前往邮箱查收验证邮件。");
        } else {
           // 如果关闭了邮箱验证，直接登录成功
           onClose();
        }
      } else {
        // 登录逻辑
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (error) throw error;
        onClose();
      }
    } catch (err: any) {
      setError(err.message || '操作失败，请重试');
    } finally {
      setLoading(false);
    }
  };

  const toggleMode = () => {
      setIsSignUp(!isSignUp);
      setError('');
      setMessage('');
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6 animate-in fade-in zoom-in duration-200">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
            {isSignUp ? <UserPlus size={20} className="text-blue-600"/> : <LogIn size={20} className="text-blue-600"/>}
            {isSignUp ? '注册新账号' : '用户登录'}
          </h2>
          <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-full text-slate-500">
            <X size={20} />
          </button>
        </div>

        {message ? (
            <div className="text-center py-8">
                <div className="text-green-600 mb-4 font-medium">{message}</div>
                <button onClick={() => setMessage('')} className="text-sm text-blue-600 hover:underline">返回登录</button>
            </div>
        ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
            <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">邮箱</label>
                <input 
                type="email" 
                required
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                value={email}
                onChange={e => setEmail(e.target.value)}
                />
            </div>
            <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">密码</label>
                <input 
                type="password" 
                required
                minLength={6}
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                value={password}
                onChange={e => setPassword(e.target.value)}
                />
            </div>

            {error && <div className="text-red-500 text-sm">{error}</div>}

            <button 
                type="submit" 
                disabled={loading}
                className="w-full py-2.5 bg-blue-600 text-white font-bold rounded-lg hover:bg-blue-700 disabled:opacity-50 flex justify-center items-center gap-2"
            >
                {loading ? <Loader2 size={18} className="animate-spin"/> : (isSignUp ? '立即注册' : '登录')}
            </button>

            <div className="text-center mt-4">
                <button 
                    type="button"
                    onClick={toggleMode}
                    className="text-sm text-slate-500 hover:text-blue-600 transition-colors"
                >
                    {isSignUp ? '已有账号？去登录' : '没有账号？去注册'}
                </button>
            </div>
            </form>
        )}
      </div>
    </div>
  );
};