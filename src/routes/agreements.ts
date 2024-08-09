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
import { generateKey } from "openpgp";
import crypto from "crypto";

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
    
    async function getGitHubUserEmail() {

      const githubUserAccessToken = request.headers["github-user-access-token"];
      if (typeof(githubUserAccessToken) !== "string") {
    
        throw new MissingHeaderError("github-user-access-token");
    
      }
    
      const userResponse = await fetch({
        host: "api.github.com",
        path: `/user/emails`,
        headers: {
          Authorization: `Bearer ${githubUserAccessToken}`,
          "user-agent": "Agreement-Center"
        },
        port: 443
      });
    
      if (!(userResponse instanceof Array)) {
    
        throw new Error("Malformed response received from GitHub.");
    
      }

      return userResponse[0].email;

    }

    response.locals.githubUserAccessToken = request.headers["github-user-access-token"];
    response.locals.githubEmail = await getGitHubUserEmail();
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
      permissions: agreementPermissionsResponse,
      githubUserID: githubUserID
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
    const { githubInstallationAccessToken, agreementPath, githubUserID, githubUserAccessToken } = response.locals;
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

      const doesUserHavePermissionToChangeInput = agreementInputs[indexInt].ownerID === githubUserID;
      if (!doesUserHavePermissionToChangeInput) throw new ForbiddenError(`User doesn't have permission to change input ${indexInt}.`);

      agreementInputs[indexInt].value = value;

    }

    // 
    const previousCommitSHA = crypto.createHash("sha1").update(`blob ${agreementInputsResponse.length}\0${agreementInputsResponse}`).digest("hex");
    const commitInfo = await fetch({
      host: "api.github.com",
      headers,
      method: "GET",
      path: `/repos/${githubRepositoryPath}/git/commits/${previousCommitSHA}`,
    });

    if (!(commitInfo instanceof Object) || !("tree" in commitInfo) || !(commitInfo.tree instanceof Object) || !("sha" in commitInfo.tree)) throw new Error("Malformed GitHub response.");

    const treeSHA = commitInfo.tree.sha;

    const jsonContent = JSON.stringify(agreementInputs, null, 2);
    const newTreeInfo = await fetch({
      host: "api.github.com",
      headers,
      method: "POST",
      path: `/repos/${githubRepositoryPath}/git/trees`,
    }, {
      body: JSON.stringify({
        tree: [{
          path: "inputs.json",
          mode: "100644",
          type: "blob",
          content: jsonContent
        }],
        base_tree: treeSHA
      })
    });

    if (!(newTreeInfo instanceof Object) || !("sha" in newTreeInfo)) throw new Error("Malformed GitHub response.");

    const newTreeSHA = newTreeInfo.sha;

    // Create a GPG key.
    const author = {
      name: `${githubUserID}`,
      email: response.locals.githubEmail
    };
    const { privateKey, publicKey } = await generateKey({
      type: "rsa",
      userIDs: [author],
      passphrase: process.env.GPG_PASSPHRASE
    });

    const userAuthorizationHeaders = {
      ...headers,
      Authorization: `Bearer ${githubUserAccessToken}`,
      accept: "application/vnd.github+json"
    };
    const gpgKeyInfo = await fetch({
      host: "api.github.com",
      headers: userAuthorizationHeaders,
      method: "POST",
      path: `/user/gpg_keys`,
    }, {
      body: JSON.stringify({
        name: "Agreement Center GPG key",
        armored_public_key: publicKey
      })
    });

    if (!(gpgKeyInfo instanceof Object) || !("id" in gpgKeyInfo)) throw new Error("Malformed GitHub response");

    const githubResponse = await fetch({
      host: "api.github.com",
      headers,
      method: "PUT",
      path: `/repos/${githubRepositoryPath}/git/commits`,
    }, {
      body: JSON.stringify({
        message: `Update user ${githubUserID}'s inputs`,
        tree: newTreeSHA,
        author
      }, null, 2)
    });

    // Delete the GPG key.
    await fetch({
      host: "api.github.com",
      headers: userAuthorizationHeaders,
      method: "DELETE",
      path: `/user/gpg_keys/${gpgKeyInfo.id}`,
    });

    response.json({success: true});

  } catch (error: unknown) {

    if (error instanceof BadRequestError || error instanceof ForbiddenError || error instanceof InputNotFoundAtIndexError || error instanceof AgreementNotFoundError || error instanceof MissingQueryError) {

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