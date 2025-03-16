import React, { useState, useRef, useEffect } from "react";
import "../styles/HomePage.css";
import "../styles/Boost.css";
import logoMGV from "../static/LogoMGV.svg";
import Fire1 from "../static/Fire1.png";
import Fire2 from "../static/Fire2.png";
import Fire3 from "../static/Fire3.png";
import Fire4 from "../static/Fire1.png";
import Fire5 from "../static/Fire5.png";
import { FaRegClock } from "react-icons/fa";
import { Link } from "react-router-dom";
import { useWallet } from "../contexts/WalletContext";
import { createQR, encodeURL } from "@solana/pay";
import { PublicKey, LAMPORTS_PER_SOL } from "@solana/web3.js";
import BigNumber from "bignumber.js";
import AdBanner from "../components/AdBanner";
import SearchBarBoost from "../components/SearchBarBoost";
import {
  Connection,
  Transaction,
  TransactionInstruction,
  SystemProgram,
} from "@solana/web3.js";
import { Buffer } from "buffer";

window.Buffer = Buffer; // Make Buffer available globally in the window object

const GoldenTickerText = () => (
  <div
    className="golden-ticker-text"
    style={{
      background: "linear-gradient(45deg, #FF9900, #FFF000",
      WebkitBackgroundClip: "text",
      WebkitTextFillColor: "transparent",
      backgroundClip: "text",
      fontWeight: "bold",
      fontSize: "1.3rem",
      padding: "0.5rem 0",
      textAlign: "center",
      width: "100%",
    }}
  >
    + Golden Ticker
  </div>
);

