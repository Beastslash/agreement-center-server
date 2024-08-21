export default class UnauthenticatedError extends Error {

  readonly statusCode = 401;

  constructor(message = "Your access token is undefined or incorrect.") {

    super(message);

  }

}