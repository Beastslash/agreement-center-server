export default async function(event) {

  const githubUserAccessToken = event.http.headers["github-user-access-token"];
  if (!githubUserAccessToken) {

    throw {
      statusCode: 401,
      body: {
        message: "github-user-access-token header required."
      }
    };

  }

  try {

    const userResponse = await request({
      host: "api.github.com",
      path: `/user?access_token?${githubUserAccessToken}`,
      port: 443
    });

    return userResponse.id;

  } catch (err) {

    throw {
      statusCode: 500,
      body: {
        message: "Internal server error."
      }
    }

  }

}