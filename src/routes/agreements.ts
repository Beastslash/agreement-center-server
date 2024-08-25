// This function returns a specific agreement from the repository.

import { Router } from "express";
import MissingQueryError from "#utils/errors/MissingQueryError.js";
import AgreementNotFoundError from "#utils/errors/AgreementNotFoundError.js";
import MissingHeaderError from "#utils/errors/MissingHeaderError.js";
import { getCache } from "#utils/cache.js";
import UnauthenticatedError from "#utils/errors/UnauthenticatedError.js";
import getGitHubInstallationAccessToken from "#utils/getGitHubInstallationAccessToken.js";
import agreementNameRouter from "./agreements/[projectName]/[agreementName].js";

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

router.use("/:projectName/:agreementName", agreementNameRouter);

// List all agreements that the authorized user has access to
router.get("/", async (_, response) => {

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

            status = "Awaiting action from you";
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

export default router;