import "dotenv/config";

import connectDB from "./db/index.js";
import app from "./app.js";

// Boot the email worker inside the main server process
// The worker connects to Redis and listens for emailQueue jobs in the background
import "./workers/email.worker.js";

connectDB()
    .then(() => {
        const port = process.env.PORT || 8000;
        app.listen(port, () => {
            console.log(`🚀 Lok Setu server running at port ${port}`);
        });
    })
    .catch((err) => {
        console.error("❌ MongoDB connection failed:", err);
        process.exit(1);
    });
