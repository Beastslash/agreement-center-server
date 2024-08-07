import BadRequestError from "./BadRequestError.js";

export default class MissingHeaderError extends BadRequestError {

  constructor(requiredParameter: string) {

    super(`Your request is missing a header: ${requiredParameter}`);

  }

}