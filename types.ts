// types.ts

export type StepStatus = 'in-progress' | 'waiting' | 'rejected';
export type JobType = 'internship' | 'campus' | 'social';

export interface UserProfile {
  id: string;
  email: string;
  updated_at?: string;
  total_applications?: number;
  active_applications?: number;
  offers_received?: number;
  rejected_applications?: number;
}

export interface JobApplication {
  id: string;
  company: string;
  position: string;
  jobType: JobType;
  tags: string[]; // 变更点：由 season?: string 改为 tags string array
  salary?: string;
  notes?: string;
  steps: string[];
  currentStepIndex: number;
  currentStepStatus: StepStatus;
  stepDates: Record<number, number>; 
  createdAt: number;
  updatedAt: number;
}

export interface AppConfig {
  defaultSteps: string[];
}