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

/* =====================================================
     STATIC FILES FOR TIKTOK VERIFICATION
     Folder: /public
     Example URL:
     https://your-backend.onrender.com/tiktok-verification.txt
===================================================== */

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Serve files placed inside /public
app.use(express.static(path.join(__dirname, "public")));

// Root route
app.get("/", (req, res) => {
  res.send("WatchTower Backend Running");
});

/* =====================================================
     TEMP STORAGE (REPLACE WITH DB LATER)
===================================================== */

let tiktokAuthStore = {
  accessToken: null,
  refreshToken: null,
  openId: null,
  expiresAt: null, // timestamp (ms)
};

function saveTikTokAuth(tokenData) {
  const now = Date.now();
  tiktokAuthStore = {
    accessToken: tokenData.access_token,
    refreshToken: tokenData.refresh_token,
    openId: tokenData.open_id,
    expiresAt: now + tokenData.expires_in * 1000,
  };
  console.log("✅ TikTok tokens saved for open_id:", tokenData.open_id);
}

/* =====================================================
     START TIKTOK OAUTH
     GET /auth/tiktok
===================================================== */

app.get("/auth/tiktok", (req, res) => {
  const params = new URLSearchParams({
    client_key: process.env.TIKTOK_CLIENT_KEY,
    response_type: "code",
    scope: "user.info.basic,video.list",
    redirect_uri: process.env.TIKTOK_REDIRECT,
    state: "watchtower-secure-state",
  });

  const url = `https://www.tiktok.com/v2/auth/authorize/?${params.toString()}`;
  console.log("🔗 Redirecting to TikTok Auth:", url);

  return res.redirect(url);
});

/* =====================================================
     TIKTOK CALLBACK
     GET /auth/tiktok/callback
===================================================== */

app.get("/auth/tiktok/callback", async (req, res) => {
  try {
    const { code } = req.query;

    if (!code) {
      console.error("❌ No code returned from TikTok");
      return res.redirect(
        process.env.FRONTEND_DEEP_LINK_ERROR ||
        "watchtower://oauth-failed?tiktok=1"
      );
    }

    // Exchange code → access token
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

    console.log("🎉 TikTok OAuth Success:", tokenData);

    // Save tokens into memory
    saveTikTokAuth(tokenData);

    // Redirect user back to the WatchTower app
    return res.redirect(
      process.env.FRONTEND_DEEP_LINK || "watchtower://oauth-success?tiktok=1"
    );
  } catch (err) {
    console.error("❌ TikTok OAuth Error:", err?.response?.data || err);
    return res.redirect(
      process.env.FRONTEND_DEEP_LINK_ERROR ||
      "watchtower://oauth-failed?tiktok=1"
    );
  }
});

/* =====================================================
     HELPER: Get valid TikTok token
===================================================== */

async function getTikTokAccessToken() {
  if (!tiktokAuthStore.accessToken) return null;

  const now = Date.now();

  // TODO: implement refresh token flow
  if (tiktokAuthStore.expiresAt > now) {
    return tiktokAuthStore.accessToken;
  }

  return tiktokAuthStore.accessToken;
}

/* =====================================================
     DEMO STATS ENDPOINT
     GET /api/tiktok/stats
===================================================== */

app.get("/api/tiktok/stats", async (req, res) => {
  try {
    const token = await getTikTokAccessToken();

    if (!token) {
      return res.status(401).json({ error: "TikTok not connected yet." });
    }

    // TODO: Call TikTok API.
    // For now: return mock data so your app works.
    return res.json({
      username: "@tiktok_user",
      followers: 12600,
      views7d: 58300,
    });
  } catch (err) {
    console.error("❌ Error getting TikTok stats:", err);
    return res.status(500).json({ error: "Failed to fetch TikTok stats." });
  }
});

/* =====================================================
     START SERVER
===================================================== */

const PORT = process.env.PORT || 5005;
app.listen(PORT, () =>
  console.log(`🚀 WatchTower Backend running on PORT ${PORT}`)
);
