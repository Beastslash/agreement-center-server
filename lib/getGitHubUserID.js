import request from "./request.js";
export default async function (event) {
    const { http: { headers } } = event;
    const doesGitHubUserAccessTokenHeaderExist = "github-user-access-token" in headers;
    const githubUserAccessToken = doesGitHubUserAccessTokenHeaderExist ? headers["github-user-access-token"] : undefined;
    if (!githubUserAccessToken) {
        throw {
            statusCode: 401,
            body: {
                message: "github-user-access-token header required."
            }
        };
    }
    try {
        const userResponse = await request({
            host: "api.github.com",
            path: `/user?access_token?${githubUserAccessToken}`,
            port: 443
        });
        // @ts-expect-error
        if (!(userResponse instanceof Object) || !userResponse.hasOwn("id")) {
            throw new Error("Response wasn't an object.");
        }
        // @ts-expect-error
        return userResponse.id;
    }
    catch (err) {
        throw {
            statusCode: 500,
            body: {
                message: "Internal server error."
            }
        };
    }
}
