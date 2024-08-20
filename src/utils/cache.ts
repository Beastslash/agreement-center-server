const cache = {
  verificationInfo: {} as {[key: string]: {verificationCode: string; expireTime: number}}
};
export const setCache = (key: keyof typeof cache, value: any) => cache[key] = value;
export const getCache = (key: keyof typeof cache) => cache[key];