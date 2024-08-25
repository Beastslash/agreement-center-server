export default async function getFileContents(headers: HeadersInit, githubRepositoryPath: string, agreementPath: string, fileName: string) {
      
  const response = await fetch(`https://api.github.com/repos/${githubRepositoryPath}/contents/documents/${agreementPath}/${fileName}`, {
    headers
  });
  
  return response;

}