import request from "./request.js";

export default async function(userID: number, githubAppToken: string, githubRepositoryPath: string, agreementPath: string): Promise<void> {

  const headers = {Authorization: `Bearer ${githubAppToken}`};
  const agreementIDResponse = await request({
    host: "api.github.com",
    path: `/repos/${githubRepositoryPath}/contents/index/${userID}.json`,
    headers
  });

  if (!(agreementIDResponse instanceof Object) || !("content" in agreementIDResponse) || typeof(agreementIDResponse.content) !== "string") {

    throw {
      statusCode: 500,
      body: {
        message: "Internal server error"
      }
    }

  }

  const agreementIDs = JSON.parse(agreementIDResponse.content);
  if (!agreementIDs.includes(agreementPath)) {

    throw {
      statusCode: 404,
      body: {
        message: "Agreement doesn't exist or this user doesn't have access to it."
      }
    }

  }

}