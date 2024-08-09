// This function gets a GitHub user access token (UAT) based on the callback code provided by GitHub.
// The UAT can be used for the server to authenticate the user when they view and update agreements.
// This UAT can be safely stored on the client, as there are no permissions.

import BadRequestError from "#utils/errors/BadRequestError.js";
import fetch from "#utils/fetch.js";
import { Router } from "express";

const router = Router();



router.get("/", async (request, response) => {

  try {

    // Verify that we have a code.
    const {code: githubAuthenticationCode, refresh_token: githubRefreshToken } = request.query;
    if (!githubAuthenticationCode && !githubRefreshToken) {

      throw new BadRequestError("GitHub authentication code or refresh token required.");

    }

    // Get a user access token from the temporary code.
    const userAccessTokenResponse = await fetch({
      host: "github.com",
      path: `/login/oauth/access_token?client_id=${process.env.CLIENT_ID}&client_secret=${process.env.CLIENT_SECRET}&${githubRefreshToken ? `refresh_token=${githubRefreshToken}` : `code=${githubAuthenticationCode}`}`,
      port: 443,
      headers: {
        Accept: "application/json"
      },
      method: "POST"
    });

    console.log(userAccessTokenResponse);

    if (!(userAccessTokenResponse instanceof Object)) {

      throw new Error("Malformed GitHub response.");

    }

    response.status(userAccessTokenResponse.hasOwnProperty("access_token") ? 200 : 400).json(userAccessTokenResponse)

  } catch (error: unknown) {

    if (error instanceof BadRequestError) {

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