import { request } from "../../../modules/request";
import verifyAgreementPath from "../../../modules/verifyAgreementPath";
import getAuthenticationDetails from "../../../modules/getAuthenticationDetails";

export async function main(event) {

  try {

    // Verify that the agreement is in the user's index list.
    const {userID, githubAppToken} = await getAuthenticationDetails(event);
    const agreementPath = event.agreement_path;
    await verifyAgreementPath(userID, githubAppToken, githubRepositoryPath, agreementPath);
  
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
