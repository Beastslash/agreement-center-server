// This function returns a specific agreement from the repository.

import { Router } from "express";
import MissingQueryError from "#utils/errors/MissingQueryError.js";
import AgreementNotFoundError from "#utils/errors/AgreementNotFoundError.js";
import MissingHeaderError from "#utils/errors/MissingHeaderError.js";
import ForbiddenError from "#utils/errors/ForbiddenError.js";
import InputNotFoundAtIndexError from "#utils/errors/InputNotFoundAtIndexError.js";
import BadRequestError from "#utils/errors/BadRequestError.js";
import { getCache } from "#utils/cache.js";
import UnauthenticatedError from "#utils/errors/UnauthenticatedError.js";
import getGitHubInstallationAccessToken from "#utils/getGitHubInstallationAccessToken.js";
import crypto from "crypto-js";

const router = Router();

// Authenticate the user.
router.use(async (request, response, next) => {

  try {

    const accessToken = request.headers["access-token"];
    if (typeof(accessToken) !== "string") throw new UnauthenticatedError();

    const emailAddress = getCache("emailAddresses")[accessToken];
    if (!emailAddress) throw new UnauthenticatedError();

    response.locals.emailAddress = emailAddress;
    response.locals.githubInstallationAccessToken = await getGitHubInstallationAccessToken();

    next();

  } catch (error: unknown) {

    if (error instanceof MissingHeaderError || error instanceof UnauthenticatedError) {

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


type Event = {
  timestamp: number;
  encryptedIPAddress: string | null;
}

type Events = {
  [key: string]: {
    receive?: Event;
    view?: Event;
    sign?: Event;
    void?: Event;
  }
};

async function getFileContents(headers: {[key: string]: string}, githubRepositoryPath: string, agreementPath: string, fileName: string) {
      
  const response = await fetch(`https://api.github.com/repos/${githubRepositoryPath}/contents/documents/${agreementPath}/${fileName}`, {headers});
  return response;

}

async function getAgreementEvents(headers: any, githubRepositoryPath: string, agreementPath: string) {

  const { sha, content } = await (await getFileContents({...headers, accept: "application/json"}, githubRepositoryPath, agreementPath, "events.json")).json() as {sha: string; content: string};
  const agreementEvents = JSON.parse(atob(content)) as Events;

  return {
    sha,
    events: agreementEvents
  }

}

async function isAgreementPathInUserIndex(headers: any, githubRepositoryPath: string, emailAddress: string, agreementPath: string): Promise<boolean> {
  
  const agreementIDsResponse = await fetch(`https://api.github.com/repos/${githubRepositoryPath}/contents/index/${emailAddress}.json`, {headers});
  const agreementIDs = await agreementIDsResponse.json();

  if (!agreementIDsResponse.ok || !(agreementIDs instanceof Array)) throw new Error("Malformed response received from GitHub.");

  return agreementIDs.includes(agreementPath);

}

// List all agreements that the authorized user has access to
router.get("/", async (request, response) => {

  try {

    console.log("A user requested a list of their agreements.");

    // Get the agreements from GitHub.
    const { githubInstallationAccessToken, emailAddress } = response.locals;
    const { GITHUB_REPOSITORY_OWNER_NAME, GITHUB_REPOSITORY_NAME } = process.env;
    const headers = {
      authorization: `Bearer ${githubInstallationAccessToken}`, 
      "user-agent": "Agreement-Center", 
      accept: "application/vnd.github.raw+json"
    };
    const indexResponse = await fetch(`https://api.github.com/repos/${GITHUB_REPOSITORY_OWNER_NAME}/${GITHUB_REPOSITORY_NAME}/contents/index/${emailAddress}.json`, {headers});

    if (!indexResponse.ok) throw new Error();
    
    const documentPathList = await indexResponse.json();
    const agreements: {
      path: string;
      name: string;
      status: "Completed" | "Awaiting action from you" | "Awaiting action from others" | "Terminated" | "Partially terminated"
    }[] = [];
    for (const documentPath of documentPathList) {

      // Verify that the user has permission to this document.
      const permissionsResponse = await fetch(`https://api.github.com/repos/${GITHUB_REPOSITORY_OWNER_NAME}/${GITHUB_REPOSITORY_NAME}/contents/documents/${documentPath}/permissions.json`, {headers});
      if (!permissionsResponse.ok) throw new Error("Internal server error from GitHub.");

      const { editorIDs, reviewerIDs } = await permissionsResponse.json() as {viewerIDs: string[]; editorIDs: string[]; reviewerIDs: string[]};
      if (!reviewerIDs.includes(emailAddress) && !editorIDs.includes(emailAddress)) continue;

      // Get the status of the document.
      const eventsResponse = await fetch(`https://api.github.com/repos/${GITHUB_REPOSITORY_OWNER_NAME}/${GITHUB_REPOSITORY_NAME}/contents/documents/${documentPath}/events.json`, {headers});
      if (!eventsResponse.ok) throw new Error("Internal server error from GitHub.");

      let status: (typeof agreements)[number]["status"] = "Completed";
      const eventsResponseJSON = await eventsResponse.json();
      const partyEmailAddresses = Object.keys(eventsResponseJSON);
      for (const partyEmailAddress of partyEmailAddresses) {

        if (!eventsResponseJSON[partyEmailAddress].sign) {

          if (partyEmailAddress === emailAddress) {

            status = "Awaiting action from you"
            break;

          } else {

            status = "Awaiting action from others";

          }

        }

      }

      agreements.push({
        path: documentPath,
        name: documentPath.slice(documentPath.lastIndexOf("/") + 1),
        status
      });

    }

    response.json(agreements);

    console.log(`\x1b[32mSuccessfully returned a user's agreements.\x1b[0m`);

  } catch (error) {

    if (error instanceof AgreementNotFoundError || error instanceof MissingQueryError) {

      console.log(`\x1b[33mA user's request to list their agreements failed: ${error.message}\x1b[0m`);

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

async function updateAgreementEvents(headers: any, eventsSHA: string, githubRepositoryPath: string, agreementPath: string, newEvents: {[emailAddress: string]: Events}) {

  const response = await fetch(`https://api.github.com/repos/${githubRepositoryPath}/contents/documents/${agreementPath}/events.json`, {
    headers,
    method: "PUT",
    body: JSON.stringify({
      message: "Update events",
      sha: eventsSHA,
      content: btoa(JSON.stringify(newEvents, null, 2))
    })
  });

  if (!response.ok) {

    throw new Error(await response.json());

  }

}

// Get agreement text and inputs.
// Upserts a view event if ?mode=sign.
router.get("/:projectName/:agreementName", async (request, response) => {

  try {

    console.log("A user requested to get an agreement's text and inputs.")

    // Verify the user's verification code if they have one.
    const { mode } = request.query;
    let viewEvent: Event | null = null;
    if (mode === "sign") {

      if (!request.ip) throw new Error("request.ip is undefined.");

      viewEvent = {
        timestamp: new Date().getTime(),
        encryptedIPAddress: crypto.AES.encrypt(request.ip, process.env.ENCRYPTION_PASSWORD as string).toString()
      }

    }

    // Add the codes.
    const { projectName, agreementName } = request.params;
    const { githubInstallationAccessToken, emailAddress } = response.locals;
    const headers = {
      Authorization: `Bearer ${githubInstallationAccessToken}`, 
      "user-agent": "Agreement-Center", 
      accept: "application/vnd.github.raw+json"
    }
    const { GITHUB_REPOSITORY_NAME, GITHUB_REPOSITORY_OWNER_NAME } = process.env;
    const githubRepositoryPath = `${GITHUB_REPOSITORY_OWNER_NAME}/${GITHUB_REPOSITORY_NAME}`;
    

    const agreementPath = `${projectName}/${agreementName}`;
    if (!await isAgreementPathInUserIndex(headers, githubRepositoryPath, emailAddress, agreementPath)) throw new AgreementNotFoundError();
  
    // Add a viewing event.
    const { sha: eventsSHA, events } = await getAgreementEvents(headers, githubRepositoryPath, agreementPath);
    
    if (viewEvent) {

      await updateAgreementEvents(headers, eventsSHA, githubRepositoryPath, agreementPath, {
        ...events,
        [emailAddress]: {
          ...events[emailAddress],
          view: viewEvent
        }
      });

    }

    // Return the agreement, its inputs, and its permissions.
    const agreementText = await (await getFileContents(headers, githubRepositoryPath, agreementPath, "README.md")).text();
    const agreementInputs = await (await getFileContents(headers, githubRepositoryPath, agreementPath, "inputs.json")).json();
    const agreementPermissions = await (await getFileContents(headers, githubRepositoryPath, agreementPath, "permissions.json")).json();

    response.setHeader("email-address", emailAddress);

    return response.json({
      text: agreementText,
      inputs: agreementInputs,
      permissions: agreementPermissions
    });

  } catch (error: unknown) {

    if (error instanceof AgreementNotFoundError || error instanceof MissingQueryError) {

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

router.put("/:projectName/:agreementName/sign", async (request, response) => {

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
      if (!agreementInputs.hasOwnProperty(indexInt)) throw new InputNotFoundAtIndexError(indexInt);

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