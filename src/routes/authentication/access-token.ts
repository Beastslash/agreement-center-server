import { getCache, setCache } from "#utils/cache.js";
import BadRequestError from "#utils/errors/BadRequestError.js";
import MissingHeaderError from "#utils/errors/MissingHeaderError.js";
import { randomBytes } from "crypto";
import { Router } from "express";

const router = Router();

router.post("/", async (request, response) => {

  console.log("A user requested the server to create an access token.");

  try {

    // Confirm the user's verification code.
    const emailAddress = request.headers["email-address"];
    if (typeof(emailAddress) !== "string") throw new MissingHeaderError("email-address");

    const verificationCode = request.headers["verification-code"];
    if (typeof(verificationCode) !== "string") throw new MissingHeaderError("verification-code");

    const verificationInfo = getCache("verificationInfo");
    const correctVerificationCode = verificationInfo[emailAddress]?.verificationCode;
    if (!correctVerificationCode || verificationCode !== correctVerificationCode) throw new BadRequestError("A correct verification code and email address pairing is required.");

    // Delete the OTP.
    delete verificationInfo[emailAddress];
    setCache("verificationInfo", verificationInfo);

    // Create the access token and return it to the user.
    const accessToken = randomBytes(32).toString("hex");
    setCache("emailAddresses", {
      ...getCache("emailAddresses"),
      [accessToken]: emailAddress
    });

    return response.status(201).json({accessToken});

  } catch (error: unknown) {

    if (error instanceof MissingHeaderError || error instanceof BadRequestError) {

      console.log(`\x1b[33mA user's request to create an access token failed: ${error.message}\x1b[0m`);

      response.status(error.statusCode).json({
        message: error.message
      });

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