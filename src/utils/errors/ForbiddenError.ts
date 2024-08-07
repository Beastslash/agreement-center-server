export default class ForbiddenError extends Error {

  readonly statusCode = 403;

  constructor(message = "") {

    super(message);

  }

}