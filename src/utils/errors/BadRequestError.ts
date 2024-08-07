export default class BadRequestError extends Error {

  readonly statusCode = 400;

  constructor(message = "") {

    super(message);

  }

}