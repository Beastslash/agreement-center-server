const cache = {
  verificationInfo: {} as {[key: string]: {verificationCode: string; expireTime: number}},
  emailAddresses: {} as {[accessTokens: string]: string}
};
export const setCache = (key: keyof typeof cache, value: any) => cache[key] = value;

export function getCache(key: "verificationInfo"): (typeof cache)["verificationInfo"];
export function getCache(key: "emailAddresses"): (typeof cache)["emailAddresses"];
export function getCache(key: keyof typeof cache) {

  return cache[key];

}