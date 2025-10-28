import axios, { AxiosInstance, AxiosError } from 'axios';

interface APIResponse<T = any> {
  success: boolean;
  data?: T;
  error?: {
    code: number;
    message: string;
  };
  message?: string;
}

class APIClient {
  private client: AxiosInstance;

  constructor() {
    this.client = axios.create({
      baseURL: process.env.NEXT_PUBLIC_API_URL || '/api',
      timeout: 30000,
      headers: {
        'Content-Type': 'application/json'
      }
    });

    // 请求拦截器
    this.client.interceptors.request.use(
      (config) => {
        // 从localStorage获取token
        if (typeof window !== 'undefined') {
          const token = localStorage.getItem('token');
          if (token) {
            config.headers.Authorization = `Bearer ${token}`;
          }
        }
        return config;
      },
      (error) => Promise.reject(error)
    );

    // 响应拦截器
    this.client.interceptors.response.use(
      (response) => response.data,
      (error: AxiosError<APIResponse>) => {
        // 401未登录,清除token并跳转登录页
        if (error.response?.status === 401) {
          if (typeof window !== 'undefined') {
            localStorage.removeItem('token');
            localStorage.removeItem('user');
            window.location.href = '/login';
          }
        }
        
        // 返回错误信息
        const errorData = error.response?.data;
        return Promise.reject({
          code: errorData?.error?.code || 9999,
          message: errorData?.error?.message || '网络错误,请重试'
        });
      }
    );
  }

  // 认证相关
  auth = {
    sendCode: (phone: string) =>
      this.client.post<APIResponse>('/auth/send-code', { phone }),

    login: (phone: string, code: string) =>
      this.client.post<APIResponse>('/auth/login', { phone, code }),

    me: () => this.client.get<APIResponse>('/auth/me')
  };

  // 会员相关
  membership = {
    purchase: (channel: string) =>
      this.client.post<APIResponse>('/membership/purchase', { channel }),

    status: () => this.client.get<APIResponse>('/membership/status')
  };

  // 任务相关
  task = {
    create: (data: {
      type: string;
      inputImageUrl: string;
      params?: any;
    }) => this.client.post<APIResponse>('/task/create', data),

    get: (taskId: string) =>
      this.client.get<APIResponse>(`/task/${taskId}`),

    list: (params: { limit?: number; offset?: number; status?: string }) =>
      this.client.get<APIResponse>('/task/list', { params })
  };

  // 媒体相关
  media = {
    getSTS: (taskId: string) =>
      this.client.get<APIResponse>(`/media/sts?taskId=${taskId}`)
  };

  // 管理相关
  admin = {
    getUsers: (params: any) =>
      this.client.get<APIResponse>('/admin/users', { params }),

    getTasks: (params: any) =>
      this.client.get<APIResponse>('/admin/tasks', { params }),

    getFailedTasks: (params: any) =>
      this.client.get<APIResponse>('/admin/failed-tasks', { params })
  };
}

export const api = new APIClient();
export default api;
