// This function returns a specific agreement from the repository.

import request from "../../../../lib/request.js";
import verifyAgreementPath from "../../../../lib/verifyAgreementPath.js";
import getAuthenticationDetails from "../../../../lib/getAuthenticationDetails.js";
import ParsedWebEvent from "../../../../lib/ParsedWebEvent.js";

export async function main(event: ParsedWebEvent) {

  try {

    // Verify that the agreement is in the user's index list.
    const {userID, githubAppToken} = await getAuthenticationDetails(event);
    const agreementPath = event.agreement_path;
    const githubRepositoryPath = process.env.REPOSITORY;

    if (typeof(agreementPath) !== "string") {

      throw new Error("Agreement path required.");

    }

    if (!githubRepositoryPath) {

      throw new Error("REPOSITORY environment variable is required.");

    }

    await verifyAgreementPath(userID, githubAppToken, githubRepositoryPath, agreementPath);
  
    // Return the agreement, its inputs, and its permisssions.
    const headers = {Authorization: `Bearer ${githubAppToken}`};
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

    const isAgreementTextResponseContentString = agreementTextResponse instanceof Object && "content" in agreementTextResponse && typeof(agreementTextResponse.content) === "string";
    const isAgreementInputsResponseContentString = agreementInputsResponse instanceof Object && "content" in agreementInputsResponse && typeof(agreementInputsResponse.content) === "string";
    const isAgreementPermissionsResponseContentString = agreementPermissionsResponse instanceof Object && "content" in agreementPermissionsResponse && typeof(agreementPermissionsResponse.content) === "string";
    if (!isAgreementTextResponseContentString || !isAgreementInputsResponseContentString || !isAgreementPermissionsResponseContentString) {

      throw new Error("Agreement text content is not a string.");

    } 

    return {
      body: {
        text: agreementTextResponse.content,
        inputs: agreementInputsResponse.content,
        permissions: agreementPermissionsResponse.content
      }
    }

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
