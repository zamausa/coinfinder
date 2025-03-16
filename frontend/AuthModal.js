import React, { useState, useEffect } from "react";
import { useWallet } from "../contexts/WalletContext";
import "../styles/AuthModal.css";
import phantomlogo from "../static/phantom.png";
import metamasklogo from "../static/metamask.png";
import walletconnectlogo from "../static/walletconnect.png";
import FingerprintJS from '@sparkstone/fingerprintjs'
import { useFingerprint } from "../contexts/FingerprintContext";

const AuthModal = ({ onClose, onAuthSuccess }) => {
  const { setWalletAddress, setIsAuthenticated } = useWallet();
  const [isMobile, setIsMobile] = useState(false);
  const [isPhantomBrowser, setIsPhantomBrowser] = useState(false);

const { setVisitorId } = useFingerprint();

  useEffect(() => {
    document.body.style.overflow = "hidden";  // Disable scrolling
    return () => {
      document.body.style.overflow = "auto";  // Restore scrolling on unmount
    };
  }, []);


  // Detect if user is on mobile and if they're using Phantom's in-app browser
  useEffect(() => {
    const checkMobile = () => {
      const userAgent = navigator.userAgent || navigator.vendor || window.opera;
      const mobileRegex = /android|iPad|iPhone|iPod|webOS|BlackBerry|IEMobile|Opera Mini/i;
      setIsMobile(mobileRegex.test(userAgent));
      
      // Check if we're inside Phantom's in-app browser
      const isPhantomApp = userAgent.includes('Phantom') || 
                          window.location.href.includes('phantom.app');
      setIsPhantomBrowser(isPhantomApp);
    };
    
    checkMobile();
  }, []);

  const connectPhantom = async () => {
    // If on mobile but not in Phantom browser, redirect to Phantom app
    if (isMobile && !isPhantomBrowser && !window.solana) {
      const currentUrl = encodeURIComponent(window.location.href);
      const refUrl = encodeURIComponent(window.location.origin);
      window.location.href = `https://phantom.app/ul/browse/${currentUrl}?ref=${refUrl}`;
      return;
    }

    // Regular flow for desktop or when already in Phantom browser
    if (!window.solana || !window.solana.isPhantom) {
      if (isMobile) {
        alert("Please open this site in the Phantom mobile app's browser");
      } else {
        alert("Phantom Wallet not found! Install it from https://phantom.app");
      }
      return;
    }

    try {
      const response = await window.solana.connect();
      const publicKey = response.publicKey.toString();
      
      // Step 1: Request challenge message from backend
      const challengeRes = await fetch("https://coinfinder-93a4f08e9458.herokuapp.com/api/auth/challenge", {
        method: "POST",
        headers: {
          "ngrok-skip-browser-warning": "69420",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ publicKey }),
      });

      if (!challengeRes.ok) throw new Error("Failed to get challenge message");

      const { message } = await challengeRes.json();

      // Step 2: Sign the challenge message with Phantom
      const signedMessage = await window.solana.signMessage(
        new TextEncoder().encode(message),
        "utf8"
      );

      const signature = Array.from(signedMessage.signature); // Convert to array for backend
      const fp = await FingerprintJS.load();
          const result = await fp.get();
              setVisitorId(result.visitorId);
      console.log(result.visitorId);
      // Step 3: Send signed message to backend for verification
      const verifyRes = await fetch("https://coinfinder-93a4f08e9458.herokuapp.com/api/auth/verify", {
        method: "POST",
        headers: {
          "ngrok-skip-browser-warning": "69420",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ visitorId: result.visitorId, publicKey, signature }),
        credentials: "include", // ✅ Ensure cookies are sent with the request
      });

      if (!verifyRes.ok) throw new Error("Verification failed");

      const { token } = await verifyRes.json();
      
      // ✅ Update global auth state
      setIsAuthenticated(true);
      setWalletAddress(publicKey);

      // ✅ Trigger callback to update UI
      if (onAuthSuccess) onAuthSuccess();

      // ✅ Close modal after success
      onClose();

      
    } catch (err) {
      console.error("Wallet connection failed", err);
      alert("Authentication failed. Please try again.");
    }
  };

  return (
    <div className="auth-modal-overlay">
      <div className="auth-modal">
        <span className="close-btn" onClick={onClose}>&times;</span>
        <h2>Connect Your Wallet</h2>
        <div className="auth-buttons">
          <button className="phantom-btn" onClick={connectPhantom}>
            <img src={phantomlogo} alt="Phantom" className="auth-icon" />
            Connect Phantom
            {isMobile && !isPhantomBrowser && !window.solana && " (Open in App)"}
          </button>
          
          <button className="metamask-btn" onClick={() => alert("MetaMask integration coming soon!")}>
            <img src={metamasklogo} alt="MetaMask" className="auth-icon" />
            Connect MetaMask
          </button>
          
          <button className="walletconnect-btn" onClick={() => alert("WalletConnect integration coming soon!")}>
            <img src={walletconnectlogo} alt="WalletConnect" className="auth-icon" />
            Connect WalletConnect
          </button>
        </div>
        
        {isMobile && !isPhantomBrowser && 
          <p className="mobile-note">
            For the best experience, please open this page in the Phantom app's browser.
          </p>
        }
      </div>
    </div>
  );
};

export default AuthModal;