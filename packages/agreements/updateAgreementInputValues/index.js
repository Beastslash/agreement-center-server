import { request } from "../../../modules/request";
import verifyAgreementPath from "../../../modules/verifyAgreementPath";
import getAuthenticationDetails from "../../../modules/getAuthenticationDetails";

export async function main(event) {

  try {

    // Verify that the agreement is in the user's index list.
    const {userID, githubAppToken} = await getAuthenticationDetails(event);
    const agreementPath = event.agreement_path;
    await verifyAgreementPath(userID, githubAppToken, githubRepositoryPath, agreementPath);

    // Update the input values
    const agreementInputsResponse = await request({
      host: "api.github.com",
      headers,
      path: `/repos/${githubRepositoryPath}/contents/${agreementPath}/inputs.json`
    });

    const agreementInputs = JSON.parse(agreementInputsResponse.content);
    const newInputPairs = event.body.inputs;
    if (!(newInputPairs instanceof Array)) {

      return {
        statusCode: 400,
        body: {
          message: "Inputs property is not an array."
        }
      }

    }

    for (let i = 0; newInputPairs.length > i; i++) {

      const inputIndex = newInputPairs[i].index;
      if (!agreementInputs.hasOwnProperty(inputIndex)) {

        return {
          statusCode: 400,
          body: {
            message: `Input index ${inputIndex} doesn't exist.`
          }
        }
    
      }

      const doesUserHavePermissionToChangeInput = agreementInputs[inputIndex].ownerID === userID;
      if (!doesUserHavePermissionToChangeInput) {
    
        return {
          statusCode: 403,
          body: {
            message: `User doesn't have permission to change input ${inputIndex}.`
          }
        }
    
      }

      const inputValue = event.body.input_value;
      agreementInputs[inputIndex].value = inputValue;

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

    return {
      statusCode: 500,
      body: {
        message: "Internal server error."
      }
    }

  }

}
