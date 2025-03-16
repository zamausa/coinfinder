const express = require("express");
const jwt = require("jsonwebtoken");
const bs58 = require("bs58").default;
const nacl = require("tweetnacl"); // Solana uses this for cryptographic verification
require("dotenv").config({ path: '../.env' });

const router = express.Router();
const JWT_SECRET = process.env.JWT_SECRET || "supersecretkey"; // Secret key for JWT

// Temporary store for challenges (should use a DB in production)
const challenges = {};
const ADMIN_WALLET_ADDRESS = process.env.ADMIN_WALLET_ADDRESS;

router.post("/challenge", (req, res) => {
  const { publicKey } = req.body;

  if (!publicKey) return res.status(400).json({ error: "Public key required" });

  const message = `Sign this message to authenticate. Timestamp: ${Date.now()}`;
  challenges[publicKey] = message; // Store challenge temporarily

  res.json({ message });
});

router.post("/logout", (req, res) => {
  res.clearCookie("token", {
    httpOnly: true,
    secure: true, // Must match how it was set
    sameSite: "None", // Must match how it was set
    path: "/", // Ensure it's the same path
  });

  console.log("Logout - Cookie cleared");
  res.status(200).json({ message: "Logged out successfully" });
});

const verifyAdmin = (req, res) => {
  try {
    const { publicKey } = req.user; // Now req.user will contain the decoded user information

    if (publicKey === ADMIN_WALLET_ADDRESS) {
      return res.status(200).json({ isAdmin: true });
    } else {
      return res.status(403).json({ isAdmin: false });
    }
  } catch (error) {
    res.status(500).json({ error: "Failed to verify admin status" });
  }
};

const checkIfAdmin = (req, res, next) => {
  const token = req.cookies.token;

  if (!token) {
    return res.status(401).json({ error: "No token provided" });
  }

  jwt.verify(token, JWT_SECRET, (err, decoded) => {
    if (err) {
      return res.status(401).json({ error: "Invalid or expired token" });
    }

    req.user = decoded; // Attach decoded user information to req.user

    const { publicKey } = decoded;
    if (publicKey === ADMIN_WALLET_ADDRESS) {
      next(); // Admin verified, proceed to the next middleware or route handler
    } else {
      res.status(403).json({ error: "You do not have admin access" });
    }
  });
};

// In routes
router.get("/verifyAdmin", checkIfAdmin, verifyAdmin);

// Step 2: Verify the signed message
router.post("/verify", (req, res) => {
  const { publicKey, signature, visitorId } = req.body;
  console.log(visitorId);
  if (!publicKey || !signature)
    return res.status(400).json({ error: "Public key and signature required" });

  const message = challenges[publicKey];
  if (!message) return res.status(400).json({ error: "Challenge expired or invalid" });

  // Convert data for verification
  const messageBytes = new TextEncoder().encode(message);
  const signatureBytes = new Uint8Array(signature);
  const publicKeyBytes = new Uint8Array(bs58.decode(publicKey));

  // Verify the signature
  const isValid = nacl.sign.detached.verify(messageBytes, signatureBytes, publicKeyBytes);

  if (!isValid) return res.status(401).json({ error: "Invalid signature" });

  // Generate a JWT token
  const token = jwt.sign({ publicKey, visitorId }, JWT_SECRET, { expiresIn: "24h" });
  
  delete challenges[publicKey]; // Remove used challenge for security

  // Set JWT token in HttpOnly cookie
  res.cookie('token', token, {
    httpOnly: true,    // Prevent access via JavaScript
    secure: true, // Use secure cookie in production
    maxAge: 86400000,   // Set cookie expiration (1 day)
    sameSite: 'none' // Adjust based on your requirements
  });

 
  

  res.json({ message: 'Authentication successful', token });
});

// Example route that only admin can access
router.get("/admin", checkIfAdmin, (req, res) => {
  res.json({ message: "Welcome, admin!" });
});

// Route to verify if a user is authenticated
router.get("/verifyToken", (req, res) => {
  // Check if the token is provided in cookies

  const token = req.cookies.token;

  if (!token) {
    return res.status(401).json({ error: "No token provided" });
  }

  // Verify the token
  jwt.verify(token, JWT_SECRET, (err, decoded) => {
    if (err) {
      return res.status(401).json({ error: "Invalid or expired token" });
    }

    // If token is valid, send the decoded info back
    res.json({ message: "Token is valid", decoded });
  });
});



module.exports = { checkIfAdmin, router };
