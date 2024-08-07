export default class InputNotFoundAtIndexError extends Error {

  readonly statusCode = 404;

  constructor(index: number) {

    super(`Input index ${index} doesn't exist.`);

  }

}