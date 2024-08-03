import getGitHubUserID from "../../../modules/getGitHubUserID";

export default async function(event) {

  const userID = await getGitHubUserID(event);
  const githubPrivateKey = process.env.PRIVATE_KEY;
  const githubAppToken = jwt.sign({iss: process.env.CLIENT_ID}, githubPrivateKey, {algorithm: "RS256", expiresIn: "5s"});
  return {
    userID,
    githubAppToken,
    headers: {Authorization: `Bearer ${githubAppToken}`}
  }

}