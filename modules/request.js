export async function request(requestOptions) {

  return await new Promise((resolve, reject) => {

    const request = https.request(requestOptions, (response) => {
      
      response.setEncoding("utf8");

      let responseBody = "";

      response.on("data", (chunk) => responseBody += chunk);

      response.on("end", () => resolve(JSON.parse(responseBody)));

    });

    request.on("error", (err) => reject(err));

    request.end();

  });

}