export async function verifyAgreementPath(event) {

  const githubUserAccessToken = event.http.headers["github-user-access-token"];
  if (!githubUserAccessToken) {

    return {
      statusCode: 401,
      body: {
        message: "github-user-access-token header required."
      }
    };

  }

}