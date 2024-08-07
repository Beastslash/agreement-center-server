import ParsedWebEvent from "./ParsedWebEvent.js";
import request from "./request.js";
import ServerError from "./ServerError.js";

export default async function(event: ParsedWebEvent): Promise<number> {

  const {http: {headers}} = event;
  const doesGitHubUserAccessTokenHeaderExist = headers.hasOwnProperty("github-user-access-token");
  const githubUserAccessToken = doesGitHubUserAccessTokenHeaderExist ? headers["github-user-access-token"] : undefined;
  if (typeof(githubUserAccessToken) !== "string") {

    throw new ServerError(400, "github-user-access-token header required.");

  }

  const userResponse = await request({
    host: "api.github.com",
    path: `/user`,
    headers: {
      Authorization: `Bearer ${githubUserAccessToken}`
    },
    port: 443
  });

  if (!(userResponse instanceof Object) || !("id" in userResponse) || typeof(userResponse.id) !== "number") {

    throw new ServerError(500, "Response wasn't an object.");

  }

  return userResponse.id;

}