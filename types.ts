export type JobType = 'internship' | 'campus' | 'social';
export type StepStatus = 'in-progress' | 'waiting' | 'rejected';

export interface JobApplication {
  id: string;
  company: string;
  position: string;
  jobType: JobType;
  salary: string;
  notes: string;
  steps: string[];
  currentStepIndex: number;
  currentStepStatus: StepStatus; // Added: status of the current step
  stepDates: Record<number, number>; // Added: map of step index to timestamp
  updatedAt: number;
  createdAt: number;
}

export interface AppConfig {
  defaultSteps: string[];
}

export type SortOption = 'updated' | 'created' | 'company';
