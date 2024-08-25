import getFileContents from "./getFileContents.js";
import { Events } from "#utils/classes/Event.js";

export default async function getAgreementEvents(headers: HeadersInit, githubRepositoryPath: string, agreementPath: string) {

  const { sha, content } = await (await getFileContents({...headers, accept: "application/json"}, githubRepositoryPath, agreementPath, "events.json")).json() as {sha: string; content: string};
  const agreementEvents = JSON.parse(atob(content)) as Events;

  return {
    sha,
    events: agreementEvents
  };

}