import React, { useState } from "react";
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import { WalletProvider, useWallet } from "./contexts/WalletContext";
import { TokenProvider } from "./contexts/TokenContext";
import Navbar from "./components/Navbar";
import HomePage from "./pages/HomePage";
import BoostPage from "./pages/Boost";
import Footer from "./components/Footer";
import Form from "./pages/Form";
import PrivateRoute from "./components/PrivateRoute";
import Dashboard from "./pages/Dashboard";
import AuthModal from "./components/AuthModal";
import Faq from "./pages/Faq.js"; 
import AdminDashboard from "./components/Admin/AdminDashboard";
import "./App.css";
import ContactUs from "./pages/ContactUs";
import PrivacyPolicy from "./pages/PrivacyPolicy";
import TermsOfService from "./pages/TermsOfService";
import NotFound from "./pages/NotFound"; 
import AdminRoute from "./components/Admin/AdminRoute";
import { FingerprintProvider } from "./contexts/FingerprintContext.js";
import { AdsProvider } from "./contexts/AdsContext.js";
import { Analytics } from "@vercel/analytics/react";
import ComingSoon from "./components/ComingSoon";

const COMING_SOON = process.env.REACT_APP_COMING_SOON === 'true';

const AppContent = () => {
  const { isAuthenticated, isLoading, showAuthModal, setShowAuthModal, isAdmin } = useWallet(); // Get auth state from WalletContext
  

  if (isLoading) {
    return <div></div>; // Show loading screen while verifying token
  }

  if (COMING_SOON) {
    return <ComingSoon />;
  }

  return (
    <Router>
      <div className="app-container">
        <Navbar
          isAuthenticated={isAuthenticated}
          isLoading={isLoading}
          setShowAuthModal={setShowAuthModal}
        />

        <main className="main-content">
          <Routes>
            <Route path="/" element={<HomePage setShowAuthModal={setShowAuthModal} />} />
            <Route path="/FAQ" element={<Faq />} />
            <Route path="/privacypolicy" element={<PrivacyPolicy />} />
            <Route path="/termsofservice" element={<TermsOfService />} />
            <Route path="/contactus" element={<ContactUs />} />
            <Route path="/boost" element={<BoostPage setShowAuthModal={setShowAuthModal} />} />
            <Route path="/admin" element={
                
                  <AdminDashboard />
                
              } />
            <Route
              path="/dashboard"
              element={
                <PrivateRoute isAuthenticated={isAuthenticated} isLoading={isLoading} setShowAuthModal={setShowAuthModal}>
                  <Dashboard />
                </PrivateRoute>
              }
            />
            <Route
              path="/form"
              element={
                <PrivateRoute isAuthenticated={isAuthenticated} isLoading={isLoading} setShowAuthModal={setShowAuthModal}>
                  <Form />
                </PrivateRoute>
              }
            />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </main>

        {showAuthModal && (
          <AuthModal
            onClose={() => setShowAuthModal(false)}
            onAuthSuccess={() => setShowAuthModal(false)}
          />
        )}
        
        <Footer />
        <Analytics/>
      </div>
    </Router>
  );
};

const App = () => {
  return (
    
    <AdsProvider>
    <WalletProvider>
      <FingerprintProvider>
      <TokenProvider> {/* Ensure TokenProvider wraps everything if needed */}
        <AppContent />
      </TokenProvider>
      </FingerprintProvider>
    </WalletProvider>
    </AdsProvider>
    
  );
};

export default App;
