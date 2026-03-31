const { ethers } = require("ethers");
const crypto = require("crypto");

const CONTRACT_ADDRESS = process.env.CONTRACT_ADDRESS;

const CONTRACT_ABI = [
  "function balanceOf(address shareholder) view returns (uint256 shareAmount, bool isValid, uint8 plan, uint256 expiry, bool licensed, bool isLifetime, uint256 daysRemaining, uint256 hrs, uint256 mins, uint256 secs)"
];

export default async function handler(req, res) {
  try {
    if (req.method !== "POST") {
      return res.status(405).json({ error: "Method not allowed" });
    }

    const { wallet } = req.body || {};

    if (!wallet) {
      return res.status(400).json({ error: "Missing wallet" });
    }

    if (!process.env.ALCHEMY_URL) {
      return res.status(501).json({ error: "Missing ALCHEMY_URL" });
    }

    if (!process.env.PRIVATE_KEY) {
      return res.status(502).json({ error: "Missing LICENSE_PRIVATE_KEY" });
    }

    if (!process.env.CONTRACT_ADDRESS) {
      return res.status(503).json({ error: "Missing CONTRACT_ADDRESS" });
    }

    const provider = new ethers.JsonRpcProvider(process.env.ALCHEMY_URL);

    const contract = new ethers.Contract(
      CONTRACT_ADDRESS,
      CONTRACT_ABI,
      provider
    );

    const [
      shareAmount,
      isValid,
      plan,
      expiry,
      licensed,
      isLifetime,
      daysRemaining,
      hrs,
      mins,
      secs
    ] = await contract.balanceOf(wallet);

    // 🔒 FULL VALIDATION LOGIC (unchanged)
    const now = Math.floor(Date.now() / 1000);

    const valid =
      licensed &&
      isValid &&
      (isLifetime || Number(expiry) > now);

    if (!valid) {
      return res.status(403).json({
        valid: false,
        error: "License invalid, expired, or not licensed"
      });
    }

    // ✅ Build signed payload instead of JWT
    const payload = {
      wallet: wallet.toLowerCase(),
      licensed: true,
      isValid: true,
      isLifetime: isLifetime,
      expiry: isLifetime ? 9999999999 : Number(expiry),
      plan: Number(plan),
      issuedAt: now,
      nonce: crypto.randomUUID()
    };

    // Sign with your private key
    const privateKey = process.env.PRIVATE_KEY.replace(/\\n/g, '\n');
    const sign = crypto.createSign("SHA256");
    sign.update(JSON.stringify(payload));
    sign.end();
    const signature = sign.sign(privateKey, "base64");

    return res.status(200).json({ payload, signature });

  } catch (err) {
    console.error("ERROR:", err);
    return res.status(500).json({
      error: err.message || "Unknown error",
      valid: false
    });
  }
}