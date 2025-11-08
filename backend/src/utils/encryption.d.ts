declare const encryptionUtils: {
  encryptIdCard(idCard: string): string | null;
  decryptIdCard(encryptedIdCard: string): string | null;
  maskIdCard(idCard: string): string | null;
  decryptAndMaskIdCard(encryptedIdCard: string): string;
};

export default encryptionUtils;
