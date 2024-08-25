const cache = {
  verificationInfo: {} as {[key: string]: {verificationCode: string; expireTime: number}},
  emailAddresses: {} as {[accessToken: string]: string}
};

export function setCache<CacheKey extends keyof typeof cache>(key: CacheKey, value: (typeof cache)[CacheKey]): void {
  
  cache[key] = value;

}

export function getCache<CacheKey extends keyof typeof cache>(key: CacheKey): (typeof cache)[CacheKey] {

  return cache[key];

}