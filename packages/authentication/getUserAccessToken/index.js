// This function gets a GitHub user access token (UAT) based on the callback code provided by GitHub.
// The UAT can be used for the server to authenticate the user when they view and update agreements.
// This UAT can be safely stored on the client, as there are no permissions.

import { request } from "../../../modules/request";

export async function main(event) {

  try {

    // Verify that we have a code.
    const githubAuthenticationCode = event.code;
    const githubRefreshToken = event.refresh_token;
    if (!githubAuthenticationCode && !githubRefreshToken) {

      return {
        statusCode: 400,
        body: {
          message: "GitHub authentication code or refresh token required."
        }
      };

    }

    // Get a user access token from the temporary code.
    const userAccessTokenResponse = await request({
      host: "github.com",
      path: `/login/oauth/access_token?client_id=${process.env.CLIENT_ID}&client_secret=${process.env.CLIENT_SECRET}&${githubRefreshToken ? `refresh_token=${githubRefreshToken}` : `code=${githubAuthenticationCode}`}`,
      port: 443,
      method: "POST"
    });

    // Return the user access token.
    return {body: userAccessTokenResponse}

  } catch (err) {

    console.error(err);

    return {
      statusCode: 500,
      body: {
        message: "Internal server error."
      }
    }

  }

}
