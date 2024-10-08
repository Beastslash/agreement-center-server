// This application serves as a REST API for Beastslash's Agreement Center.
// Routes should be in the routes folder, not this file.

import express from "express";
import {createServer} from "https";
import {readFileSync} from "fs";
import agreementsRouter from "./routes/agreements.js";
import authenticationRouter from "./routes/authentication.js";
import cors from "cors";

const app = express();
app.use(express.json());
app.use(cors({
  exposedHeaders: ["email-address"]
}));
app.disable("x-powered-by");
app.use("/agreements", agreementsRouter);
app.use("/authentication", authenticationRouter);

app.get("/", (_, response) => response.redirect("https://github.com/Beastslash/agreement-center-server/tree/production/docs/README.md"));

const port = process.env.PORT;
const server = process.env.ENVIRONMENT === "development" ? createServer({
  key: readFileSync("./etc/secrets/localhost.key"),
  cert: readFileSync("./etc/secrets/localhost.pem")
}, app) : app;
server.listen(port, () => console.log(`\x1b[32mApplication Center is now listening on port ${port}.\x1b[0m`));
