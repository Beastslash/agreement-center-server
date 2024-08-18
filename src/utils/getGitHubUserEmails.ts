import MissingHeaderError from "./errors/MissingHeaderError.js";
import fetch from "./fetch.js";

export default async function getGitHubUserEmails(request: any) {

  const githubUserAccessToken = request.headers["github-user-access-token"];
  if (typeof(githubUserAccessToken) !== "string") throw new MissingHeaderError("github-user-access-token");

  const userResponse = await fetch({
    host: "api.github.com",
    path: `/user/emails`,
    headers: {
      Authorization: `Bearer ${githubUserAccessToken}`,
      "user-agent": "Agreement-Center"
    },
    port: 443
  });

  if (!(userResponse instanceof Array)) throw new Error("Malformed response received from GitHub.");

  return userResponse;

}