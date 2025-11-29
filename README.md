# 😄 Happy Vote MiniApp

A standalone lightweight miniapp that lets users vote on how they feel — either "Happy" 😊 or "Sad" 😢 — once every 24 hours. Built on the **Monad** blockchain using a Solidity smart contract.

## 📦 Features

- Two voting buttons: **"I'm Happy"** and **"I'm Sad"**
- Real-time percentage counter showing happy/sad votes
- Leaderboard 
- Users can only vote once per 24 hours (on-chain enforcement)
- Built with **React** + **Ethers.js**

## 🚀 Updates

### Latest update (29-11-2025)

- **Gas Refund Feature**: Optional gas fee reimbursement for voting transactions
  - Automatically enabled/disabled by contract owner
  - Visual badge indicator when refund is active
  - Tooltip with detailed explanation
  - Works for both Happy and Sad votes
- **Optimized Gas Limits**: Improved transaction success rate for both MetaMask and WalletConnect
- **Enhanced Transaction Handling**: 
  - Better error handling for user-rejected transactions
  - Prevents duplicate transactions on cancellation
  - Improved logging for debugging
- **Wallet Type Detection**: Fixed wallet type detection to correctly identify MetaMask vs WalletConnect connections

### Previous update (27-11-2025)

- **Network selector**: Choose between Monad Mainnet and Testnet with visual network badges
- **Leaderboard**: Top 10 happy voters leaderboard on mainnet with scrollable list
- **Read-only mode**: View voting results and leaderboard without wallet connection
- **Redesigned controls**: Compact floating control panel in top-right corner with:
  - Network selector with custom dropdown and network icons
  - Unified Connect Wallet button (opens WalletConnect modal)
  - Theme toggle button
  - All buttons in consistent style with equal height
- **Mobile optimization**: Fully responsive design with optimized spacing and compact controls
- **App description**: Added descriptive text under the main title
- **Improved UX**: Voting buttons and statistics visible without wallet connection; connection required only for voting/donating

### Previous updates (25-11-2025)

- Monad **mainnet** & testnet support
- **Dark/Light theme toggle** 🌙☀️
- **WalletConnect** integration

## 🎨 Themes
- **Light Theme**: Clean, modern design with light colors
- **Dark Theme**: Dark background with high contrast for better night viewing
- **Auto-detection**: Automatically detects system theme preference
- **Persistent**: Theme choice is saved in localStorage

## 🔗 Wallet Integration
- **MetaMask**: Direct browser extension connection
- **WalletConnect**: Mobile wallet support via QR code (300+ wallets supported)
- **Network switching**: Automatic Monad Testnet detection and switching
- **Multi-wallet support**: Choose between MetaMask and WalletConnect
- **Mobile-friendly**: WalletConnect enables mobile wallet connections

## 🧱 Smart Contract

Mainnet `contracts/HappyVoteLeaderboard.sol`, [Verified](https://monadscan.com/address/0xdFFEFD8eF040702A4657a98f189860169104257A#code)

Testnet `contracts/HappyVote.sol` 

## ✍️ Feedback

Any questions, bug report or feedback:

https://t.me/+DLsyG6ol3SFjM2Vk

https://x.com/pittpv
