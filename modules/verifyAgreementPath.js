export default async function(userID, githubAppToken, githubRepositoryPath, agreementPath) {

  const headers = {Authorization: `Bearer ${githubAppToken}`};
  const agreementIDResponse = await request({
    host: "api.github.com",
    path: `/repos/${githubRepositoryPath}/contents/index/${userID}.json`,
    headers
  });
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