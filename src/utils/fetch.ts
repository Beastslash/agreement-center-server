import https, { RequestOptions } from "https";

export default async function(requestOptions: RequestOptions, extraOptions?: {body?: string; shouldResolveOnTimeout?: boolean}) {

  return await new Promise((resolve, reject) => {

    const request = https.request(requestOptions, (response) => {

      let responseBody = "";

      console.log(response);
      response.on("timeout", () => {
        
        console.log(response)
        request.destroy();
        if (extraOptions && extraOptions.shouldResolveOnTimeout) {

          if (response.statusCode === 204) {

            resolve(null);
            return;

          }
          
        }

        reject(null);
      
      });

      response.setEncoding("utf8");
      response.on("data", (chunk) => responseBody += chunk);

      response.on("end", () => {
        
        if (response.headers["content-type"] === "application/json") {
          
          resolve(JSON.parse(responseBody));
          
        } else {

          resolve(responseBody);

        };

      });

    });

    request.on("error", (err) => reject(err));

    if (extraOptions && extraOptions.body) {

      request.write(extraOptions.body);

    }

    console.log(request);

    request.end();

  });

}