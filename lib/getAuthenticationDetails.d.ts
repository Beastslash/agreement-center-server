import ParsedWebEvent from "./ParsedWebEvent.js";
export default function (event: ParsedWebEvent): Promise<{
    userID: number;
    githubAppToken: string;
    headers: {
        Authorization: string;
    };
}>;
