import { Events } from "./classes/Event.js";

export default async function updateAgreementEvents(headers: HeadersInit, eventsSHA: string, githubRepositoryPath: string, agreementPath: string, newEvents: {[emailAddress: string]: Events}) {

  const response = await fetch(`https://api.github.com/repos/${githubRepositoryPath}/contents/documents/${agreementPath}/events.json`, {
    headers,
    method: "PUT",
    body: JSON.stringify({
      message: "Update events",
      sha: eventsSHA,
      content: btoa(JSON.stringify(newEvents, null, 2))
    })
  });

  if (!response.ok) {

    throw new Error(await response.json());

  }

}