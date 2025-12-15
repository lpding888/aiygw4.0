export interface GlobalQueueStats {
  totalQueued: number;
  totalProcessed: number;
  totalFailed: number;
  totalCompleted: number;
  activeJobs: number;
  waitingJobs: number;
}

export interface QueuesHealthReport {
  status: 'healthy' | 'degraded' | 'unhealthy';
  activeQueues?: number;
  totalJobs?: number;
  globalStats?: GlobalQueueStats;
  timestamp?: string;
  error?: string;
}
