import app from "./app";
import { env } from "./config/env";
import { isFirebaseInitialized } from "./config/firebase";

const server = app.listen(env.PORT, () => {
  console.log("====================================================");
  console.log(`🚀 StockForge Backend Server is running!`);
  console.log(`📡 URL: http://localhost:${env.PORT}`);
  console.log(`🌍 Environment: ${env.NODE_ENV}`);
  console.log(
    `🔥 Firebase Mode: ${isFirebaseInitialized ? "Cloud Connected" : "Disabled"}`,
  );
  console.log(`📚 Health Check: http://localhost:${env.PORT}/api/v1/health`);
  console.log("====================================================");
});

// Graceful Shutdown
function handleShutdown(signal: string) {
  console.log(`\n🛑 Received ${signal}. Shutting down gracefully...`);
  server.close(() => {
    console.log("✅ HTTP server closed. Exiting process.");
    process.exit(0);
  });
}

process.on("SIGTERM", () => handleShutdown("SIGTERM"));
process.on("SIGINT", () => handleShutdown("SIGINT"));

export default server;
