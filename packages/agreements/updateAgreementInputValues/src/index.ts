import request from "#lib/request.js";
import verifyAgreementPath from "#lib/verifyAgreementPath.js";
import getAuthenticationDetails from "#lib/getAuthenticationDetails.js";
import ParsedWebEvent from "#lib/ParsedWebEvent.js";

export async function main(event: ParsedWebEvent) {

  try {

    // Verify that the agreement is in the user's index list.
    const {userID, githubAppToken, headers} = await getAuthenticationDetails(event);
    const agreementPath = event.agreement_path;
    const githubRepositoryPath = process.env.REPOSITORY;

    if (typeof(agreementPath) !== "string") {

      throw new Error("Agreement path required.");

    }

    if (!githubRepositoryPath) {

      throw new Error("REPOSITORY environment variable is required.");

    }

    await verifyAgreementPath(userID, githubAppToken, githubRepositoryPath, agreementPath);

    // Update the input values
    const agreementInputsResponse = await request({
      host: "api.github.com",
      headers,
      path: `/repos/${githubRepositoryPath}/contents/${agreementPath}/inputs.json`
    });

    if (!(agreementInputsResponse instanceof Object) || !("content" in agreementInputsResponse) || typeof(agreementInputsResponse.content) !== "string") {

      throw new Error("Content received from GitHub wasn't a string.");
  
    }

    const agreementInputs = JSON.parse(agreementInputsResponse.content);
    const newInputPairs = event.inputs;
    if (!(newInputPairs instanceof Array)) {

      return {
        statusCode: 400,
        body: {
          message: "Inputs property is not an array."
        }
      }

    }

    for (let i = 0; newInputPairs.length > i; i++) {

      const { index, value } = newInputPairs[i];
      if (!agreementInputs.hasOwnProperty(index)) {

        return {
          statusCode: 400,
          body: {
            message: `Input index ${index} doesn't exist.`
          }
        }
    
      }

      const doesUserHavePermissionToChangeInput = agreementInputs[index].ownerID === userID;
      if (!doesUserHavePermissionToChangeInput) {
    
        return {
          statusCode: 403,
          body: {
            message: `User doesn't have permission to change input ${index}.`
          }
        }
    
      }

      agreementInputs[index].value = value;

    }

    await request({
      host: "api.github.com",
      headers,
      method: "PUT",
      path: `/repos/${githubRepositoryPath}/contents/${agreementPath}/inputs.json`,
    }, JSON.stringify({
      message: `Update user ${userID}'s inputs.`,
      content: JSON.stringify(agreementInputs)
    }, null, 2));

    return {statusCode: 200};

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
