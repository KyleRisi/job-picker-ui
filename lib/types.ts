export type JobStatus = 'AVAILABLE' | 'FILLED' | 'REHIRING';

export type Job = {
  id: string;
  title: string;
  description: string;
  reports_to: string;
  salary_benefits?: string | null;
  rehiring_reason?: string | null;
  job_ref: string;
  status: JobStatus;
};

export type Assignment = {
  id: string;
  job_id: string;
  assignment_ref: string;
  full_name: string;
  first_name: string;
  email: string;
  q1: string;
  q2: string;
  q3: string;
  day_to_day: string;
  incidents: string;
  kpi_assessment: string;
  consent_read_on_show: boolean;
  user_id: string | null;
  active: boolean;
};
