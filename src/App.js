import React, { useState, useEffect, useCallback } from "react";
import { ethers } from "ethers";
import abi from "./abi.json";
import "./App.css";
import { openConnectModal } from "./walletProvider";
import { useAccount, useDisconnect, useChainId, useSwitchChain, useWalletClient, usePublicClient } from 'wagmi';

const contractAddress = "0x7fB4F5Fc2a6f2FAa86F5F37EAEE8A0db820ad9E0";
const monadChainId = 10143;
const monadChainHex = "0x279f";

function App() {
  // Wagmi hooks
  const { address, isConnected } = useAccount();
  const { disconnect } = useDisconnect();
  const chainId = useChainId();
  const { switchChain } = useSwitchChain();
  const { data: walletClient } = useWalletClient();
  const publicClient = usePublicClient({ chainId: monadChainId });
  
  const [provider, setProvider] = useState(null);
  const [contract, setContract] = useState(null);
  const [account, setAccount] = useState(null);
  const [networkCorrect, setNetworkCorrect] = useState(null);
  const [happyVotes, setHappyVotes] = useState(0);
  const [sadVotes, setSadVotes] = useState(0);
  const [canVote, setCanVote] = useState(false);
  const [timeLeft, setTimeLeft] = useState(null);
  const [loading, setLoading] = useState({
    wallet: false,
    network: false,
    voting: false,
    donation: false,
  });
  const [message, setMessage] = useState(null);
  const [isDarkTheme, setIsDarkTheme] = useState(false);
  const [walletType, setWalletType] = useState(null); // 'metamask' or 'walletconnect'

  // Theme management
  const toggleTheme = useCallback(() => {
    const newTheme = !isDarkTheme;
    setIsDarkTheme(newTheme);
    localStorage.setItem('theme', newTheme ? 'dark' : 'light');
    document.body.classList.toggle('dark-theme', newTheme);
  }, [isDarkTheme]);

  // Initialize theme from localStorage
  useEffect(() => {
    const savedTheme = localStorage.getItem('theme');
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    const shouldUseDark = savedTheme === 'dark' || (!savedTheme && prefersDark);
    
    setIsDarkTheme(shouldUseDark);
    document.body.classList.toggle('dark-theme', shouldUseDark);
  }, []);

  const formatTime = useCallback((sec) => {
    const h = Math.floor(sec / 3600);
    const m = Math.floor((sec % 3600) / 60);
    const s = sec % 60;
    return `${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  }, []);

  const showMessage = useCallback((text, type = "info", duration = 5000) => {
    setMessage({ text, type });
    if (duration > 0) {
      setTimeout(() => setMessage(null), duration);
    }
  }, []);

  const checkNetwork = useCallback(async (providerToCheck) => {
    try {
      if (!providerToCheck) return false;
      const network = await providerToCheck.getNetwork();
      const correct = Number(network.chainId) === monadChainId;
      setNetworkCorrect(correct);
      return correct;
    } catch (e) {
      console.error("Network check failed", e);
      setNetworkCorrect(false);
      return false;
    }
  }, []);

  const initProvider = useCallback(async () => {
    if (!window.ethereum) {
      showMessage("Please install MetaMask", "error");
      return null;
    }
    const newProvider = new ethers.BrowserProvider(window.ethereum);
    setProvider(newProvider);
    await checkNetwork(newProvider);
    return newProvider;
  }, [checkNetwork, showMessage]);

  const fetchWalletConnectState = useCallback(async () => {
    if (!publicClient || !account) return;

    try {
      const [happy, sad] = await publicClient.readContract({
        abi,
        address: contractAddress,
        functionName: "getVotes",
      });
      setHappyVotes(Number(happy));
      setSadVotes(Number(sad));

      const walletCanVote = await publicClient.readContract({
        abi,
        address: contractAddress,
        functionName: "canVote",
        args: [account],
      });
      setCanVote(Boolean(walletCanVote));

      if (!walletCanVote) {
        const seconds = await publicClient.readContract({
          abi,
          address: contractAddress,
          functionName: "timeUntilNextVote",
          args: [account],
        });
        setTimeLeft(Number(seconds));
      } else {
        setTimeLeft(null);
      }
    } catch (err) {
      console.error("WalletConnect state sync failed:", err);
      showMessage("Failed to refresh vote stats", "error");
    }
  }, [account, publicClient, showMessage]);

  const initContract = useCallback(async (provider, account) => {
    try {
      let signer;
      if (walletType === 'walletconnect') {
        await fetchWalletConnectState();
        return null;
      } else {
        // Для MetaMask используем стандартный подход
        signer = await provider.getSigner();
        const contract = new ethers.Contract(contractAddress, abi, signer);
        setContract(contract);

        const [happy, sad] = await contract.getVotes();
        setHappyVotes(Number(happy));
        setSadVotes(Number(sad));

        const canVote = await contract.canVote(account);
        setCanVote(canVote);

        if (!canVote) {
          const seconds = await contract.timeUntilNextVote(account);
          setTimeLeft(Number(seconds));
        }

        return contract;
      }
    } catch (err) {
      console.error("Contract initialization failed:", err);
      showMessage("Failed to initialize contract", "error");
    }
  }, [showMessage, walletType, fetchWalletConnectState]);

  const connectMetaMask = useCallback(async () => {
    if (!window.ethereum) {
      showMessage("Please install MetaMask", "error");
      return;
    }

    setLoading((prev) => ({ ...prev, wallet: true }));

    try {
      const accounts = await window.ethereum.request({ method: "eth_requestAccounts" });
      const selectedAccount = accounts[0];
      setAccount(selectedAccount);
      setWalletType('metamask');

      const provider = await initProvider();
      if (!provider) return;

      const isCorrect = await checkNetwork(provider);
      if (!isCorrect) return;

      await initContract(provider, selectedAccount);
      showMessage("MetaMask connected", "success");
    } catch (err) {
      showMessage("Failed to connect MetaMask", "error");
      console.error(err);
    } finally {
      setLoading((prev) => ({ ...prev, wallet: false }));
    }
  }, [checkNetwork, initProvider, initContract, showMessage]);

  const connectWalletConnect = useCallback(() => {
    setWalletType('walletconnect');
    openConnectModal();
  }, []);

  const connectWallet = useCallback((type) => {
    if (type === 'metamask') {
      connectMetaMask();
    } else if (type === 'walletconnect') {
      connectWalletConnect();
    }
  }, [connectMetaMask, connectWalletConnect]);

  const switchToMonadNetwork = useCallback(async () => {
    try {
      setLoading((prev) => ({ ...prev, network: true }));

      if (walletType === 'walletconnect' && switchChain) {
        // Для WalletConnect используем wagmi switchChain
        await switchChain({ chainId: monadChainId });
        setNetworkCorrect(true);
        showMessage("Switched to Monad Testnet", "success");
      } else if (window.ethereum) {
        // Для MetaMask используем стандартный метод
        await window.ethereum.request({
          method: "wallet_switchEthereumChain",
          params: [{ chainId: monadChainHex }],
        });
      }
    } catch (switchError) {
      if (switchError.code === 4902 && window.ethereum) {
        // Добавляем сеть если её нет
        await window.ethereum.request({
          method: "wallet_addEthereumChain",
          params: [{
            chainId: monadChainHex,
            chainName: "Monad Testnet",
            rpcUrls: ["https://testnet-rpc.monad.xyz/"],
            nativeCurrency: { name: "Monad", symbol: "MON", decimals: 18 },
            blockExplorerUrls: ["https://testnet.monadexplorer.com/"],
          }],
        });
      } else {
        showMessage("Failed to switch network", "error");
        return;
      }
    }

    if (walletType === 'metamask') {
      const updatedProvider = new ethers.BrowserProvider(window.ethereum);
      setProvider(updatedProvider);
      await checkNetwork(updatedProvider);
      if (account) await initContract(updatedProvider, account);
    }
  }, [account, checkNetwork, initContract, showMessage, walletType, switchChain]);

  const vote = useCallback(async (isHappy) => {
    if (!account) {
      showMessage("Connect wallet first", "error");
      return;
    }

    if (!networkCorrect) {
      showMessage("Connect to Monad Testnet", "error");
      return;
    }

    try {
      setLoading((prev) => ({ ...prev, voting: true }));

      if (walletType === 'walletconnect') {
        if (!walletClient || !publicClient) {
          showMessage("WalletConnect client not ready", "error");
          return;
        }
        if (walletClient.chain?.id !== monadChainId) {
          showMessage("Please switch to Monad Testnet", "error");
          return;
        }

        const txHash = await walletClient.writeContract({
          abi,
          address: contractAddress,
          functionName: "vote",
          args: [isHappy],
          account: walletClient.account?.address ?? account,
        });

        await publicClient.waitForTransactionReceipt({ hash: txHash });
        await fetchWalletConnectState();
        showMessage("Vote successful!", "success");
      } else if (contract) {
        // Для MetaMask используем стандартный подход
        const tx = await contract.vote(isHappy);
        await tx.wait();

        const [happy, sad] = await contract.getVotes();
        setHappyVotes(Number(happy));
        setSadVotes(Number(sad));
        setCanVote(false);

        const seconds = await contract.timeUntilNextVote(account);
        setTimeLeft(Number(seconds));

        showMessage("Vote successful!", "success");
      }
    } catch (err) {
      showMessage("Voting failed", "error");
      console.error(err);
    } finally {
      setLoading((prev) => ({ ...prev, voting: false }));
    }
  }, [contract, account, networkCorrect, showMessage, walletType, walletClient, publicClient, fetchWalletConnectState]);

  const disconnectWallet = useCallback(() => {
    if (walletType === 'walletconnect' && isConnected) {
      disconnect();
    }
    setAccount(null);
    setProvider(null);
    setContract(null);
    setNetworkCorrect(null);
    setCanVote(false);
    setTimeLeft(null);
    setWalletType(null);
    showMessage("Wallet disconnected", "info");
  }, [showMessage, walletType, isConnected, disconnect]);

  const donate = useCallback(async () => {
    if (!provider || !account) {
      showMessage("Connect wallet first", "error");
      return;
    }

    try {
      setLoading((prev) => ({ ...prev, donation: true }));
      const signer = await provider.getSigner();
      const tx = await signer.sendTransaction({
        to: "0x1f1dd9c30181e8e49D5537Bc3E81c33896e778Bd",
        value: ethers.parseEther("0.5"),
      });
      await tx.wait();
      showMessage("Thanks for donating!", "success");
    } catch (err) {
      showMessage("Donation failed", "error");
      console.error(err);
    } finally {
      setLoading((prev) => ({ ...prev, donation: false }));
    }
  }, [provider, account, showMessage]);

  // Обработка подключения через WalletConnect
  useEffect(() => {
    if (isConnected && address && walletType === 'walletconnect') {
      setAccount(address);
      // Проверяем правильность сети для WalletConnect
      const isCorrectNetwork = chainId === monadChainId;
      setNetworkCorrect(isCorrectNetwork);
      
      if (isCorrectNetwork) {
        showMessage("WalletConnect connected", "success");
      } else {
        showMessage("Please switch to Monad Testnet", "error");
      }
    }
  }, [isConnected, address, walletType, chainId, showMessage]);

  useEffect(() => {
    if (walletType !== 'walletconnect') return;
    if (!isConnected || !account || !networkCorrect) return;

    fetchWalletConnectState();
  }, [walletType, isConnected, account, networkCorrect, fetchWalletConnectState]);

  // Автообновление сети при изменении
  useEffect(() => {
    if (!window.ethereum || walletType === 'walletconnect') return;

    const handleAccountsChanged = (accounts) => {
      if (accounts.length === 0) disconnectWallet();
      else {
        setAccount(accounts[0]);
        if (provider) initContract(provider, accounts[0]);
      }
    };

    const handleChainChanged = async () => {
      const newProvider = new ethers.BrowserProvider(window.ethereum);
      setProvider(newProvider);
      await checkNetwork(newProvider);
      if (account) await initContract(newProvider, account);
    };

    window.ethereum.on("accountsChanged", handleAccountsChanged);
    window.ethereum.on("chainChanged", handleChainChanged);

    return () => {
      window.ethereum.removeListener("accountsChanged", handleAccountsChanged);
      window.ethereum.removeListener("chainChanged", handleChainChanged);
    };
  }, [provider, account, initContract, checkNetwork, disconnectWallet, walletType]);

  useEffect(() => {
    if (provider) checkNetwork(provider);
  }, [provider, checkNetwork]);

  useEffect(() => {
    let interval;
    if (timeLeft > 0) {
      interval = setInterval(() => {
        setTimeLeft((prev) => Math.max(prev - 1, 0));
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [timeLeft]);

  const totalVotes = happyVotes + sadVotes;
  const happyPercent = totalVotes ? Math.round((happyVotes / totalVotes) * 100) : 0;
  const sadPercent = totalVotes ? 100 - happyPercent : 0;

  return (
      <div className="app-container">
        {/* Theme Toggle */}
        <button onClick={toggleTheme} className="theme-toggle">
          <span className="theme-icon">{isDarkTheme ? '🌙' : '☀️'}</span>
          <span>{isDarkTheme ? 'Dark' : 'Light'}</span>
        </button>

        {message && (
            <div className={`notification ${message.type}`}>
              {message.text}
              <button onClick={() => setMessage(null)} className="close-btn">×</button>
            </div>
        )}

        {account && networkCorrect === false && (
            <div className="network-warning">
              ⚠️ Wrong network<br/>
              <button
                  onClick={switchToMonadNetwork}
                  className="switch-network-button"
                  disabled={loading.network}
              >
                {loading.network ? "Switching..." : "Switch to Monad Testnet"}
              </button>
            </div>
        )}

        <h1 className="app-title">Make the world happier 🌍</h1>

        {!account ? (
            <div className="wallet-connection">
              <h3>Choose your wallet:</h3>
              <div className="wallet-buttons">
                <button 
                  onClick={() => connectWallet('metamask')} 
                  className="connect-button metamask-button" 
                  disabled={loading.wallet}
                >
                  {loading.wallet ? "Connecting..." : "🦊 MetaMask"}
                </button>
                <button 
                  onClick={() => connectWallet('walletconnect')} 
                  className="connect-button walletconnect-button" 
                  disabled={loading.wallet}
                >
                  {loading.wallet ? "Connecting..." : "🔗 WalletConnect"}
                </button>
              </div>
              <div className="wallet-connect-note">
                WalletConnect supports 300+ wallets including mobile wallets
              </div>
            </div>
        ) : (
            <>
              <div className="wallet-info">
                <strong>Connected:</strong> {`${account.slice(0, 6)}...${account.slice(-4)}`}
                <button onClick={disconnectWallet} className="disconnect-button">Disconnect</button>
              </div>

              <div className="vote-buttons">
                <button
                    onClick={() => vote(true)}
                    disabled={!canVote || loading.voting}
                    className="happy-button"
                >
                  😊 I'm Happy
                </button>
                <button
                    onClick={() => vote(false)}
                    disabled={!canVote || loading.voting}
                    className="sad-button"
                >
                  😢 I'm Sad
                </button>
              </div>

              {!canVote && timeLeft !== null && (
                  <div className="vote-timer">
                    <p>You've already voted. Next vote in:</p>
                    <p className="timer">{formatTime(timeLeft)}</p>
                  </div>
              )}

              <div className="mood-box">
                <h3>Current Mood</h3>
                <div className="happiness-meter-container">
                  <div className="happiness-meter-happy" style={{ width: `${happyPercent}%` }}></div>
                  <div className="happiness-meter-sad" style={{ width: `${sadPercent}%` }}></div>
                </div>
                <div className="happiness-meter-labels">
                  <span>😊 Happy ({happyPercent}%)</span>
                  <span>😢 Sad ({sadPercent}%)</span>
                </div>
                <p>Total votes: <strong>{totalVotes}</strong></p>
              </div>
            </>
        )}

        <hr className="divider" />

        <div className="links-section">
          <h4>Links & Support</h4>
          <div className="links">
            <a href="https://github.com/pittpv/happy-vote-app" target="_blank" rel="noopener noreferrer">
              <button className="link-button">GitHub</button>
            </a>
            <a href="https://warpcast.com/pittpv" target="_blank" rel="noopener noreferrer">
              <button className="link-button">Warpcast</button>
            </a>
            <a href="https://x.com/pittpv" target="_blank" rel="noopener noreferrer">
              <button className="link-button">X (Twitter)</button>
            </a>
            <a href="https://cards.monad.xyz/" target="_blank" rel="noopener noreferrer">
              <button className="link-button">🙏🏻 Nominate @pittpv in Cards</button>
            </a>
            <button
                onClick={donate}
                className="donate-button"
                disabled={loading.donation}
            >
              {loading.donation ? "Processing..." : "Donate 0.5 MON"}
            </button>
          </div>
        </div>
      </div>
  );
}

export default App;
