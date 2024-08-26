
import jwt from "jsonwebtoken";
import { readFileSync } from "fs";

export default async function getGitHubInstallationAccessToken(): Promise<string> {

  const jsonWebToken = jwt.sign({iss: process.env.GITHUB_CLIENT_ID}, readFileSync(`${process.env.ENVIRONMENT === "production" ? "/etc/secrets" : "./etc/secrets"}/github.pem`), {algorithm: "RS256", expiresIn: "5s"});

  const installationsResponse = await fetch("https://api.github.com/app/installations", {
    headers: {
      Authorization: `Bearer ${jsonWebToken}`,
      "user-agent": "Agreement-Center",
      "accept": "application/json"
    }
  });

  const installations = await installationsResponse.json();

  if (!(installations instanceof Array)) {

    throw new Error("Malformed response received from GitHub.");

  }

  const githubAccountID = process.env.GITHUB_ACCOUNT_ID;
  if (!githubAccountID) throw new Error("GITHUB_ACCOUNT_ID needs to be defined in environment variables.");

  const installationID = installations.find((installation) => installation.account.id === parseInt(githubAccountID, 10))?.id;
  if (!installationID) throw new Error();

  const installationAccessTokenResponse = await fetch(`https://api.github.com/app/installations/${installationID}/access_tokens`, {
    headers: {
      Authorization: `Bearer ${jsonWebToken}`,
      "user-agent": "Agreement-Center",
      "accept": "application/json"
    },
    method: "POST"
  });

  const installationAccessToken = await installationAccessTokenResponse.json();

  if (!(installationAccessToken instanceof Object) || !("token" in installationAccessToken) || typeof(installationAccessToken.token) !== "string") {

    throw new Error("Malformed response received from GitHub.");

  }

  return installationAccessToken.token;

}