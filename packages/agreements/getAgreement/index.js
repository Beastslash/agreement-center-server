import { request } from "../../../modules/request";
import getGitHubUserID from "../../../modules/getGitHubUserID";
import jwt from "jsonwebtoken";

export async function main(event) {

  try {

    // Verify that the agreement is in the user's index list.
    const userID = getGitHubUserID(event);
    const githubPrivateKey = process.env.PRIVATE_KEY;
    const githubAppToken = jwt.sign({iss: process.env.CLIENT_ID}, githubPrivateKey, {algorithm: "RS256", expiresIn: "5s"});
    const headers = {Authorization: `Bearer ${githubAppToken}`};
    const agreementIDResponse = await request({
      host: "api.github.com",
      path: `/repos/${process.env.REPOSITORY}/contents/index/${userID}.json`,
      headers
    });
    const agreementIDs = JSON.parse(agreementIDResponse.content);
    const agreementPath = event.agreement_path;
    if (!agreementIDs.includes(agreementPath)) {
  
      return {
        statusCode: 404,
        body: {
          message: "Agreement doesn't exist or you don't have access to it."
        }
      }
  
    }
  
    // Return the agreement, its inputs, and its permisssions.
    const agreementTextResponse = await request({
      host: "api.github.com",
      headers,
      path: `/repos/${process.env.REPOSITORY}/contents/${agreementPath}/README.md`
    });
    const agreementInputsResponse = await request({
      host: "api.github.com",
      headers,
      path: `/repos/${process.env.REPOSITORY}/contents/${agreementPath}/inputs.json`
    });
    const agreementPermissionsResponse = await request({
      host: "api.github.com",
      headers,
      path: `/repos/${process.env.REPOSITORY}/contents/${agreementPath}/permissions.json`
    });
    return {
      body: {
        text: agreementTextResponse.content,
        inputs: agreementInputsResponse.content,
        permissions: agreementPermissionsResponse.content
      }
    }

  } catch (err) {

    return {
      statusCode: 500,
      body: {
        message: "Internal server error."
      }
    }

  }

}
