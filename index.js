import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import axios from "axios";
import qs from "qs";
import path from "path";
import { fileURLToPath } from "url";

// Load .env
dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

/* ================================================
      FILEPATH HELPERS
================================================ */
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/* ================================================
      ✅ REQUIRED: TikTok Verification Route
      TikTok requests EXACTLY:
      /.well-known/tiktok.txt
================================================ */
app.get("/.well-known/tiktok.txt", (req, res) => {
  res.setHeader("Content-Type", "text/plain");
  res.send(
    "tiktok-developers-site-verification=ILEsVC0ujBzYh7df4cILTNNssOiUCLI1"
  );
});

/* ================================================
      Static Files (optional)
================================================ */
app.use(express.static(path.join(__dirname, "public")));

/* ================================================
      ROOT CHECK
================================================ */
app.get("/", (req, res) => {
  res.send("WatchTower Backend Running");
});

/* ================================================
      TEMP TIKTOK TOKEN STORAGE
================================================ */
let tiktokAuthStore = {
  accessToken: null,
  refreshToken: null,
  openId: null,
  expiresAt: null,
};

function saveTikTokAuth(tokenData) {
  const now = Date.now();
  tiktokAuthStore = {
    accessToken: tokenData.access_token,
    refreshToken: tokenData.refresh_token,
    openId: tokenData.open_id,
    expiresAt: now + tokenData.expires_in * 1000,
  };
  console.log("✅ TikTok tokens saved for:", tokenData.open_id);
}

/* ================================================
      START TIKTOK OAUTH
================================================ */
app.get("/auth/tiktok", (req, res) => {
  const params = new URLSearchParams({
    client_key: process.env.TIKTOK_CLIENT_KEY,
    response_type: "code",
    scope: "user.info.basic,video.list",
    redirect_uri: process.env.TIKTOK_REDIRECT,
    state: "watchtower-secure-state",
  });

  const url = `https://www.tiktok.com/v2/auth/authorize/?${params.toString()}`;
  console.log("🔗 TikTok Auth URL:", url);

  return res.redirect(url);
});

/* ================================================
      TIKTOK CALLBACK
================================================ */
app.get("/auth/tiktok/callback", async (req, res) => {
  try {
    const { code } = req.query;

    if (!code) {
      console.error("❌ No code returned from TikTok.");
      return res.redirect("watchtower://oauth-failed?tiktok=1");
    }

    // Exchange code → tokens
    const tokenResponse = await axios.post(
      "https://open.tiktokapis.com/v2/oauth/token/",
      qs.stringify({
        client_key: process.env.TIKTOK_CLIENT_KEY,
        client_secret: process.env.TIKTOK_CLIENT_SECRET,
        code,
        grant_type: "authorization_code",
        redirect_uri: process.env.TIKTOK_REDIRECT,
      }),
      {
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
      }
    );

    const tokenData = tokenResponse.data;
    console.log("🎉 TikTok OAuth Token Response:", tokenData);

    saveTikTokAuth(tokenData);

    return res.redirect("watchtower://oauth-success?tiktok=1");
  } catch (err) {
    console.error("❌ TikTok OAuth Error:", err?.response?.data || err);
    return res.redirect("watchtower://oauth-failed?tiktok=1");
  }
});

/* ================================================
      VALIDATE TOKEN
================================================ */
async function getTikTokAccessToken() {
  if (!tiktokAuthStore.accessToken) return null;

  if (Date.now() < tiktokAuthStore.expiresAt) {
    return tiktokAuthStore.accessToken;
  }

  // TODO: add refresh logic later
  return tiktokAuthStore.accessToken;
}

/* ================================================
      DEMO STATS ENDPOINT
================================================ */
app.get("/api/tiktok/stats", async (req, res) => {
  try {
    const token = await getTikTokAccessToken();

    if (!token) {
      return res.status(401).json({ error: "TikTok not connected yet." });
    }

    // (Replace with real TikTok API calls later)
    return res.json({
      username: "@tiktok_user",
      followers: 12600,
      views7d: 58300,
    });
  } catch (err) {
    console.error("❌ Error fetching TikTok stats:", err);
    return res.status(500).json({ error: "Failed to fetch stats." });
  }
});

/* ================================================
      START SERVER
================================================ */
const PORT = process.env.PORT || 5005;
app.listen(PORT, () =>
  console.log(`🚀 WatchTower Backend running on PORT ${PORT}`)
);
