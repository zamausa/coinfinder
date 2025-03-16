const axios = require("axios");
const express = require("express");
const { Connection } = require("@solana/web3.js");
const mongoose = require("mongoose");
const Payment = require("../models/payment");
const { SOLANA_WALLET_ADDRESS } = process.env;
const { createQR } = require("@solana/pay"); // Import createQR from Solana Pay SDK
const BigNumber = require("bignumber.js");
const { toDataURL } = require("qrcode"); // Import QR Code generator
const router = express.Router();
const connection = new Connection(process.env.QUICKNODE_ENDPOINT, "confirmed");
const crypto = require("crypto");
const { PublicKey } = require("@solana/web3.js");
const bs58 = require("bs58").default;
const Boost = require("../models/boost"); // Import the Boost model
const { Token } = require("../models/tokenModel"); // Import the Token model
const { ObjectId } = require("mongoose").Types; // For MongoDB ObjectID
const address = new PublicKey(SOLANA_WALLET_ADDRESS);

// Function to generate a random memo (this will act as your transaction ID)
const generateMemo = () => {
  return crypto.randomBytes(16).toString("hex"); // Generates a 32-character hexadecimal string
};

// Define pricing tiers in EUR
const pricingTiersEUR = {
  1: 19, // 10 EUR for Tier 1
  2: 39, // 50 EUR for Tier 2
  3: 59, // 100 EUR for Tier 3
  4: 99, // 200 EUR for Tier 4
  5: 199, // 500 EUR for Tier 5
};

// Function to get current EUR to SOL exchange rate from CoinGecko
const getEurToSolRate = async () => {
  try {
    const response = await axios.get(
      "https://api.coingecko.com/api/v3/simple/price?ids=solana&vs_currencies=usd"
    );
    return response.data.solana.usd; // EUR to SOL conversion rate
  } catch (error) {
    console.error("Error fetching USD to SOL rate", error);
    return null; // Return null if the rate cannot be fetched
  }
};

