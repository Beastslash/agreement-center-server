import ForbiddenError from "./ForbiddenError.js";

export default class EmailAddressNotAuthorizedError extends ForbiddenError {

  constructor(emailAddress: string) {

    super(`${emailAddress} is not an authorized email.`);

  }

}