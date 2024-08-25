export type Event = {
  timestamp: number;
  encryptedIPAddress: string | null;
}

export type Events = {
  [key: string]: {
    receive?: Event;
    view?: Event;
    sign?: Event;
    void?: Event;
  }
};