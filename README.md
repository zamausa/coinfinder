# Coinfinder

This repository contains selected frontend and backend files from Coinfinder, provided for the Phantom Wallet review.

## Overview

Coinfinder is a platform that helps users discover upcoming tokens while providing visibility for token creators. We use **Phantom Wallet for authentication and payments** to ensure secure interactions.

## Authentication

Phantom Wallet is required for users to:
- Submit their upcoming token
- Access their dashboard
- Boost a token

### Relevant files:
- **Frontend**: `authmodal.js` (handles authentication UI and logic)
- **Backend**: `auth.js` (manages authentication on the server side)

## Payments & Boosting

Users can boost their tokens through Phantom Wallet transactions.

### Relevant files:
- **Frontend**: `boost.js` (renders the UI at coinfinder.fun/boost)
- **Backend**: `payment.js` (handles payment processing)

---

If you require additional details, feel free to reach out.
