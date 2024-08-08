// This application serves as a REST API for Beastslash's Agreement Center.
// Routes should be in the routes folder, not this file.

import express from "express";
import {createServer} from "https";
import {readFileSync} from "fs";
import agreementsRouter from "./routes/agreements.js";
import authenticationRouter from "./routes/authentication.js";

const app = express();
app.use(express.json());
app.use("/agreements", agreementsRouter);
app.use("/authentication", authenticationRouter);

const port = process.env.PORT;
const server = createServer({
  key: readFileSync("../security/cert.key"),
  cert: readFileSync("../security/cert.pem")
}, app);
server.listen(port, () => console.log(`Application Center is now listening on port ${port}.`));
