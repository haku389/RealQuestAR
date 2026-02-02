import { onCall, HttpsError } from "firebase-functions/v2/https";
import { setGlobalOptions } from "firebase-functions/v2";
import { logger } from "firebase-functions";

setGlobalOptions({ region: "asia-northeast1" });

export const hello = onCall(async (request) => {
  const uid = request.auth?.uid;
  if (!uid) throw new HttpsError("unauthenticated", "Login required");
  logger.info("hello called", { uid });
  return { message: "Hello from Functions!", uid };
});