import dotenv from "dotenv";
import http from "http";
import path from "path";
import { fileURLToPath } from "url";
import app from "./app.js";
import { connectDatabase } from "./config/db.js";
import { initializeSocketServer } from "./realtime/socketServer.js";
import { ensureAdminAccount, ensureUserDirectory } from "./services/bootstrapService.js";
import { ensureConversationBackfill } from "./services/conversationService.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, "../.env") });

const port = process.env.PORT || 5000;
const httpServer = http.createServer(app);

const startServer = async () => {
  await connectDatabase();
  await ensureAdminAccount();
  await ensureUserDirectory();
  await ensureConversationBackfill();
  initializeSocketServer(httpServer);

  httpServer.listen(port, () => {
    console.log(`Backend running on port ${port}`);
  });
};

startServer();
