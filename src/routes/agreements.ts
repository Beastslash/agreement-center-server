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

const router = Router();

// Authenticate the user.
router.use(async (request, response, next) => {

  try {

    async function getGitHubUserID() {

      const githubUserAccessToken = request.headers["github-user-access-token"];
      if (typeof(githubUserAccessToken) !== "string") {
    
        throw new MissingHeaderError("github-user-access-token");
    
      }
    
      const userResponse = await fetch({
        host: "api.github.com",
        path: `/user`,
        headers: {
          Authorization: `Bearer ${githubUserAccessToken}`,
          "user-agent": "Agreement-Center"
        },
        port: 443
      });
    
      if (!(userResponse instanceof Object) || !("id" in userResponse) || typeof(userResponse.id) !== "number") {
    
        throw new Error("Malformed response received from GitHub.");
    
      }

      return userResponse.id;

    }

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
    
    response.locals.githubUserID = await getGitHubUserID();
    response.locals.githubInstallationAccessToken = await getInstallationAccessToken();

    next();

  } catch (error: unknown) {

    if (error instanceof MissingHeaderError) {

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

    const { githubInstallationAccessToken, githubUserID, agreementPath } = response.locals;
    const githubRepositoryPath = process.env.REPOSITORY;
    const headers = {Authorization: `Bearer ${githubInstallationAccessToken}`, "user-agent": "Agreement-Center", accept: "application/vnd.github.v3.raw"};
    async function getUserAgreementIDs(): Promise<string[]> {

      const agreementIDResponse = await fetch({
        host: "api.github.com",
        path: `/repos/${githubRepositoryPath}/contents/index/${githubUserID}.json`,
        headers
      });

      return JSON.parse(agreementIDResponse as string);

    }

    if (!(await getUserAgreementIDs()).includes(agreementPath)) {

      throw new AgreementNotFoundError();

    }
  
    // Return the agreement, its inputs, and its permisssions.
    const agreementTextResponse = await fetch({
      host: "api.github.com",
      headers,
      path: `/repos/${process.env.REPOSITORY}/contents/documents/${agreementPath}/README.md`
    });
    const agreementInputsResponse = await fetch({
      host: "api.github.com",
      headers,
      path: `/repos/${process.env.REPOSITORY}/contents/documents/${agreementPath}/inputs.json`
    });
    const agreementPermissionsResponse = await fetch({
      host: "api.github.com",
      headers,
      path: `/repos/${process.env.REPOSITORY}/contents/documents/${agreementPath}/permissions.json`
    });

    return response.json({
      text: agreementTextResponse,
      inputs: agreementInputsResponse,
      permissions: agreementPermissionsResponse
    });

  } catch (error: unknown) {

    if (error instanceof AgreementNotFoundError || error instanceof MissingQueryError) {

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
    const { githubAppAccessToken, agreementPath, githubUserID } = response.locals;
    const headers = {Authorization: `Bearer ${githubAppAccessToken}`};
    const agreementInputsResponse = await fetch({
      host: "api.github.com",
      headers,
      path: `/repos/${githubRepositoryPath}/contents/${agreementPath}/inputs.json`
    });

    const contentHasProblem = !(agreementInputsResponse instanceof Object) || !("content" in agreementInputsResponse) || typeof(agreementInputsResponse.content) !== "string";
    if (contentHasProblem) throw new Error("Content received from GitHub wasn't a string.");

    const agreementInputs = JSON.parse(agreementInputsResponse.content as string);
    const newInputPairs = request.body;
    if (!(newInputPairs instanceof Array)) throw new BadRequestError("Inputs property is not an array.");

    for (let i = 0; newInputPairs.length > i; i++) {

      const { index, value } = newInputPairs[i];
      if (!agreementInputs.hasOwnProperty(index)) throw new InputNotFoundAtIndexError(index);

      const doesUserHavePermissionToChangeInput = agreementInputs[index].ownerID === githubUserID;
      if (!doesUserHavePermissionToChangeInput) throw new ForbiddenError(`User doesn't have permission to change input ${index}.`);

      agreementInputs[index].value = value;

    }

    await fetch({
      host: "api.github.com",
      headers,
      method: "PUT",
      path: `/repos/${githubRepositoryPath}/contents/${agreementPath}/inputs.json`,
    }, {
      body: JSON.stringify({
        message: `Update user ${githubUserID}'s inputs.`,
        content: JSON.stringify(agreementInputs)
      }, null, 2)
    });

    response.sendStatus(200);

  } catch (error: unknown) {

    if (error instanceof BadRequestError || error instanceof InputNotFoundAtIndexError || error instanceof AgreementNotFoundError || error instanceof MissingQueryError) {

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