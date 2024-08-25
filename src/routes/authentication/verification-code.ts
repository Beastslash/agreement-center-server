import { getCache, setCache } from "#utils/cache.js";
import BadRequestError from "#utils/errors/BadRequestError.js";
import EmailAddressNotAuthorizedError from "#utils/errors/EmailAddressNotAuthorizedError.js";
import MissingHeaderError from "#utils/errors/MissingHeaderError.js";
import getGitHubInstallationAccessToken from "#utils/getGitHubInstallationAccessToken.js";
import { Router } from "express";
import { createTransport } from "nodemailer";

const router = Router();

router.post("/", async (request, response) => {

  console.log("A user requested the server for a new verification code.");

  try {

    // Enforce rate limits.

    // Ensure the selected email is a verified email.
    const emailAddress = request.headers["email-address"];
    if (typeof(emailAddress) !== "string") throw new BadRequestError("email_address needs to be a string.");

    const githubInstallationAccessToken = await getGitHubInstallationAccessToken();
    const { GITHUB_REPOSITORY_NAME, GITHUB_REPOSITORY_OWNER_NAME } = process.env;

    const indexInfoResponse = await fetch(`https://api.github.com/repos/${GITHUB_REPOSITORY_OWNER_NAME}/${GITHUB_REPOSITORY_NAME}/contents/index`, {
      headers: {
        authorization: `Bearer ${githubInstallationAccessToken}`, 
        "user-agent": "Agreement-Center", 
        accept: "application/json"
      }
    });

    const indexInfoResponseJSON = await indexInfoResponse.json() as {name: string}[];

    const isAuthorizedEmail = indexInfoResponseJSON.some(({name}) => name === `${emailAddress}.json`);
    if (!isAuthorizedEmail) throw new EmailAddressNotAuthorizedError(emailAddress);

    // Send a verification code to the selected email.
    console.log("\x1b[34mSending a verification code to the user's selected email address...\x1b[0m");
    const { SMTP_SERVER, SMTP_PORT, SMTP_USERNAME, SMTP_PASSWORD } = process.env;
    if (!(SMTP_SERVER && SMTP_PORT && SMTP_USERNAME && SMTP_PASSWORD)) throw new Error("An SMTP environment variable is missing.");

    const transporter = createTransport({
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
      to: emailAddress,
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

    console.log(`\x1b[32mSuccessfully sent an email to the user.\x1b[0m`);

    setCache("verificationInfo", {
      ...getCache("verificationInfo"),
      [emailAddress]: {
        expireTime: new Date(new Date().getTime() + 15 * 60000).getTime(),
        verificationCode
      }
    });

    response.status(201).json({success: true});

  } catch (error: unknown) {

    if (error instanceof MissingHeaderError || error instanceof BadRequestError) {

      console.log(`\x1b[33mA user's request to create an verification code failed: ${error.message}\x1b[0m`);

      response.status(error.statusCode).json({
        message: error.message
      });

    } else if (error instanceof EmailAddressNotAuthorizedError) {

      console.log(`\x1b[33mA user's request to create a verification code has been ignored due to providing an unauthorized email address.\x1b[0m`);

      response.status(201).json({success: true});

    } else {

      if (error instanceof Error) {

        console.error(`\x1b[31mAn unknown error occurred:\n${error.stack}\x1b[0m`);

      }

      response.status(500).json({
        message: "Internal server error."
      });

    }

  }

});

export default router;