# JobFlow - 招聘投递追踪

<div align="center">

<strong>全流程可视化求职进度管理工具</strong>

<p>
<a href="#-功能特性">功能特性</a> •
<a href="#-界面预览">界面预览</a> •
<a href="#-在线使用-推荐">在线使用</a> •
<a href="#-开发者指南">开发者指南</a>
</p>
</div>

---

## 📖 简介

**JobFlow** 是一个现代化的求职进度追踪应用。它摒弃了繁琐的 Excel 表格，通过直观的**进度条 (Stepper)** 和**卡片式布局**，帮助求职者清晰地管理每一个面试流程。

无论是实习、校招还是社招，你都可以自定义招聘节点，记录薪资待遇、面试备注，并实时追踪从“已投递”到“OC”的全过程。

## 📸 界面预览

| 📊 **直观看板 & 统计** | 📝 **全流程进度追踪** |
| :---: | :---: |
| <img src="https://github.com/user-attachments/assets/b0c84625-549b-499a-adc4-1735184da8e4" width="100%" alt="Dashboard" /> | <img src="https://github.com/user-attachments/assets/151dde4f-8bbb-40b6-9744-e6874dcd1e37" width="100%" alt="Edit Modal" /> |
| **一目了然的投递状态概览** | **拖拽式节点管理与时间轴记录** |

| 👥 **多模式访问** | 📱 **移动端适配** |
| :---: | :---: |
| <img src="https://github.com/user-attachments/assets/87c22ec2-73b1-423f-b51e-b24350ccb834" width="100%" alt="Welcome Mode" /> | <img src="https://github.com/user-attachments/assets/099947b6-49b8-4dbd-8d7a-f6a7811ff16a" width="100%" alt="Mobile View" /> |
| **支持管理模式与仅查看分享模式** | **随时随地更新面试进度** |

---

## 🚀 在线使用 (推荐)

无需繁琐的配置和部署，我们提供了稳定、安全的在线服务，您可以直接注册账号并开始管理您的求职进度。

