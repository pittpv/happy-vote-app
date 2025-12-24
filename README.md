# 😄 Happy Vote MiniApp

A standalone lightweight miniapp that lets users vote on how they feel — either "Happy" 😊 or "Sad" 😢 — once every 24 hours. Built on the **Monad** blockchain using a Solidity smart contract.

## 📦 Features

- Two voting buttons: **"I'm Happy"** and **"I'm Sad"**
- Real-time percentage counter showing happy/sad votes
- Leaderboard 
- Users can only vote once per 24 hours (on-chain enforcement)
- Built with **React** + **Ethers.js**

## 🚀 Updates

### Latest update (24-12-2025)

- Added support for Base network
- Contract [verified](#base)

### Latest update (23-12-2025)

- Added support for Ethereum and Sepolia networks
- Contracts [verified](#ethereum)

### Latest update (17-12-2025)

- The updated contract for the testnet has been deployed after the Monad Testnet Re-Genesis.
- The `VotesInitialized` function has been added to the contract to transfer the number of votes from the snapshot (the function can only be called over and only once).
- Votes transferred to the new contract

### Previous update (29-11-2025)

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

### Security Updates (29-11-2025)

- **RPC Endpoint Protection**: 
  - Whitelist validation for RPC endpoints to prevent endpoint substitution attacks
  - Only allows HTTPS connections to authorized Monad RPC servers
  - Validates all RPC URLs before creating network clients
  
- **XSS Prevention**: 
  - All user-facing messages are sanitized to prevent cross-site scripting attacks
  - Removes HTML tags, JavaScript protocols, and event handlers from error messages
  - Message length limits to prevent DoS attacks
  
- **ABI Validation**: 
  - Validates ABI structure before contract interactions to prevent malicious ABI injection
  - Ensures only valid contract interfaces are used for read/write operations
  - Protects against corrupted or malicious ABI data
  
- **Timer Protection**: 
  - Validates and bounds timer values to prevent timer manipulation attacks
  - Limits timer duration to reasonable ranges (0 to 1 year)
  - Prevents negative or excessive timer values
  
- **DOM Security**: 
  - Validates all DOM selectors and elements before manipulation
  - Checks element types and node types to prevent DOM-based attacks
  - Validates querySelector results and element properties before use

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

### Monad

Mainnet `contracts/HappyVoteLeaderboard.sol`, [Verified](https://monadscan.com/address/0xdFFEFD8eF040702A4657a98f189860169104257A#code)

Testnet `contracts/HappyVote-Re-Genesis.sol`, [Verified](https://monad-testnet.socialscan.io/address/0x40198e59306181e69affa25c69c5ba50f8f4cd0e#contract)  

### Ethereum

Mainnet `contracts/HappyVoteLeaderboard.sol`, [Verified](https://eth.blockscout.com/address/0x718E4a1FDd2467C825D1Dd3d56B4f7320C2fF45C?tab=contract)

Sepolia `contracts/HappyVoteLeaderboard.sol`, [Verified](https://eth-sepolia.blockscout.com/address/0x21204825a0a542aBe26Cc034B3De1D92c5c989E3?tab=contract_code)

### Base

Mainnet `contracts/HappyVoteLeaderboard.sol`, [Verified](https://repo.sourcify.dev/8453/0xAbb75Eb3E914418a85044Ad4D77886d116Ff454D)

## ✍️ Feedback

Any questions, bug report or feedback:

https://t.me/+DLsyG6ol3SFjM2Vk

https://x.com/pittpv
