import { Request, Router } from "express";
import crypto from "crypto-js";
import ForbiddenError from "#utils/errors/ForbiddenError.js";
import getAgreementEvents from "#utils/getAgreementEvents.js";
import AgreementNotFoundError from "#utils/errors/AgreementNotFoundError.js";
import updateAgreementEvents from "#utils/updateAgreementEvents.js";
import getFileContents from "#utils/getFileContents.js";
import MissingQueryError from "#utils/errors/MissingQueryError.js";
import { Event } from "#utils/classes/Event.js";
import signAgreementRoute from "./[agreementName]/sign.js";

const router = Router({
  mergeParams: true
});

export type AgreementNameRequestParameters = {
  projectName: string;
  agreementName: string;
}

router.get("/", async (request: Request<AgreementNameRequestParameters>, response) => {

  try {

    console.log("A user requested to get an agreement's text and inputs.");

    // Verify the user's verification code if they have one.
    const { mode } = request.query;
    let viewEvent: Event | null = null;
    if (mode === "sign") {

      if (!request.ip) throw new Error("request.ip is undefined.");

      viewEvent = {
        timestamp: new Date().getTime(),
        encryptedIPAddress: crypto.AES.encrypt(request.ip, process.env.ENCRYPTION_PASSWORD as string).toString()
      };

    }

    // Add the codes.
    const { projectName, agreementName } = request.params;
    const { githubInstallationAccessToken, emailAddress } = response.locals;
    const headers = {
      Authorization: `Bearer ${githubInstallationAccessToken}`, 
      "user-agent": "Agreement-Center", 
      accept: "application/vnd.github.raw+json"
    };
    const { GITHUB_REPOSITORY_NAME, GITHUB_REPOSITORY_OWNER_NAME } = process.env;
    const githubRepositoryPath = `${GITHUB_REPOSITORY_OWNER_NAME}/${GITHUB_REPOSITORY_NAME}`;
    
    const agreementPath = `${projectName}/${agreementName}`;

    console.log("\x1b[34mRetrieving account index from GitHub...\x1b[0m");
    const agreementIDsResponse = await fetch(`https://api.github.com/repos/${githubRepositoryPath}/contents/index/${emailAddress}.json`, {headers});
    const agreementIDs = await agreementIDsResponse.json();
  
    if (!agreementIDsResponse.ok || !(agreementIDs instanceof Array)) throw new Error("Malformed response received from GitHub.");
    
    const isAgreementPathInUserIndex = agreementIDs.includes(agreementPath);

    if (!isAgreementPathInUserIndex) throw new AgreementNotFoundError();
  
    // Add a viewing event.
    const { sha: eventsSHA, events } = await getAgreementEvents(headers, githubRepositoryPath, agreementPath);
    
    if (viewEvent) {

      const personalEvents = events[emailAddress];
      if (personalEvents.sign) throw new ForbiddenError("You already signed this agreement, so you can't sign it again.");

      await updateAgreementEvents(headers, eventsSHA, githubRepositoryPath, agreementPath, {
        ...events,
        [emailAddress]: {
          ...events[emailAddress],
          view: viewEvent
        }
      });

    }

    // Return the agreement, its inputs, and its permissions.
    console.log("\x1b[34mRetrieving agreement contents from GitHub...\x1b[0m");
    const agreementText = await (await getFileContents(headers, githubRepositoryPath, agreementPath, "README.md")).text();
    const agreementInputs = await (await getFileContents(headers, githubRepositoryPath, agreementPath, "inputs.json")).json();
    const agreementPermissions = await (await getFileContents(headers, githubRepositoryPath, agreementPath, "permissions.json")).json();

    response.setHeader("email-address", emailAddress);

    response.json({
      text: agreementText,
      inputs: agreementInputs,
      permissions: agreementPermissions
    });

    console.log(`\x1b[32mSuccessfully returned an agreement to a user.\x1b[0m`);

  } catch (error: unknown) {

    if (error instanceof ForbiddenError || error instanceof AgreementNotFoundError || error instanceof MissingQueryError) {

      console.log(`\x1b[33mA user's request to get an agreement's text and inputs failed: ${error.message}\x1b[0m`);

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

router.use("/sign", signAgreementRoute);

export default router;