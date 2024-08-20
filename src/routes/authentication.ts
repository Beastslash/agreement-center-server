// This function gets a GitHub user access token (UAT) based on the callback code provided by GitHub.
// The UAT can be used for the server to authenticate the user when they view and update agreements.
// This UAT can be safely stored on the client, as there are no permissions.

import { getCache, setCache } from "#utils/cache.js";
import BadRequestError from "#utils/errors/BadRequestError.js";
import MissingHeaderError from "#utils/errors/MissingHeaderError.js";
import fetch from "#utils/fetch.js";
import getGitHubUserEmails from "#utils/getGitHubUserEmails.js";
import { Router } from "express";
import { createTransport as createSMTPTransport } from "nodemailer";

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

router.post("/verification-code", async (request, response) => {

  console.log("A user requested the server for a new verification code.");

  try {

    // Enforce rate limits.

    // Ensure the selected email is a verified email.
    const { email_address } = request.query;
    if (typeof(email_address) !== "string") throw new BadRequestError("email_address needs to be a string.");

    // Send a verification code to the selected email.
    const { SMTP_SERVER, SMTP_PORT, SMTP_USERNAME, SMTP_PASSWORD } = process.env;
    if (!(SMTP_SERVER && SMTP_PORT && SMTP_USERNAME && SMTP_PASSWORD)) throw new Error("An SMTP environment variable is missing.")

    const transporter = createSMTPTransport({
      host: SMTP_SERVER,
      port: parseInt(SMTP_PORT, 10),
      secure: false,
      auth: {
        user: SMTP_USERNAME,
        pass: SMTP_PASSWORD
      }
    });

    const verificationCode = Math.floor(Math.random() * 999999).toLocaleString("en-US", {
      minimumIntegerDigits: 6, 
      useGrouping: false
    });

    const { EMAIL_SENDER_NAME, EMAIL_SENDER_ADDRESS } = process.env;
    if (!(EMAIL_SENDER_NAME && EMAIL_SENDER_ADDRESS)) throw new Error("EMAIL_SENDER_NAME and EMAIL_SENDER_ADDRESS environment variables required.");

    await transporter.sendMail({
      to: email_address,
      from: {
        name: EMAIL_SENDER_NAME,
        address: EMAIL_SENDER_ADDRESS
      },
      subject: `Verification code [${verificationCode}]`,
      text: (
        "Hello!\n"
        + `\nYour verification code is: ${verificationCode}\n`
        + `This code will expire in 15 minutes.\n`
        + "\nYou're receiving this email because you're in the process of signing an electronic agreement. We want to prevent unauthorized access to your account by authenticating you.\n"
        + "\nBest regards,\n"
        + "Beastslash Agreements Team"
      )
    });

    setCache("verificationInfo", {
      ...getCache("verificationInfo"),
      [email_address]: {
        expireTime: new Date(new Date().getTime() + 15 * 60000).getTime(),
        verificationCode
      }
    });

    response.status(201).json({success: true});

  } catch (error: unknown) {

    if (error instanceof MissingHeaderError || error instanceof BadRequestError) {

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

router.get("/email-addresses", async (request, response) => {

  try {

    // Verify that we have a code.
    const emailAddressData = await getGitHubUserEmails(request);
    response.json(emailAddressData)

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

export default router;