// Handle payment initiation
router.post("/", async (req, res) => {
  try {
    const { wallet, tier } = req.body;
    console.log(req.body)
    if (!wallet || !tier || !pricingTiersEUR[tier]) {
      return res.status(400).json({ error: "Invalid wallet address or tier" });
    }

    const eurToSolRate = await getEurToSolRate();
    if (!eurToSolRate) {
      return res.status(500).json({ error: "Could not fetch EUR to SOL rate" });
    }

    const amountInEur = pricingTiersEUR[tier];
    const amountInSol = new BigNumber(amountInEur)
      .dividedBy(eurToSolRate)
      .toFixed(5); // Formats to 2 decimal places
    const memo = generateMemo(); // Generate a random memo

    const paymentLink = generateSolanaPayLink(wallet, amountInSol, memo); // Include memo in the payment link

    res.status(200).json({
      message: "Payment initiated successfully",
      recipient: SOLANA_WALLET_ADDRESS,
      paymentLink,
      qrCode: paymentLink, // Send base64 QR image
      memo, // Return the memo as part of the response
      amountInSol,
    });

    const payment = new Payment({
      walletAddress: wallet,
      paidBy: wallet,
      memo,
      tier,
      amount: amountInSol,
      status: "pending",
      createdAt: new Date(),
    });
    await payment.save();
    console.log(payment);
  } catch (error) {
    console.error("Error processing payment", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Modify generateSolanaPayLink to include the memo
const generateSolanaPayLink = (wallet, amountInSol, memo) => {
  return `solana:${wallet}?amount=${amountInSol}&label=Payment&message=Payment%20for%20your%20purchase&memo=${memo}`;
};

// Handle payment status checking (this is where we check for transactionId)
router.post("/payment-status/:memo", async (req, res) => {
  const { memo } = req.params;
  console.log("Received memo:", memo);

  if (!memo) {
    return res.status(400).json({ error: "Memo is required" });
  }

  try {
    // Extract token ID from memo
    const memoParts = memo.split(",");
    if (memoParts.length !== 2) {
      return res.status(400).json({ error: "Invalid memo format" });
    }
    const tokenId = memoParts[1];
    const randomPart = memoParts[0];


    // Query the Solana blockchain for transaction confirmations
    const confirmedTransactions = await connection.getSignaturesForAddress(
      address,
      { limit: 20 }
    );

    for (const tx of confirmedTransactions) {
      const transaction = await connection.getTransaction(tx.signature, {
        commitment: "confirmed",
      });

      if (!transaction) continue;

      // Search for memo instructions
      for (const instruction of transaction.transaction.message.instructions) {
        try {
          const programId =
            transaction.transaction.message.accountKeys[
              instruction.programIdIndex
            ];

          if (!programId) continue;

          const programIdBase58 = new PublicKey(programId).toBase58();
          console.log("Resolved Program ID:", programIdBase58);

          if (
            programIdBase58 === "MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr"
          ) {
            if (!instruction.data) continue;

            const memoData = instruction.data;
            const decodedMemo = Buffer.from(bs58.decode(memoData)).toString(
              "utf-8"
            );

            if (decodedMemo.trim() === memo.trim()) {
              // Get user details from request body
              const { walletAddress, tier, amount } = req.body;
              const payerAddress =
                transaction.transaction.message.accountKeys[0];
              if (!walletAddress || !tier || !amount) {
                return res
                  .status(400)
                  .json({ error: "Missing required fields" });
              }

              // Define boost properties based on tier
              const boostTiers = {
                1: { value: 100, duration: 3 * 24 * 60 * 60 * 1000 }, // 1 day
                2: { value: 300, duration: 3 * 24 * 60 * 60 * 1000 }, // 3 days
                3: { value: 500, duration: 5 * 24 * 60 * 60 * 1000 }, // 7 days
                4: {
                  value: 1000,
                  duration: 7 * 24 * 60 * 60 * 1000,
                  golden: true,
                }, // 14 days (golden)
                5: {
                  value: 3000,
                  duration: 10 * 24 * 60 * 60 * 1000,
                  golden: true,
                }, // 30 days (golden)
              };

              const selectedTier = boostTiers[tier];
              if (!selectedTier) {
                return res.status(400).json({ error: "Invalid tier selected" });
              }

              const expiresAt = new Date(Date.now() + selectedTier.duration);
              const boostValue = selectedTier.value;
              const isGolden = selectedTier.golden || false;

              // Create Boost document
                const newBoost = new Boost({
                tokenId: new ObjectId(tokenId),
                walletAddress,
                tier,
                boostValue,
                isGolden,
                paidBy: payerAddress.toBase58(),
                memo,
                transactionId: tx.signature,
                expiresAt,
                });

              await newBoost.save();

              // Update token's trending score

                let updatedToken;
                if (isGolden) {
                updatedToken = await Token.findByIdAndUpdate(
                  tokenId,
                  { 
                  $inc: { trending_score: boostValue, premium_boosts: boostValue }, 
                  isGolden: isGolden 
                  },
                  { new: true }
                );
                } else {
                updatedToken = await Token.findByIdAndUpdate(
                  tokenId,
                  { 
                  $inc: { trending_score: boostValue, premium_boosts: boostValue } 
                  },
                  { new: true }
                );
                }
              console.log(
                `Boost applied! Token ${tokenId} new trending score: ${updatedToken.trending_score}`
              );

                // Update the payment status to completed
                await Payment.findOneAndUpdate(
                { memo: randomPart },
                { status: "completed", paidBy: payerAddress.toBase58(), memo }
                );

              return res.status(200).json({
                message: "Payment completed successfully and boost applied.",
                status: "completed",
                transactionId: tx.signature,
                newTrendingScore: updatedToken.trending_score,
              });
            }
          }
        } catch (err) {
          console.error("Error processing instruction:", err);
        }
      }
    }

    return res.status(200).json({
      message: "Payment still pending, awaiting confirmation.",
      status: "pending",
    });
  } catch (error) {
    console.error("Error fetching payment status", error);
    return res.status(500).json({ error: "Internal server error" });
  }
});






// Apply boost logic





module.exports = router;
