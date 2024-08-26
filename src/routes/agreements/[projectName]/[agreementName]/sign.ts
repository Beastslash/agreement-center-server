import { Request, Router } from "express";
import ForbiddenError from "#utils/errors/ForbiddenError.js";
import InputNotFoundAtIndexError from "#utils/errors/InputNotFoundAtIndexError.js";
import BadRequestError from "#utils/errors/BadRequestError.js";
import getAgreementEvents from "#utils/getAgreementEvents.js";
import crypto from "crypto-js";
import updateAgreementEvents from "#utils/updateAgreementEvents.js";
import AgreementNotFoundError from "#utils/errors/AgreementNotFoundError.js";
import MissingQueryError from "#utils/errors/MissingQueryError.js";
import { AgreementNameRequestParameters } from "../[agreementName].js";

const router = Router({
  mergeParams: true
});

router.put("/", async (request: Request<AgreementNameRequestParameters>, response) => {

  try {

    // Verify that there's a view and receive event.
    const { GITHUB_REPOSITORY_NAME, GITHUB_REPOSITORY_OWNER_NAME } = process.env;
    const githubRepositoryPath = `${GITHUB_REPOSITORY_OWNER_NAME}/${GITHUB_REPOSITORY_NAME}`;
    const { githubInstallationAccessToken, emailAddress } = response.locals;
    const { projectName, agreementName } = request.params;
    const agreementPath = `${projectName}/${agreementName}`;
    const headers = {
      Authorization: `Bearer ${githubInstallationAccessToken}`, 
      "user-agent": "Agreement-Center", 
      accept: "application/json"
    };
    const { sha: eventsSHA, events } = await getAgreementEvents(headers, githubRepositoryPath, agreementPath);
    
    const personalEvents = events[emailAddress];
    if (!(personalEvents && personalEvents.receive && personalEvents.view)) throw new BadRequestError("You need to receive and view this agreement first.");
    if (personalEvents.sign && personalEvents.sign.timestamp) throw new ForbiddenError("You already signed this agreement, so you can't sign it again.");

    // Update the input values
    const agreementInputsResponse = await fetch(`https://api.github.com/repos/${githubRepositoryPath}/contents/documents/${agreementPath}/inputs.json`, {headers});
    if (!agreementInputsResponse.ok) throw new Error("Something bad happened with GitHub.");

    const { content: inputsBase64, sha: inputsSHA } = await agreementInputsResponse.json();
    const agreementInputs = JSON.parse(atob(inputsBase64));

    const newInputPairs = request.body;
    if (!(newInputPairs instanceof Object)) throw new BadRequestError("Inputs property is not an object.");

    for (const index of Object.keys(newInputPairs)) {

      const indexInt = parseInt(index, 10);
      const value = newInputPairs[indexInt];
      if (!Object.prototype.hasOwnProperty.call(agreementInputs, indexInt)) throw new InputNotFoundAtIndexError(indexInt);

      const doesUserHavePermissionToChangeInput = agreementInputs[indexInt].ownerID === emailAddress;
      if (!doesUserHavePermissionToChangeInput) throw new ForbiddenError(`User doesn't have permission to change input ${indexInt}.`);

      agreementInputs[indexInt].value = value;

    }
  
    // Update the inputs.
    const inputUpdateResponse = await fetch(`https://api.github.com/repos/${githubRepositoryPath}/contents/documents/${agreementPath}/inputs.json`, {
      headers,
      method: "PUT",
      body: JSON.stringify({
        message: `Add inputs from ${emailAddress}`,
        sha: inputsSHA,
        content: btoa(JSON.stringify(agreementInputs, null, 2))
      })
    });
  
    if (!inputUpdateResponse.ok) {
  
      throw new Error(await inputUpdateResponse.text());
  
    }

    console.log(`\x1b[32mSuccessfully updated a user's agreement inputs.\x1b[0m`);

    // Update the events.
    const signEvent = {
      timestamp: new Date().getTime(),
      encryptedIPAddress: request.ip ? crypto.AES.encrypt(request.ip, process.env.ENCRYPTION_PASSWORD as string).toString() : null
    };

    await updateAgreementEvents(headers, eventsSHA, githubRepositoryPath, agreementPath, {
      ...events,
      [emailAddress]: {
        ...events[emailAddress],
        sign: signEvent
      }
    });

    console.log(`\x1b[32mSuccessfully updated a user's agreement events.\x1b[0m`);

    response.json({success: true});

  } catch (error: unknown) {

    if (error instanceof BadRequestError || error instanceof ForbiddenError || error instanceof InputNotFoundAtIndexError || error instanceof AgreementNotFoundError || error instanceof MissingQueryError) {

      console.log(`\x1b[33mA user's request to update agreement input values failed: ${error.message}\x1b[0m`);
      
      response.status(error.statusCode).json({
        message: error.message
      });

    } else {

      console.error(error);

      response.status(500).json({
        message: "Internal server error."
      });

    }

  }

});

export default router;