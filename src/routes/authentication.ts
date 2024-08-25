import { Router } from "express";
import accessTokenRoute from "./authentication/access-token.js";
import verificationCodeRoute from "./authentication/verification-code.js";

const router = Router();

router.use("/access-token", accessTokenRoute);
router.use("/verification-code", verificationCodeRoute);

export default router;