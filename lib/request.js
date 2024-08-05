import https from "https";
export default async function (requestOptions, body) {
    return await new Promise((resolve, reject) => {
        const request = https.request(requestOptions, (response) => {
            response.setEncoding("utf8");
            let responseBody = "";
            response.on("data", (chunk) => responseBody += chunk);
            response.on("end", () => resolve(JSON.parse(responseBody)));
        });
        request.on("error", (err) => reject(err));
        if (body) {
            request.write(body);
        }
        request.end();
    });
}
