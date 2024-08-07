export default class ServerError extends Error {

  statusCode: number;

  constructor(statusCode: number, message: string) {

    super(message);
    this.statusCode = statusCode;

  }

}