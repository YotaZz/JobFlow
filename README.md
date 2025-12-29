# JobFlow - 招聘投递追踪

<div align="center">
<img width="100%" alt="JobFlow Banner" src="[https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6](https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6)" />
</div>

<div align="center">





<strong>全流程可视化求职进度管理工具</strong>







<p>
<a href="#-功能特性">功能特性</a> •
<a href="#-技术栈">技术栈</a> •
<a href="#-快速开始">快速开始</a> •
<a href="#-数据库配置">数据库配置</a>
</p>
</div>

---

## 📖 简介

**JobFlow** 是一个现代化的求职进度追踪应用。它摒Lx弃了繁琐的 Excel 表格，通过直观的**进度条（Stepper）和卡片式布局**，帮助求职者清晰地管理每一个面试流程。

无论是实习、校招还是社招，你都可以自定义招聘节点，记录薪资待遇、面试备注，并实时追踪从“已投递”到“OC”的全过程。

## ✨ 功能特性

* **📊 可视化进度追踪**：通过动态进度条展示面试阶段，支持“进入”、“等待”、“挂掉”三种状态的直观切换。
* **🤖 自动化流程管理**：
* 智能检测“初筛”阶段，若超过 10 天无状态更新，自动标记为“无回应/已挂”（Ghosting Detection）。
* 自动记录每个步骤的时间节点，生成时间线。


* **🏷️ 多维度岗位管理**：支持 **实习**、**校招**、**社招** 三种岗位类型，配备不同的视觉标识。
* **wmv 自定义招聘流程**：支持全局配置默认面试流程（如：笔试 -> 一面 -> 二面 -> HR面），也可针对单个投递记录进行微调。
* **🔐 安全的数据管理**：集成 Supabase Auth 和 Database，支持管理员登录与数据云端同步。
* **📈 数据看板**：实时统计总投递数、进行中、已通过及已挂掉的岗位数量。

## 🛠️ 技术栈

* **前端框架**: [React 19](https://react.dev/)
* **构建工具**: [Vite](https://vitejs.dev/)
* **样式库**: [Tailwind CSS](https://tailwindcss.com/)
* **图标库**: [Lucide React](https://lucide.dev/)
* **后端服务 (BaaS)**: [Supabase](https://supabase.com/) (PostgreSQL + Auth + Realtime)

## 🚀 快速开始

### 1. 克隆项目与安装依赖

```bash
git clone https://github.com/your-username/jobflow.git
cd jobflow
npm install

```

### 2. 配置环境变量

在项目根目录创建一个 `.env.local` 文件，并填入以下内容：

```env
# Supabase 配置 (必须)
VITE_SUPABASE_URL=你的_Supabase_Project_URL
VITE_SUPABASE_ANON_KEY=你的_Supabase_Anon_Key

# Gemini API Key (如果在 AI Studio 环境下运行)
GEMINI_API_KEY=你的_Gemini_Key

```

### 3. 运行开发服务器

```bash
npm run dev

```

打开浏览器访问 `http://localhost:3000` 即可看到应用。

## 🗄️ 数据库配置 (Supabase)

本项目依赖 Supabase 的 PostgreSQL 数据库。请在 Supabase 的 SQL Editor 中执行以下命令以创建 `jobs` 表：

```sql
create table public.jobs (
  id uuid not null default gen_random_uuid (),
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  company text not null,
  position text not null,
  job_type text not null, -- 'internship' | 'campus' | 'social'
  salary text null,
  notes text null,
  steps text[] null, -- 存储步骤名称数组
  current_step_index integer null default 0,
  current_step_status text null, -- 'in-progress' | 'waiting' | 'rejected'
  step_dates jsonb null default '{}'::jsonb, -- 存储每个步骤的时间戳
  constraint jobs_pkey primary key (id)
);

-- 开启实时监听 (Realtime)
alter publication supabase_realtime add table public.jobs;

```

> **注意**：如果不设置上述表结构，应用将无法加载或保存数据。

## 🤝 贡献

欢迎提交 Issue 或 Pull Request 来改进 JobFlow！

1. Fork 本仓库
2. 创建你的特性分支 (`git checkout -b feature/AmazingFeature`)
3. 提交你的修改 (`git commit -m 'Add some AmazingFeature'`)
4. 推送到分支 (`git push origin feature/AmazingFeature`)
5. 打开一个 Pull Request

## 📄 许可证

[MIT License](https://www.google.com/search?q=LICENSE)