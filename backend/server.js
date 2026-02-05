try {
  // dotenv is optional; only load if installed.
  // eslint-disable-next-line global-require
  const path = require("path");
  require("dotenv").config({ path: path.join(__dirname, ".env") });
} catch (error) {
  if (error.code !== "MODULE_NOT_FOUND") {
    throw error;
  }
}

const express = require("express");
const cors = require("cors");
const apiRoutes = require("./routes");
const { verifyAuthToken } = require("./authMiddleware");

const app = express();

app.use(cors());
app.use(express.json({ limit: "1mb" }));
app.use((err, req, res, next) => {
  if (err instanceof SyntaxError && err.status === 400 && "body" in err) {
    return res.status(400).json({ error: "Invalid JSON body" });
  }
  return next(err);
});

app.get("/health", (req, res) => {
  res.json({ ok: true });
});

app.use("/api", (req, res, next) => {
  if (req.path.startsWith("/auth/")) {
    return next();
  }
  return verifyAuthToken(req, res, next);
});

app.use("/api", apiRoutes);

const port = process.env.PORT || 3001;
app.listen(port, () => {
  // eslint-disable-next-line no-console
  console.log(`Backend listening on port ${port}`);
});
