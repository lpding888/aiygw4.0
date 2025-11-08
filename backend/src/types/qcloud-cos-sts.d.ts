declare module 'qcloud-cos-sts' {
  interface CredentialOptions {
    secretId: string;
    secretKey: string;
    durationSeconds?: number;
    policy?: Record<string, unknown>;
    proxy?: string;
  }

  interface CredentialResult {
    expiredTime: number;
    startTime: number;
    credentials: {
      tmpSecretId: string;
      tmpSecretKey: string;
      sessionToken: string;
    };
  }

  interface STSStatic {
    getCredential(
      options: CredentialOptions,
      callback: (err: Error | null, credential: CredentialResult) => void
    ): void;
  }

  const STS: STSStatic;
  export = STS;
}
