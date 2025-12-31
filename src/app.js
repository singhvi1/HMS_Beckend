import express from "express";
import cookieParser from "cookie-parser";
import cors from "cors";
import { userRoutes, studentRoutes, announcementRoutes, leaveRequestRoutes, paymentRoutes, issueCommentRoutes, issueRoutes, disciplinaryCaseRoutes } from "./routes/index.js"
import { login, logout } from "./controllers/user.controller.js";
import { auth } from "./middlewares/auth.js";
import { getAllAnnouncements } from "./controllers/annoucement.controller.js";
import hostelRoutes from "./routes/hostel.routes.js"
import roomRoutes from "./routes/room.routes.js"
process.env.DOTENV_CONFIG_QUIET = "true";
import "dotenv/config";

const app = express();


app.use(cors({
  origin: process.env.CORS_ORIGIN || "http://localhost:5173",
  credentials: true,
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE"],
  allowedHeaders: ["Content-Type", "Authorization", "X-XSRF-TOKEN"],
  optionsSuccessStatus: 204,
  preflightContinue: false
}));

app.use(express.static("public"));
app.use(express.json());
app.use(express.urlencoded({ extended: true, limit: "16kb" }));
app.use(cookieParser());




app.post("/api/v1/login", login);
app.post("/api/v1/logout", auth, logout);
app.get("/api/v1/home", auth, getAllAnnouncements);

// Routes
app.use("/api/v1/admin/hostel", hostelRoutes);
app.use("/api/v1/home/announcements", announcementRoutes);
app.use("/api/v1/admin/rooms", roomRoutes);
app.use("/api/v1/students", studentRoutes);
app.use("/api/v1/users", userRoutes);
app.use("/api/v1/leave-requests", leaveRequestRoutes);
app.use("/api/v1/payments", paymentRoutes);
app.use("/api/v1/issues", issueRoutes);
app.use("/api/v1/issue-comments", issueCommentRoutes);
app.use("/api/v1/disciplinary-cases", disciplinaryCaseRoutes);

// Health check endpoint
app.get("/api/v1/health", (_req, res) => {
  res.status(200).json({
    success: true,
    message: "Server is running"
  });
});



// Global error handler (must be last)
app.use((err, _req, res, _next) => {
  const statusCode = err.statusCode || 500;
  res.status(statusCode).json({
    success: false,
    message: err.message || "Internal Server Error"
  });
});

export default app;
