export default interface ParsedWebEvent {
  "http": {
    "headers": {
      "accept": string,
      "accept-encoding": string,
      "content-type": string,
      "user-agent": string,
      "x-forwarded-for": string,
      "x-forwarded-proto": string,
      "x-request-id": string,
      [headerName: string]: unknown
    },
    "method": string,
    "path": string
  };
  [key: string]: unknown
}