👉 [**点击进入 JobFlow - 招聘投递追踪**](https://jobflow-2bz.pages.dev/)

* ✅ **完全免费**：核心功能无限制使用。
* ✅ **数据安全**：基于 Supabase 的企业级数据隔离，仅您自己可见。
* ✅ **即开即用**：无需关心数据库或服务器维护。
* ✅ **公开分享**：支持生成只读链接，方便向导师或朋友展示进度。

---

## ✨ 功能特性

* **👥 多用户支持**：完整的注册/登录体系，数据云端同步，多端可查。
* **👀 仅查看模式**：支持通过输入邮箱查看特定用户的公开投递进度（只读），方便分享与进度汇报。
* **📊 可视化进度追踪**：通过动态进度条展示面试阶段，支持“进入”、“等待”、“挂掉”三种状态的直观切换。
* **🤖 自动化流程管理**：
  * **Ghosting Detection**：若“初筛”阶段超过 **10天** 无回应，自动标记为“无回应/已挂”。
  * **自动时间轴**：自动记录每个步骤的时间节点。
* **🏷️ 多维度岗位管理**：支持 **实习**、**校招**、**社招** 三种岗位类型。
* **⚙️ 自定义招聘流程**：支持全局配置默认面试流程（如：笔试 -> 一面 -> 二面 -> HR面）。

## 🛠️ 技术栈

* **前端框架**: [React 19](https://react.dev/)
* **构建工具**: [Vite](https://vitejs.dev/)
* **样式库**: [Tailwind CSS](https://tailwindcss.com/)
* **后端服务**: [Supabase](https://supabase.com/) (PostgreSQL + Auth + Realtime)

---

## 💻 开发者指南

> 如果您只是想使用本工具，请直接访问 [在线版本](#-在线使用-推荐)。以下内容仅供希望参与项目开发或私有化部署的开发者参考。

### 1. 克隆项目与安装依赖

```bash
git clone [https://github.com/your-username/jobflow.git](https://github.com/your-username/jobflow.git)
cd jobflow
npm install

```

### 2. 配置环境变量

在项目根目录创建一个 `.env.local` 文件，并填入以下内容：

```env
# Supabase 配置 (必须)
VITE_SUPABASE_URL=你的_Supabase_Project_URL
VITE_SUPABASE_ANON_KEY=你的_Supabase_Anon_Key

```

### 3. 运行开发服务器

```bash
npm run dev

```

### 4. 数据库配置 (Supabase)

本项目依赖 Supabase 的 PostgreSQL 数据库。若进行私有化部署，请在 Supabase 的 **SQL Editor** 中执行以下命令，以初始化表结构、安全策略（RLS）和自动化触发器。

<details>
<summary>点击展开 SQL 配置代码</summary>

```sql
-- 1. 创建 jobs 表 (核心数据表)
create table public.jobs (
  id uuid not null default gen_random_uuid (),
  user_id uuid references auth.users(id) default auth.uid(),
  
  -- 用户基本信息
  email text null,       -- 关联邮箱
  company text not null, -- 公司名称
  position text not null,-- 职位名称
  
  -- 职位详情
  job_type text not null, -- 'internship' | 'campus' | 'social'
  salary text null,
  notes text null,
  
  -- 进度控制
  steps text[] null, 
  current_step_index integer null default 0,
  current_step_status text null, -- 'in-progress' | 'waiting' | 'rejected'
  step_dates jsonb null default '{}'::jsonb, 
  
  -- 时间戳
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  
  constraint jobs_pkey primary key (id)
);

-- 2. 创建 profiles 表
create table public.profiles (
  id uuid references auth.users(id) on delete cascade not null primary key,
  email text unique not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null,
  total_applications integer DEFAULT 0,
  active_applications integer DEFAULT 0,
  offers_received integer DEFAULT 0,
  rejected_applications integer DEFAULT 0
);

-- 3. 开启实时监听
alter publication supabase_realtime add table public.jobs;

-- 4. 启用行级安全 (RLS)
ALTER TABLE public.jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- 5. 配置 jobs 表安全策略
CREATE POLICY "Enable read access for all users" ON public.jobs FOR SELECT USING (true);
CREATE POLICY "Users can insert their own jobs" ON public.jobs FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own jobs" ON public.jobs FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete their own jobs" ON public.jobs FOR DELETE USING (auth.uid() = user_id);

-- 6. 配置 profiles 表安全策略
CREATE POLICY "Public profiles are viewable by everyone." ON public.profiles FOR SELECT USING (true);
CREATE POLICY "Users can insert their own profile." ON public.profiles FOR INSERT WITH CHECK (auth.uid() = id);
CREATE POLICY "Users can update own profile." ON public.profiles FOR UPDATE USING (auth.uid() = id);

-- 7. 设置 Trigger: 自动创建 Profile
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER set search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, email) VALUES (new.id, new.email);
  RETURN new;
END;
$$;

CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();

-- 8. 设置 Trigger: 自动更新统计数据
CREATE OR REPLACE FUNCTION public.handle_job_changes()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  target_user_id uuid;
BEGIN
  IF (TG_OP = 'DELETE') THEN target_user_id := OLD.user_id; ELSE target_user_id := NEW.user_id; END IF;
  
  UPDATE public.profiles SET 
    total_applications = (SELECT count(*) FROM public.jobs WHERE user_id = target_user_id),
    active_applications = (SELECT count(*) FROM public.jobs WHERE user_id = target_user_id AND current_step_status != 'rejected'),
    updated_at = now()
  WHERE id = target_user_id;
  RETURN NULL;
END;
$$;

CREATE TRIGGER on_job_change
AFTER INSERT OR UPDATE OR DELETE ON public.jobs
FOR EACH ROW EXECUTE PROCEDURE public.handle_job_changes();

```

</details>

## 🤝 贡献

欢迎提交 Issue 或 Pull Request 来改进 JobFlow！

## 📄 许可证

[MIT License](https://www.google.com/search?q=LICENSE)