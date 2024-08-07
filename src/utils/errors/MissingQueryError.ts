import BadRequestError from "./BadRequestError.js";

export default class MissingQueryError extends BadRequestError {

  constructor(requiredParameter: string) {

    super(`Your request is missing a query parameter: ${requiredParameter}`);

  }

}