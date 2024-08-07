export default class AgreementNotFoundError extends Error {

  readonly statusCode = 404;

  constructor() {

    super("Agreement doesn't exist or this user doesn't have access to it.");

  }

}