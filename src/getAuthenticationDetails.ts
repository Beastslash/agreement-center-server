import getGitHubUserID from "./getGitHubUserID.js";
import ParsedWebEvent from "./ParsedWebEvent.js";
import jwt from "jsonwebtoken";

export default async function(event: ParsedWebEvent) {

  const userID = await getGitHubUserID(event);
  const githubPrivateKey = process.env.PRIVATE_KEY;

  if (!githubPrivateKey) {

    throw new Error("GitHub App private key required.");

  }

  const githubAppToken = jwt.sign({iss: process.env.CLIENT_ID}, githubPrivateKey, {algorithm: "RS256", expiresIn: "5s"});
  return {
    userID,
    githubAppToken,
    headers: {Authorization: `Bearer ${githubAppToken}`}
  }

}0