const BoostPage = ({ setShowAuthModal }) => {
  const qrRef = useRef(null);
  const [payButton, setPayButton] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [selectedTokenId, setSelectedTokenId] = useState(null);
  const [isTermsAccepted, setIsTermsAccepted] = useState(false);
  const [qrCode, setQrCode] = useState(null); // Store QR Code image URL
  const [loading, setLoading] = useState(false);
  const [selectedTier, setSelectedTier] = useState(null); // Store selected tier
  const modalRef = useRef(null);
  const [paymentStatus, setPaymentStatus] = useState(null); // 'pending', 'success', 'failed'
  const { isAuthenticated, walletAddress } = useWallet();
  const paymentCheckActive = useRef(false);
  const [countdown, setCountdown] = useState(20); // Initialize with 20 seconds
  const handleTokenSelect = (token) => {
    if (!token) {
      console.log("Selection cleared");
      setSelectedTokenId(null);
      return;
    }
    console.log("Selected token:", token);
    setSelectedTokenId(token._id);
  };

  let paymentData = {};

  const handleBuyNowClick = (tier) => {
    if (!isAuthenticated) {
      setShowAuthModal(true); // Trigger AuthModal if not authenticated
      return;
    }
    setSelectedTier(tier);
    setShowModal(true);
  };

  useEffect(() => {
    // Only generate QR after the modal is shown and qrRef is available
    if (showModal && qrRef.current && qrCode) {
      const timeoutId = setTimeout(() => {
        if (qrRef.current) {
          qrRef.current.innerHTML = ""; // Clear previous QR codes
          const qr = createQR(qrCode, 256); // Generate QR code from the URL
          qr.append(qrRef.current); // Append QR to the div
          setPaymentStatus("pending");
        } else {
          console.error("QR container not found.");
        }
      }, 300); // Wait a bit to ensure the modal is fully rendered

      return () => clearTimeout(timeoutId); // Cleanup timeout on unmount
    }
  }, [showModal, qrCode]); // Re-run when modal is shown or qrCode changes

  const handleCloseModal = () => {
    paymentCheckActive.current = false;
    setShowModal(false);
    setPaymentStatus(null);
    setQrCode(null); // Reset QR code when closing modal
  };

  const handleTermsChange = () => {
    setIsTermsAccepted((prev) => !prev);
  };

  const checkPaymentStatus = async (memo) => {
    paymentCheckActive.current = true; // Start checking
    const interval = 20000; // 20 seconds
    const timeout = 60001; // 100 seconds
    let elapsedTime = 0;

    const checkInterval = setInterval(async () => {
      if (!paymentCheckActive.current) {
        clearInterval(checkInterval);
        return;
      }
      try {
        console.log(paymentData);
        const response = await fetch(
          `https://coinfinder-93a4f08e9458.herokuapp.com/api/payment/payment-status/${memo}`,
          {
            method: "POST",
            headers: {
              "ngrok-skip-browser-warning": "69420",
              "Content-Type": "application/json",
            },
            body: JSON.stringify(paymentData),
          }
        );
        const data = await response.json();

        if (data.status === "completed") {
          setPaymentStatus("success");
          clearInterval(checkInterval);
          alert("Payment successful!");
        }
      } catch (error) {
        console.error("Error checking payment status:", error);
      }

      elapsedTime += interval;
      if (elapsedTime >= timeout) {
        setPaymentStatus("failed");
        clearInterval(checkInterval);
        alert(
          'Transaction not found. If you successfully paid, please wait for a confirmation in the "My boosts" section in your Dashboard'
        );
      }
    }, interval);

    const startCountdown = () => {
      setCountdown(20); // Set initial state to 20

      const countdownInterval = setInterval(() => {
        setCountdown((prev) => {
          if (prev <= 1) {
            clearInterval(countdownInterval);
            // Reset after a short delay or immediately:
            setTimeout(() => startCountdown(), 1000); // Restart the countdown after 1 second
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    };

    startCountdown();

    // Wait 5 seconds before starting the interval
    await new Promise((resolve) => setTimeout(resolve, interval));

    // Keep checking the payment status every 20 seconds
  };

  const handleConfirmPurchase = async () => {
    if (!isTermsAccepted) {
      alert("You must agree to the terms and conditions.");
      return;
    }
    if (!selectedTokenId) {
      alert("Please select a token before continuing.");
      return;
    }

    setLoading(true);
    console.log("Starting purchase process for tier:", selectedTier);

    if (!selectedTier) {
      alert("Please select a tier before proceeding.");
      setLoading(false);
      return;
    }

    try {
      const wallet = walletAddress;
      const response = await fetch(
        "https://coinfinder-93a4f08e9458.herokuapp.com/api/payment/",
        {
          method: "POST",
          headers: {
            "ngrok-skip-browser-warning": "69420",
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ wallet, tier: selectedTier }),
        }
      );

      if (!response.ok) throw new Error("Payment request failed");

      const data = await response.json();
      console.log("API Response:", data);

      paymentData = {
        walletAddress,
        memo: data.memo,
        tier: selectedTier,
        amount: data.amountInSol,
        status: "completed",
      };

      try {
        const solAmount = new BigNumber(data.amountInSol);
        const lamports = solAmount.multipliedBy(LAMPORTS_PER_SOL);
        const recipient = new PublicKey(data.recipient);
        console.log("Amount in SOL:", solAmount.toString());
        console.log("Amount in lamports:", lamports.toString());

        let paymentUrl = encodeURL({
          recipient,
          amount: solAmount,
          label: "Boost Payment",
          memo: `${data.memo},${selectedTokenId}`,
          message: `Payment for Tier ${selectedTier}`,
        }).toString();

        console.log("Payment URL created:", paymentUrl);
        setQrCode(paymentUrl);

        setPayButton(paymentUrl);
        const paymentMemo = `${data.memo},${selectedTokenId}`;
        console.log("Payment memo:", paymentMemo);
        checkPaymentStatus(paymentMemo);
        // Check if Phantom is available
        if (window.solana && window.solana.isPhantom) {
          try {
            // Connect to the Phantom wallet
            await window.solana.connect();

            const fromAddress = window.solana.publicKey.toString();
            console.log("Connected to Phantom wallet:", fromAddress);
            
            // Create a connection to the Solana network
            const connection = new Connection(process.env.REACT_APP_QUICKNODE_ENDPOINT);
            
            // Fetch the recent blockhash
            const { blockhash } = await connection.getLatestBlockhash();
            console.log("Recent Blockhash:", blockhash);

            // Create a new transaction
            const transaction = new Transaction();

            // Set the recent blockhash and fee payer
            transaction.recentBlockhash = blockhash;
            transaction.feePayer = new PublicKey(fromAddress);

            // Add the transfer instruction
            transaction.add(
              SystemProgram.transfer({
                fromPubkey: new PublicKey(fromAddress),
                toPubkey: recipient,
                lamports: lamports.toString(),
              })
            );

            // Add memo instruction
            transaction.add(
              new TransactionInstruction({
                keys: [
                  {
                    pubkey: new PublicKey(fromAddress),
                    isSigner: true,
                    isWritable: true,
                  },
                ],
                programId: new PublicKey(
                  "MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr"
                ),
                data: Buffer.from(paymentMemo),
              })
            );

            // Sign and send the transaction
            const signature = await window.solana.signAndSendTransaction(
              transaction
            );
            console.log("Transaction sent with signature:", signature);

            // You can also check the transaction status here if needed
          } catch (error) {
            console.error("Error with Phantom wallet payment:", error);
          }
        } else {
          alert(
            "Phantom wallet not detected. Please install Phantom wallet extension."
          );
        }
      } catch (urlError) {
        console.error("Error creating QR code:", urlError);
        throw urlError;
      }
    } catch (error) {
      console.error("Payment request failed:", error);
      alert("Error processing payment. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (showModal) {
      document.body.style.overflow = "hidden"; // Disable scroll
    } else {
      document.body.style.overflow = "auto"; // Enable scroll
    }

    // Cleanup on component unmount
    return () => {
      document.body.style.overflow = "auto";
    };
  }, [showModal]);

  // Close modal if clicked outside
  const handleClickOutside = (e) => {
    // Check if the click is within the modal itself
    const isWithinModal =
      modalRef.current && modalRef.current.contains(e.target);

    // Check if the click is within any part of the Select component
    const isWithinSelect =
      e.target.closest(".select__control") ||
      e.target.closest(".select__menu") ||
      e.target.closest(".select__menu-list") ||
      e.target.closest(".select__indicators") ||
      e.target.closest(".select__indicator") ||
      e.target.closest(".select__clear-indicator");

    if (!isWithinModal && !isWithinSelect) {
      handleCloseModal();
    }
  };
  useEffect(() => {
    if (showModal) {
      document.addEventListener("mousedown", handleClickOutside);
    } else {
      document.removeEventListener("mousedown", handleClickOutside);
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [showModal]);

  const cards = [
    {
      id: 1,
      title: "Tier 1",
      duration: "3 days",
      quantity: "100x",
      imageUrl: Fire1,
      buyUrl: "/buy-now/1",
      size: "40%",
      price: "19",
    },
    {
      id: 2,
      title: "Tier 2",
      duration: "3 days",
      quantity: "300x",
      imageUrl: Fire2,
      buyUrl: "/buy-now/2",
      size: "55%",
      price: "39",
    },
    {
      id: 3,
      title: "Tier 3",
      duration: "5 days",
      quantity: "500x",
      imageUrl: Fire3,
      buyUrl: "/buy-now/3",
      size: "65%",
      price: "59",
    },
    {
      id: 4,
      title: "Tier 4",
      duration: "7 days",
      quantity: "1000x",
      imageUrl: Fire4,
      buyUrl: "/buy-now/4",
      size: "60%",
      hasGoldenTicker: true,
      price: "99",
    },
    {
      id: 5,
      title: "Tier 5",
      duration: "10 days",
      quantity: "3000x",
      imageUrl: Fire5,
      buyUrl: "/buy-now/5",
      size: "100%",
      hasGoldenTicker: true,
      price: "199",
    },
  ];

  return (
    <>
    <title>CoinFinder - Boost Your Coin</title>
      <meta name="description" content="Boost the visibility of your coin with CoinFinder's premium boost options." />
      <link rel="canonical" href="https://coinfinder.fun/boost"/>
      {/* Open Graph Meta Tags (for social media previews) */}
      <meta property="og:title" content="CoinFinder - Boost Your Coin" />
      <meta property="og:description" content="Boost the visibility of your coin with CoinFinder's premium boost options." />
      <meta property="og:image" content="/logoMGV.png" />
      <meta property="og:url" content="https://coinfinder.fun/boost" />
      <meta property="og:type" content="website" />
    <div className="home-container">
      <div
        className="content-wrapper"
        style={{
          display: "flex",
          alignItems: "flex-start",
          marginTop: "2rem",
        }}
      >
        <AdBanner />
        <div className="main-content" style={{ flex: 1 }}>
          <div className="hero-section">
            <h1 id="desktop-title">
              <span className="highlight">Boost </span>Your Crypto Project{" "}
              <br />
              to the <span className="highlight">Top</span>
            </h1>
            <h1 id="mobile-title">
              <span className="highlight">Boost </span>Your Crypto Project
              to the <span className="highlight">Top</span>
            </h1>
            <p>Stand Out. Get Noticed. Gain Traction.</p>
            <br />
            <br />
            <p className="sub">
              Make your project the <span className="high">star</span> of the
              show by boosting it to the top of the trending list. More
              visibility, more investors, and{" "}
              <span className="high">more growth</span> await!
            </p>
            <br />
            <p className="sub">
              Curious about how the Trending Score is calculated?{" "}
              <Link to="/FAQ" className="faq-link">
                Check our FAQ.
              </Link>
            </p>
          </div>
        </div>
      </div>
      <div className="cards-section">
        {cards.map((card) => (
          <div
            key={card.id}
            className="card"
            style={{
              height: "30rem",
              display: "flex",
              flexDirection: "column",
            }}
          >
            <div>
              <div className="card-title">{card.title}</div>
              <div className="card-subtitle">
                <FaRegClock className="clock-icon" />
                <span>{card.duration}</span>
              </div>
            </div>
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                flexGrow: 1,
                justifyContent: "flex-end",
              }}
            >
              <div>
                <div className="card-image-container">
                  <img
                    src={card.imageUrl}
                    alt={`Card ${card.id}`}
                    style={{
                      width: card.size,
                      height: "auto",
                      objectFit: "contain",
                    }}
                  />
                </div>
                <div>
                  <div className="card-quantity">{card.quantity}</div>
                  {card.hasGoldenTicker && <GoldenTickerText />}
                </div>
                <div className="card-button-container">
                  <button
                    onClick={() => handleBuyNowClick(card.id)}
                    className="buy-button"
                    type="button"
                  >
                    Buy Now
                  </button>
                  {/* Price text (for display only) */}
                  <div className="card-price-text">
                    <span>${card.price}</span> {/* Placeholder price */}
                  </div>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {showModal && (
        <div className="modal-overlay">
          <div ref={modalRef} className="modal-content premium-modal">
            <div className="premium-modal-header">
              <h2 className="premium-modal-title">Complete Your Payment</h2>
            </div>

            <div className="premium-modal-body">
              <div className="premium-checkbox-wrapper">
                <div className="premium-checkbox">
                  <input
                    type="checkbox"
                    id="termsCheckbox"
                    checked={isTermsAccepted}
                    onChange={handleTermsChange}
                  />
                  <label htmlFor="termsCheckbox">
                    I agree to the{" "}
                    
                    <Link to="/termsofservice" className="premium-link" target="_blank" rel="noopener">
                                Terms of Service
                              </Link>.
                  </label>
                </div>
              </div>

              <div className="premium-token-selection">
                <p className="premium-label">
                  Please select the token you want to boost:
                </p>
                <div className="premium-search-wrapper">
                  <SearchBarBoost onTokenSelect={handleTokenSelect} />
                </div>
              </div>

              {!qrCode ? (
                <div className="premium-action-buttons">
                  <button
                    className="premium-button secondary"
                    onClick={handleCloseModal}
                  >
                    Cancel
                  </button>
                  <button
                    className={`premium-button primary ${
                      !isTermsAccepted || !selectedTokenId || loading
                        ? "disabled"
                        : ""
                    }`}
                    onClick={handleConfirmPurchase}
                    disabled={!isTermsAccepted || !selectedTokenId || loading}
                  >
                    {loading ? "Processing..." : "Continue"}
                  </button>
                </div>
              ) : (
                <div className="premium-qr-container">
                  <p className="premium-qr-instruction">
                    If you prefer, scan this QR code to complete your payment:
                  </p>

                  <div ref={qrRef} className="premium-qr-code"></div>

                  {paymentStatus === "pending" && (
                    <p className="premium-status pending">
                      Checking payment status in {countdown} seconds...
                    </p>
                  )}
                  {paymentStatus === "failed" && (
                    <p className="premium-status failed">
                      Transaction not found. If you successfully paid, please
                      wait for a confirmation in the "My boosts" section in your
                      Dashboard.
                    </p>
                  )}
                  {paymentStatus === "success" && (
                    <p className="premium-status success">
                      Payment successful! Thank you for your purchase.
                    </p>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
      {/* Add a blurred background when the modal is open */}
      <img src={logoMGV} alt="logoMGV" id="logoMGV" />
    </div>
    </>
  );
};

export default BoostPage;
