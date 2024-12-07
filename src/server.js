const express = require("express");
const bodyParser = require("body-parser");
const cors = require("cors");
const dotenv = require("dotenv");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");
const path = require("path");
const db = require("./config/db");
const logger = require("./utils/logger");

// Load environment variables
dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

// Import routes
const dashboardRoutes = require("./routes/dashboard");
const authRoutes = require("./routes/auth");
const userRoutes = require("./routes/userRoutes");
const companies = require("./routes/companies");
const assessmentRoutes = require("./routes/assessmentRoutes");
const adminRoutes = require("./routes/adminRoutes");
const companyEmployeeRoutes = require("./routes/companyEmployeeRoutes");
const companyCalculationsRoutes = require("./routes/companyCalculationsRoutes");
const singleroute = require("./routes/singleroute");
const employeeSubmit = require('./routes/OnSubmit');
// Security headers and middleware setup
app.use([
  helmet(), // Sets various HTTP headers for security
  rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 200, // Allow up to 200 requests per 15 minutes
  }),
  cors({
    origin: process.env.CORS_ORIGIN || "*", // Allow CORS from environment-defined origins or all
    methods: ["GET", "POST", "PUT", "DELETE"],
    credentials: true, // Allow credentials like cookies
  }),
  bodyParser.json(),
  bodyParser.urlencoded({ extended: true }), // Support URL-encoded bodies
]);

// Logging middleware
app.use((req, res, next) => {
  logger.info(`${req.method} ${req.url}`);
  next();
});

// Route definitions - Same base URL structure, no change to route functionality
app.use("/api/auth", authRoutes);
app.use("/api/users", userRoutes);
app.use("/api", companies); // Handles the `/api/companies` routes
app.use("/api/dashboard", dashboardRoutes);
app.use("/api/assessment", assessmentRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/company-employees", companyEmployeeRoutes);
app.use("/api", companyCalculationsRoutes);
app.use('/api', employeeSubmit);
// app.use("/api/single-emp", singleroute);
app.use('/api', singleroute);
// Static files for PDF reports (unchanged)
app.use("/reports", express.static(path.join(__dirname, "public", "reports")));
app.use(cors());
app.use(bodyParser.json());
// Basic health check route (unchanged)
app.get("/", (req, res) => {
  res.json({
    message: "Health Risk Assessment API is running",
    dbStatus: db.connection ? "Connected" : "Disconnected",
  });
});

// Error handling middleware (unchanged)
app.use((err, req, res, next) => {
  logger.error("Error stack:", err.stack);
  res.status(err.status || 500).json({
    message: err.message || "Internal Server Error",
  });
});

// Start the server
const server = app.listen(PORT, () => {
  logger.info(`Server running on http://localhost:${PORT}`);
});

// Graceful shutdown
process.on("SIGINT", () => {
  logger.info("Shutting down gracefully...");
  server.close(() => {
    logger.info("Closed all connections");
    process.exit(0);
  });
});

module.exports = app;
