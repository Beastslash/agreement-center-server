// This function returns a specific agreement from the repository.

import { Router } from "express";
import fetch from "#utils/fetch.js";
import jwt from "jsonwebtoken";
import MissingQueryError from "#utils/errors/MissingQueryError.js";
import AgreementNotFoundError from "#utils/errors/AgreementNotFoundError.js";
import MissingHeaderError from "#utils/errors/MissingHeaderError.js";
import ForbiddenError from "#utils/errors/ForbiddenError.js";
import InputNotFoundAtIndexError from "#utils/errors/InputNotFoundAtIndexError.js";
import BadRequestError from "#utils/errors/BadRequestError.js";
import {readFileSync} from "fs";
import openpgp from "openpgp";
import { getCache } from "#utils/cache.js";
import UnauthenticatedError from "#utils/errors/UnauthenticatedError.js";

const router = Router();

// Authenticate the user.
router.use(async (request, response, next) => {

  try {

    async function getInstallationAccessToken(): Promise<string> {

      const jsonWebToken = jwt.sign({iss: process.env.CLIENT_ID}, readFileSync("./security/github.pem"), {algorithm: "RS256", expiresIn: "5s"});
  
      const installations = await fetch({
        host: "api.github.com",
        path: `/app/installations`,
        headers: {
          Authorization: `Bearer ${jsonWebToken}`,
          "user-agent": "Agreement-Center",
          "accept": "application/json"
        },
        port: 443
      });

      if (!(installations instanceof Array)) {
    
        throw new Error("Malformed response received from GitHub.");
    
      }

      const githubAccountID = process.env.GITHUB_ACCOUNT_ID;
      if (!githubAccountID) throw new Error("GITHUB_ACCOUNT_ID needs to be defined in environment variables.");

      const installationID = installations.find((installation) => installation.account.id === parseInt(githubAccountID, 10))?.id;
      if (!installationID) throw new Error();

      const installationAccessToken = await fetch({
        host: "api.github.com",
        path: `/app/installations/${installationID}/access_tokens`,
        headers: {
          Authorization: `Bearer ${jsonWebToken}`,
          "user-agent": "Agreement-Center",
          "accept": "application/json"
        },
        method: "POST",
        port: 443
      });

      if (!(installationAccessToken instanceof Object) || !("token" in installationAccessToken) || typeof(installationAccessToken.token) !== "string") {
    
        throw new Error("Malformed response received from GitHub.");
    
      }

      return installationAccessToken.token;

    }

    const accessToken = request.headers["access-token"];
    if (typeof(accessToken) !== "string") throw new UnauthenticatedError();

    const emailAddress = getCache("emailAddresses")[accessToken];
    if (!emailAddress) throw new UnauthenticatedError();

    response.locals.emailAddress = emailAddress;
    response.locals.githubInstallationAccessToken = await getInstallationAccessToken();

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

// Verify paths.
router.use(async (request, response, next) => {

  try {

    // Verify that the agreement is in the user's index list.
    const agreementPath = request.query.agreement_path;
    if (typeof(agreementPath) !== "string") {

      throw new MissingQueryError("agreement_path");

    }
    response.locals.agreementPath = agreementPath;

    const githubRepositoryPath = process.env.REPOSITORY;
    if (!githubRepositoryPath) {

      throw new Error("REPOSITORY environment variable is required.");

    }

    next();

  } catch (err) {


  }

});

// Get agreement text and inputs.
router.get("/", async (request, response) => {

  try {

    console.log("A user requested to get an agreement's text and inputs.")

    // Verify the user's verification code if they have one.
    type Event = {
      timestamp: number;
      ipAddress: string;
    }

    const { mode } = request.query;
    let viewEvent: Event | null = null;
    if (mode === "sign") {

      if (!request.ip) throw new Error("request.ip is undefined.");

      viewEvent = {
        timestamp: new Date().getTime(),
        ipAddress: request.ip
      }

    }

    // Add the codes.
    const { githubInstallationAccessToken, githubUserID, agreementPath } = response.locals;
    const defaultHeaders = {
      Authorization: `Bearer ${githubInstallationAccessToken}`, 
      "user-agent": "Agreement-Center", 
      accept: "application/vnd.github.v3.raw"
    }
    const getFileContents = async (path: string, shouldGetSHA?: boolean) => await fetch({
      host: "api.github.com", 
      headers: {
        ...defaultHeaders,
        accept: shouldGetSHA ? "application/json" : defaultHeaders.accept
      },
      port: 443, 
      path
    });

    const { REPOSITORY: githubRepositoryPath } = process.env;
    async function getUserAgreementIDs(): Promise<string[]> {

      const agreementIDsEncoded = await getFileContents(`/repos/${githubRepositoryPath}/contents/index/${githubUserID}.json`) as string;
      return JSON.parse(agreementIDsEncoded);

    }

    if (!(await getUserAgreementIDs()).includes(agreementPath)) throw new AgreementNotFoundError();
  
    // Add a viewing event.
    type Events = {
      [key: string]: {
        view?: Event;
        sign?: Event;
        void?: Event;
      }
    };
    const agreementEventsInfo = await getFileContents(`/repos/${githubRepositoryPath}/contents/documents/${agreementPath}/events.json`, true) as {sha: string; content: string};
    const agreementEvents = JSON.parse(atob(agreementEventsInfo.content)) as Events;
    
    if (viewEvent) {

      await fetch({
        host: "api.github.com", 
        port: 443,
        headers: defaultHeaders,
        path: `/repos/${githubRepositoryPath}/contents/documents/${agreementPath}/events.json`,
        method: "PUT",
      }, {
        body: JSON.stringify({
          message: "Add view event",
          sha: agreementEventsInfo.sha,
          content: {
            ...agreementEvents,
            [githubUserID]: {
              ...agreementEvents[githubUserID],
              view: viewEvent
            }
          }
        })
      })

    }

    // Return the agreement, its inputs, and its permissions.
    const agreementText = await getFileContents(`/repos/${process.env.REPOSITORY}/contents/documents/${agreementPath}/README.md`);
    const agreementInputs = await getFileContents(`/repos/${process.env.REPOSITORY}/contents/documents/${agreementPath}/inputs.json`);
    const agreementPermissions = await getFileContents(`/repos/${process.env.REPOSITORY}/contents/documents/${agreementPath}/permissions.json`);

    return response.json({
      text: agreementText,
      inputs: agreementInputs,
      permissions: agreementPermissions,
      githubUserID: githubUserID
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

router.put("/inputs", async (request, response) => {

  try {

    // Update the input values
    const githubRepositoryPath = process.env.REPOSITORY;
    const { githubInstallationAccessToken, agreementPath, emailAddress } = response.locals;
    const headers = {
      Authorization: `Bearer ${githubInstallationAccessToken}`, 
      "user-agent": "Agreement-Center", 
      accept: "application/vnd.github.v3.raw"
    };
    const agreementInputsResponse = await fetch({
      host: "api.github.com",
      headers,
      path: `/repos/${githubRepositoryPath}/contents/documents/${agreementPath}/inputs.json`
    });

    const contentHasProblem = typeof(agreementInputsResponse) !== "string";
    if (contentHasProblem) throw new Error("Content received from GitHub wasn't a string.");

    const agreementInputs = JSON.parse(agreementInputsResponse);
    const newInputPairs = request.body;
    if (!(newInputPairs instanceof Object)) throw new BadRequestError("Inputs property is not an object.");

    for (const index of Object.keys(newInputPairs)) {

      const indexInt = parseInt(index, 10);
      const value = newInputPairs[indexInt];
      if (!agreementInputs.hasOwnProperty(indexInt)) throw new InputNotFoundAtIndexError(indexInt);

      const doesUserHavePermissionToChangeInput = agreementInputs[indexInt].ownerEmailAddress === emailAddress;
      if (!doesUserHavePermissionToChangeInput) throw new ForbiddenError(`User doesn't have permission to change input ${indexInt}.`);

      agreementInputs[indexInt].value = value;

    }
  
    // Push the signed commit to the repository.
    const armoredSignature = request.headers["armored-signature"];
    if (!armoredSignature || typeof(armoredSignature) !== "string") throw new MissingHeaderError("armored-signature");
    const signature = await openpgp.readSignature({armoredSignature});

    // const signedCommit = await fetch({
    //   host: "api.github.com",
    //   headers,
    //   method: "POST",
    //   path: `/repos/${githubRepositoryPath}/git/commits`,
    // }, {
    //   body: JSON.stringify({
    //     message: `Update user ${githubUserID}'s inputs`,
    //     tree: codeInfo[code].newTreeSHA,
    //     parents: [codeInfo.commitSHA],
    //     author,
    //     committer: {
    //       name: process.env.GIT_COMMIT_NAME,
    //       email: process.env.GIT_COMMIT_EMAIL_ADDRESS
    //     },
    //     signature
    //   }, null, 2)
    // }) as {sha: string, message: string};

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