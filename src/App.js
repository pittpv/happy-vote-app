import React, { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { ethers } from "ethers";
import { createPublicClient, http } from "viem";
import testnetAbi from "./abi.json";
import mainnetAbi from "./abiMainnet.json";
import "./App.css";
import { openConnectModal, openNetworkModal } from "./walletProvider";
import { useAccount, useDisconnect, useChainId, useSwitchChain, useWalletClient } from 'wagmi';

const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";

const NETWORK_LIST = [
  {
    key: 'mainnet',
    label: 'Mainnet',
    chainId: 143,
    chainHex: "0x8f",
    rpcUrls: ["https://rpc1.monad.xyz"],
    explorerUrl: "https://monadvision.com",
    explorerName: "Monad Explorer",
    nativeCurrency: { name: "Monad", symbol: "MON", decimals: 18 },
    contractAddress: process.env.REACT_APP_MAINNET_CONTRACT_ADDRESS || "0xdFFEFD8eF040702A4657a98f189860169104257A",
    abi: mainnetAbi,
    hasLeaderboard: true,
  },
  {
    key: 'testnet',
    label: 'Testnet',
    chainId: 10143,
    chainHex: "0x279f",
    rpcUrls: ["https://testnet-rpc.monad.xyz"],
    explorerUrl: "https://testnet.monadvision.com",
    explorerName: "Monad Explorer",
    nativeCurrency: { name: "Monad", symbol: "MON", decimals: 18 },
    contractAddress: process.env.REACT_APP_TESTNET_CONTRACT_ADDRESS || "0x7fB4F5Fc2a6f2FAa86F5F37EAEE8A0db820ad9E0",
    abi: testnetAbi,
    hasLeaderboard: false,
  },
];

const NETWORKS = NETWORK_LIST.reduce((acc, network) => {
  acc[network.key] = network;
  return acc;
}, {});
const NETWORK_CHAIN_CONFIG = NETWORK_LIST.reduce((acc, network) => {
  acc[network.key] = {
    id: network.chainId,
    name: `Monad ${network.label}`,
    network: `monad-${network.key}`,
    nativeCurrency: network.nativeCurrency,
    rpcUrls: {
      default: { http: network.rpcUrls },
      public: { http: network.rpcUrls },
    },
    blockExplorers: {
      default: { name: network.explorerName, url: network.explorerUrl },
    },
  };
  return acc;
}, {});

function App() {
  // Wagmi hooks
  const { address, isConnected } = useAccount();
  const { disconnect } = useDisconnect();
  const chainId = useChainId();
  const { switchChain } = useSwitchChain();
  const { data: walletClient } = useWalletClient();

  const [provider, setProvider] = useState(null);
  const [contract, setContract] = useState(null);
  const [account, setAccount] = useState(null);
  const [networkCorrect, setNetworkCorrect] = useState(null);
  const [walletChainId, setWalletChainId] = useState(null);
  const [happyVotes, setHappyVotes] = useState(0);
  const [sadVotes, setSadVotes] = useState(0);
  const [canVote, setCanVote] = useState(false);
  const [timeLeft, setTimeLeft] = useState(null);
  const [leaderboard, setLeaderboard] = useState([]);
  const [refundEnabled, setRefundEnabled] = useState(false);
  const [tooltipVisible, setTooltipVisible] = useState(false);
  const [loading, setLoading] = useState({
    wallet: false,
    network: false,
    voting: false,
    donation: false,
  });
  const [message, setMessage] = useState(null);
  const [isDarkTheme, setIsDarkTheme] = useState(false);
  const [walletType, setWalletType] = useState(null); // 'metamask' or 'walletconnect'
  const [isDisconnecting, setIsDisconnecting] = useState(false);
  const [isNetworkDropdownOpen, setIsNetworkDropdownOpen] = useState(false);
  const [selectedNetwork, setSelectedNetwork] = useState(() => {
    if (typeof window === "undefined") return 'mainnet';
    const stored = localStorage.getItem('happy-vote-network');
    return stored && NETWORKS[stored] ? stored : 'mainnet';
  });

  const publicClientCacheRef = useRef({});
  const prevAccountRef = useRef(null);
  const pendingNetworkRef = useRef(null);

  const getNetworkClient = useCallback((networkKey) => {
    const config = NETWORKS[networkKey];
    if (!config || !config.rpcUrls?.length) {
      console.warn(`Missing RPC configuration for network: ${networkKey}`);
      return null;
    }

    if (!publicClientCacheRef.current[networkKey]) {
      const chainConfig = NETWORK_CHAIN_CONFIG[networkKey];
      publicClientCacheRef.current[networkKey] = createPublicClient({
        chain: chainConfig,
        transport: http(config.rpcUrls[0]),
      });
    }

    return publicClientCacheRef.current[networkKey];
  }, []);

  const mainnetAddressMissing = NETWORKS.mainnet.contractAddress === ZERO_ADDRESS;
  const networkOptions = NETWORK_LIST;

  const activeNetworkKey = useMemo(() => {
    if (!chainId) return null;
    const numericChainId = Number(chainId);
    return (
        Object.keys(NETWORKS).find(
            (key) => NETWORKS[key].chainId === numericChainId
        ) || null
    );
  }, [chainId]);

  const displayNetworkKey = useMemo(() => {
    if (walletType === 'walletconnect' && activeNetworkKey) {
      return activeNetworkKey;
    }

    if (walletChainId) {
      const mapped = Object.keys(NETWORKS).find(
          (key) => NETWORKS[key].chainId === walletChainId
      );
      if (mapped) return mapped;
    }

    return selectedNetwork;
  }, [walletType, activeNetworkKey, walletChainId, selectedNetwork]);

  const selectedNetworkConfig = NETWORKS[selectedNetwork] || NETWORKS.mainnet;
  const displayNetworkConfig = NETWORKS[displayNetworkKey] || selectedNetworkConfig;
  const isWalletConnectLocked = walletType === 'walletconnect' && isConnected;
  // Синхронизируем chainId для WalletConnect
  useEffect(() => {
    if (walletType === 'walletconnect' && walletClient?.chain?.id) {
      setWalletChainId(Number(walletClient.chain.id));
    }
  }, [walletType, walletClient]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    localStorage.setItem('happy-vote-network', selectedNetwork);
  }, [selectedNetwork]);

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

  const formatAddressShort = useCallback((addr) => {
    if (!addr) return "";
    return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
  }, []);

  const showMessage = useCallback((text, type = "info", duration = 5000) => {
    setMessage({ text, type });
    if (duration > 0) {
      setTimeout(() => setMessage(null), duration);
    }
  }, []);

  const checkNetwork = useCallback(
      async (providerToCheck, targetNetworkKey = selectedNetwork) => {
        try {
          if (!providerToCheck) return false;
          const network = await providerToCheck.getNetwork();
          const detectedChain = Number(network.chainId);
          setWalletChainId(detectedChain);

          const expectedNetwork = NETWORKS[targetNetworkKey];
          if (!expectedNetwork) return false;

          const correct = detectedChain === expectedNetwork.chainId;
          setNetworkCorrect(correct);
          return correct;
        } catch (e) {
          console.error("Network check failed", e);
          setNetworkCorrect(false);
          return false;
        }
      },
      [selectedNetwork]
  );

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

  const fetchSelectedNetworkStats = useCallback(async () => {
    const config = NETWORKS[selectedNetwork] || NETWORKS.mainnet;
    if (!config || !config.contractAddress || config.contractAddress === ZERO_ADDRESS) {
      setHappyVotes(0);
      setSadVotes(0);
      setLeaderboard([]);
      return;
    }

    const client = getNetworkClient(config.key);
    if (!client) return;

    try {
      const [happy, sad] = await client.readContract({
        abi: config.abi,
        address: config.contractAddress,
        functionName: "getVotes",
      });
      setHappyVotes(Number(happy));
      setSadVotes(Number(sad));

      // Check if refund is enabled
      try {
        const refundEnabledValue = await client.readContract({
          abi: config.abi,
          address: config.contractAddress,
          functionName: "refundEnabled",
        });
        // Handle different return types (boolean, string, number, BigInt)
        let boolValue = false;
        if (typeof refundEnabledValue === 'boolean') {
          boolValue = refundEnabledValue;
        } else if (typeof refundEnabledValue === 'string') {
          boolValue = refundEnabledValue.toLowerCase() === 'true' || refundEnabledValue === '1';
        } else if (typeof refundEnabledValue === 'number' || typeof refundEnabledValue === 'bigint') {
          boolValue = Number(refundEnabledValue) !== 0;
        } else {
          boolValue = Boolean(refundEnabledValue);
        }
        setRefundEnabled(boolValue);
      } catch (refundErr) {
        // If refundEnabled doesn't exist (old contract), set to false
        console.warn("refundEnabled not available in contract", refundErr);
        setRefundEnabled(false);
      }

      if (config.hasLeaderboard) {
        const [addresses, happyCounts] = await client.readContract({
          abi: config.abi,
          address: config.contractAddress,
          functionName: "getHappyLeaderboard",
        });
        const mapped =
            addresses?.map((addr, index) => ({
              address: addr,
              happyVotes: Number(happyCounts[index]),
            })) || [];
        setLeaderboard(mapped.filter((row) => row.happyVotes > 0));
      } else {
        setLeaderboard([]);
      }
    } catch (err) {
      console.error("Failed to fetch network stats", err);
    }
  }, [selectedNetwork, getNetworkClient]);

  useEffect(() => {
    fetchSelectedNetworkStats();
  }, [fetchSelectedNetworkStats]);


  // Close tooltip when clicking outside
  useEffect(() => {
    if (!tooltipVisible) return;

    const handleClickOutside = (event) => {
      const container = document.querySelector('.refund-badge-container');
      if (container && !container.contains(event.target)) {
        setTooltipVisible(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('touchstart', handleClickOutside);

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('touchstart', handleClickOutside);
    };
  }, [tooltipVisible]);

  const fetchWalletConnectState = useCallback(
      async (networkKey) => {
        if (!account || !networkKey) return;

        if (walletType === 'walletconnect') {
          const walletNetwork = activeNetworkKey || (walletClient?.chain?.id ? Object.keys(NETWORKS).find(key => NETWORKS[key].chainId === Number(walletClient.chain.id)) : null);
          if (walletNetwork && walletNetwork !== networkKey) {
            return;
          }
        }

        const config = NETWORKS[networkKey];
        if (
            !config ||
            !config.contractAddress ||
            config.contractAddress === ZERO_ADDRESS
        ) {
          setLeaderboard([]);
          setHappyVotes(0);
          setSadVotes(0);
          setCanVote(false);
          setTimeLeft(null);
          return;
        }

        const client = getNetworkClient(networkKey);
        if (!client) return;

        try {
          const baseArgs = {
            abi: config.abi,
            address: config.contractAddress,
          };

          const [happy, sad] = await client.readContract({
            ...baseArgs,
            functionName: "getVotes",
          });
          setHappyVotes(Number(happy));
          setSadVotes(Number(sad));

          // Check if refund is enabled
          try {
            const refundEnabledValue = await client.readContract({
              ...baseArgs,
              functionName: "refundEnabled",
            });
            // Handle different return types (boolean, string, number, BigInt)
            let boolValue = false;
            if (typeof refundEnabledValue === 'boolean') {
              boolValue = refundEnabledValue;
            } else if (typeof refundEnabledValue === 'string') {
              boolValue = refundEnabledValue.toLowerCase() === 'true' || refundEnabledValue === '1';
            } else if (typeof refundEnabledValue === 'number' || typeof refundEnabledValue === 'bigint') {
              boolValue = Number(refundEnabledValue) !== 0;
            } else {
              boolValue = Boolean(refundEnabledValue);
            }
            setRefundEnabled(boolValue);
          } catch (refundErr) {
            // If refundEnabled doesn't exist (old contract), set to false
            console.warn("refundEnabled not available in contract", refundErr);
            setRefundEnabled(false);
          }

          const walletCanVote = await client.readContract({
            ...baseArgs,
            functionName: "canVote",
            args: [account],
          });
          setCanVote(Boolean(walletCanVote));

          if (!walletCanVote) {
            const seconds = await client.readContract({
              ...baseArgs,
              functionName: "timeUntilNextVote",
              args: [account],
            });
            setTimeLeft(Number(seconds));
          } else {
            setTimeLeft(null);
          }

          if (config.hasLeaderboard) {
            const [addresses, happyCounts] = await client.readContract({
              ...baseArgs,
              functionName: "getHappyLeaderboard",
            });
            const mapped =
                addresses?.map((addr, index) => ({
                  address: addr,
                  happyVotes: Number(happyCounts[index]),
                })) || [];
            setLeaderboard(mapped.filter((row) => row.happyVotes > 0));
          } else {
            setLeaderboard([]);
          }
        } catch (err) {
          console.error("WalletConnect state sync failed:", err);
          if (!isDisconnecting) {
            showMessage("Failed to refresh vote stats", "error");
          }
        }
      },
      [account, showMessage, getNetworkClient, walletType, activeNetworkKey, walletClient, isDisconnecting]
  );

  const initContract = useCallback(async (provider, account, networkKey = selectedNetwork) => {
    try {
      const config = NETWORKS[networkKey];
      if (!config || !config.contractAddress || config.contractAddress === ZERO_ADDRESS) {
        setHappyVotes(0);
        setSadVotes(0);
        setCanVote(false);
        setTimeLeft(null);
        setLeaderboard([]);
        showMessage("Contract address is not configured for the selected network", "error");
        return null;
      }

      if (walletType === 'walletconnect') {
        const walletNetworkKey = activeNetworkKey || networkKey;
        if (!walletNetworkKey) {
          showMessage("Unable to determine wallet network", "error");
          return null;
        }
        await fetchWalletConnectState(walletNetworkKey);
        return null;
      } else {
        // Для MetaMask используем стандартный подход
        const signer = await provider.getSigner();
        const contract = new ethers.Contract(config.contractAddress, config.abi, signer);
        setContract(contract);

        const [happy, sad] = await contract.getVotes();
        setHappyVotes(Number(happy));
        setSadVotes(Number(sad));

        // Check if refund is enabled
        try {
          const refundEnabledValue = await contract.refundEnabled();
          // Handle different return types (boolean, string, number, BigInt)
          let boolValue = false;
          if (typeof refundEnabledValue === 'boolean') {
            boolValue = refundEnabledValue;
          } else if (typeof refundEnabledValue === 'string') {
            boolValue = refundEnabledValue.toLowerCase() === 'true' || refundEnabledValue === '1';
          } else if (typeof refundEnabledValue === 'number' || typeof refundEnabledValue === 'bigint') {
            boolValue = Number(refundEnabledValue) !== 0;
          } else {
            boolValue = Boolean(refundEnabledValue);
          }
          setRefundEnabled(boolValue);
        } catch (refundErr) {
          // If refundEnabled doesn't exist (old contract), set to false
          console.warn("refundEnabled not available in contract", refundErr);
          setRefundEnabled(false);
        }

        const canVote = await contract.canVote(account);
        setCanVote(canVote);

        if (!canVote) {
          const seconds = await contract.timeUntilNextVote(account);
          setTimeLeft(Number(seconds));
        } else {
          setTimeLeft(null);
        }

        if (config.hasLeaderboard) {
          try {
            const [addresses, happyCounts] = await contract.getHappyLeaderboard();
            const mapped = addresses.map((addr, index) => ({
              address: addr,
              happyVotes: Number(happyCounts[index]),
            }));
            setLeaderboard(mapped.filter((row) => row.happyVotes > 0));
          } catch (leaderboardError) {
            console.warn("Failed to fetch leaderboard", leaderboardError);
            setLeaderboard([]);
          }
        } else {
          setLeaderboard([]);
        }

        return contract;
      }
    } catch (err) {
      console.error("Contract initialization failed:", err);
      showMessage("Failed to initialize contract", "error");
    }
  }, [showMessage, walletType, fetchWalletConnectState, selectedNetwork, activeNetworkKey]);

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

      const isCorrect = await checkNetwork(provider, selectedNetwork);
      if (!isCorrect) {
        showMessage(`Please switch MetaMask to Monad ${selectedNetworkConfig.label}`, "error");
        return;
      }

      await initContract(provider, selectedAccount, selectedNetwork);
      setIsDisconnecting(false); // Сбрасываем флаг при успешном подключении
      showMessage("MetaMask connected", "success");
    } catch (err) {
      setIsDisconnecting(false); // Сбрасываем флаг даже при ошибке
      showMessage("Failed to connect MetaMask", "error");
      console.error(err);
    } finally {
      setLoading((prev) => ({ ...prev, wallet: false }));
    }
  }, [checkNetwork, initProvider, initContract, showMessage, selectedNetwork, selectedNetworkConfig.label]);

  const connectWalletConnect = useCallback(() => {
    // Не устанавливаем walletType заранее, он установится в useEffect при успешном подключении
    openConnectModal();
  }, []);

  const connectWallet = useCallback((type) => {
    if (type === 'metamask') {
      connectMetaMask();
    } else if (type === 'walletconnect') {
      connectWalletConnect();
    }
  }, [connectMetaMask, connectWalletConnect]);

  const switchNetwork = useCallback(
      async (targetNetworkKey = selectedNetwork, options = {}) => {
        const { showToast = true } = options;
        const targetConfig = NETWORKS[targetNetworkKey];
        if (!targetConfig) return;

        try {
          setLoading((prev) => ({ ...prev, network: true }));

          if (walletType === 'walletconnect') {
            if (switchChain) {
              await switchChain({ chainId: targetConfig.chainId });
            } else if (walletClient?.switchChain) {
              await walletClient.switchChain({ id: targetConfig.chainId });
            } else {
              openNetworkModal();
              showMessage("Please switch networks in your wallet", "info");
              return;
            }

            setNetworkCorrect(true);
            if (showToast) {
              showMessage(`Switched to Monad ${targetConfig.label}`, "success");
            }
            await fetchWalletConnectState(targetNetworkKey);
            return;
          }

          if (window.ethereum) {
            try {
              await window.ethereum.request({
                method: "wallet_switchEthereumChain",
                params: [{ chainId: targetConfig.chainHex }],
              });
            } catch (switchError) {
              if (switchError.code === 4902) {
                await window.ethereum.request({
                  method: "wallet_addEthereumChain",
                  params: [{
                    chainId: targetConfig.chainHex,
                    chainName: `Monad ${targetConfig.label}`,
                    rpcUrls: targetConfig.rpcUrls,
                    nativeCurrency: { name: "Monad", symbol: "MON", decimals: 18 },
                    blockExplorerUrls: [targetConfig.explorerUrl],
                  }],
                });
              } else {
                throw switchError;
              }
            }

            const updatedProvider = new ethers.BrowserProvider(window.ethereum);
            setProvider(updatedProvider);
            await checkNetwork(updatedProvider, targetNetworkKey);
            if (account) await initContract(updatedProvider, account, targetNetworkKey);
            if (showToast) {
              showMessage(`Switched to Monad ${targetConfig.label}`, "success");
            }
            return;
          }

          showMessage("No provider available to switch network", "error");
        } catch (err) {
          console.error("Network switch failed", err);
          if (showToast) {
            showMessage("Failed to switch network", "error");
          }
        } finally {
          setLoading((prev) => ({ ...prev, network: false }));
        }
      },
      [selectedNetwork, walletType, switchChain, walletClient, fetchWalletConnectState, showMessage, checkNetwork, initContract, account, openNetworkModal]
  );

  const vote = useCallback(async (isHappy) => {
    const voteType = isHappy ? "Happy" : "Sad";
    console.log(`🎯 [Vote] Function called for ${voteType} vote (isHappy: ${isHappy})`);
    console.log("🎯 [Vote] Current state:", {
      account,
      walletType,
      networkCorrect,
      hasContract: !!contract,
      hasProvider: !!provider,
      selectedNetwork,
      activeNetworkKey,
      voteType
    });

    if (!account) {
      console.error("❌ [Vote] No account");
      showMessage("Connect wallet first", "error");
      return;
    }

    if (!networkCorrect) {
      console.error("❌ [Vote] Network incorrect");
      showMessage(`Connect to Monad ${selectedNetworkConfig.label}`, "error");
      return;
    }

    const networkKey = walletType === 'walletconnect' ? activeNetworkKey : selectedNetwork;
    console.log("🎯 [Vote] Network key:", networkKey, "walletType:", walletType);
    
    if (!networkKey) {
      console.error("❌ [Vote] No network key");
      showMessage("Unsupported network", "error");
      return;
    }

    const targetConfig = NETWORKS[networkKey];
    if (!targetConfig || targetConfig.contractAddress === ZERO_ADDRESS) {
      console.error("❌ [Vote] Contract address missing");
      showMessage("Contract address missing for this network", "error");
      return;
    }

    try {
      setLoading((prev) => ({ ...prev, voting: true }));

      if (walletType === 'walletconnect') {
        console.log("🔗 [Vote] Using WalletConnect path");
        if (!walletClient) {
          console.error("❌ [WalletConnect Vote] WalletConnect client not ready");
          showMessage("WalletConnect client not ready", "error");
          return;
        }
        if (walletClient.chain?.id !== targetConfig.chainId) {
          console.error("❌ [WalletConnect Vote] Wrong chain");
          showMessage(`Please switch to Monad ${targetConfig.label}`, "error");
          return;
        }

        const client = getNetworkClient(networkKey);
        if (!client) {
          console.error("❌ [WalletConnect Vote] Unable to initialize network client");
          showMessage("Unable to initialize network client", "error");
          return;
        }

        // Для WalletConnect также нужно увеличить GasLimit в 1.5 раза
        const voteType = isHappy ? "Happy" : "Sad";
        console.log(`📊 [WalletConnect Vote] Estimating gas for ${voteType} vote...`);
        
        try {
          // Получаем оценку газа
          const estimatedGas = await client.estimateContractGas({
            abi: targetConfig.abi,
            address: targetConfig.contractAddress,
            functionName: "vote",
            args: [isHappy],
            account: walletClient.account?.address ?? account,
          });

          // Увеличиваем GasLimit: 1.5x для Happy, 1.7x для Sad
          const multiplier = isHappy ? 150n : 170n; // 1.5x для Happy, 1.7x для Sad
          const increasedGasLimit = (estimatedGas * multiplier) / 100n;

          console.log(`✅ [WalletConnect Vote] Gas estimation for ${voteType} vote:`, {
            estimated: estimatedGas.toString(),
            increased: increasedGasLimit.toString(),
            multiplier: isHappy ? "1.5x" : "1.7x",
            voteType
          });

          console.log(`📤 [WalletConnect Vote] Sending ${voteType} vote transaction with gasLimit:`, increasedGasLimit.toString());
          console.log(`📤 [WalletConnect Vote] Transaction params:`, {
            address: targetConfig.contractAddress,
            functionName: "vote",
            args: [isHappy],
            account: walletClient.account?.address ?? account,
            gas: increasedGasLimit.toString()
          });

          let txHash;
          try {
            txHash = await walletClient.writeContract({
              abi: targetConfig.abi,
              address: targetConfig.contractAddress,
              functionName: "vote",
              args: [isHappy],
              account: walletClient.account?.address ?? account,
              gas: increasedGasLimit, // Явно указываем увеличенный gasLimit
            });
            console.log(`✅ [WalletConnect Vote] ${voteType} vote transaction sent, hash:`, txHash);
          } catch (writeErr) {
            console.error(`❌ [WalletConnect Vote] Error sending ${voteType} vote transaction:`, writeErr);
            // Проверяем, не отменил ли пользователь транзакцию
            if (writeErr?.message?.includes("user rejected") || 
                writeErr?.message?.includes("User denied") ||
                writeErr?.message?.includes("User rejected") ||
                writeErr?.code === 4001 ||
                writeErr?.code === "ACTION_REJECTED") {
              console.log(`🚫 [WalletConnect Vote] ${voteType} vote transaction rejected by user during send`);
              throw writeErr;
            }
            throw writeErr;
          }

          console.log(`⏳ [WalletConnect Vote] Waiting for ${voteType} vote transaction confirmation...`);
          try {
            await client.waitForTransactionReceipt({ hash: txHash });
            console.log(`✅ [WalletConnect Vote] ${voteType} vote transaction confirmed!`);
          } catch (waitErr) {
            console.error(`❌ [WalletConnect Vote] Error waiting for ${voteType} vote transaction:`, waitErr);
            throw waitErr;
          }
          
          await fetchWalletConnectState(networkKey);
          showMessage("Vote successful!", "success");
        } catch (gasErr) {
          const voteType = isHappy ? "Happy" : "Sad";
          console.error(`❌ [WalletConnect Vote] Error for ${voteType} vote:`, gasErr);
          
          // Проверяем, не отменил ли пользователь транзакцию
          if (gasErr?.message?.includes("user rejected") || 
              gasErr?.message?.includes("User denied") ||
              gasErr?.message?.includes("User rejected") ||
              gasErr?.code === 4001) {
            console.log(`🚫 [WalletConnect Vote] ${voteType} vote transaction rejected by user`);
            throw gasErr; // Пробрасываем ошибку, чтобы не пытаться отправлять повторно
          }
          
          // Если это не отмена пользователем, пробрасываем ошибку дальше
          throw gasErr;
        }
      } else if (contract) {
        // Для MetaMask нужно увеличить GasLimit: 1.5x для Happy, 2.5x для Sad
        const voteType = isHappy ? "Happy" : "Sad";
        console.log(`🚀 [MetaMask Vote] Starting ${voteType} vote transaction...`);
        console.log("🚀 [MetaMask Vote] Contract and provider available:", {
          hasContract: !!contract,
          hasProvider: !!provider,
          contractAddress: targetConfig.contractAddress,
          voteType
        });

        if (!provider) {
          console.error("❌ [MetaMask Vote] Provider not available");
          showMessage("Provider not available", "error");
          return;
        }

        if (!window.ethereum) {
          console.error("❌ [MetaMask Vote] MetaMask not available");
          showMessage("MetaMask not available", "error");
          return;
        }

        try {
          // Получаем оценку газа от RPC
          const voteType = isHappy ? "Happy" : "Sad";
          console.log(`📊 [MetaMask Vote] Estimating gas for ${voteType} vote...`);
          const populatedTx = await contract.vote.populateTransaction(isHappy);
          const estimatedGas = await provider.estimateGas(populatedTx);
          
          // Увеличиваем GasLimit: 1.5x для Happy, 2.5x для Sad
          const multiplier = isHappy ? 150n : 250n; // 1.5x для Happy, 2.5x для Sad
          const increasedGasLimit = (estimatedGas * multiplier) / 100n;

          console.log(`✅ [MetaMask Vote] Gas estimation for ${voteType} vote:`, {
            estimated: estimatedGas.toString(),
            increased: increasedGasLimit.toString(),
            multiplier: isHappy ? "1.5x" : "2.5x",
            voteType
          });

          // Используем signer.sendTransaction с явным указанием gasLimit
          // Это более надежный способ для MetaMask
          const signer = await provider.getSigner();

          console.log(`📤 [MetaMask Vote] Sending ${voteType} vote transaction with gasLimit:`, increasedGasLimit.toString());

          let tx;
          try {
            tx = await signer.sendTransaction({
              to: populatedTx.to,
              data: populatedTx.data,
              gasLimit: increasedGasLimit, // Явно указываем увеличенный gasLimit
            });
          } catch (sendErr) {
            // Проверяем, не отменил ли пользователь транзакцию
            if (sendErr?.message?.includes("user rejected") || 
                sendErr?.message?.includes("User denied") ||
                sendErr?.message?.includes("User rejected") ||
                sendErr?.code === 4001 ||
                sendErr?.code === "ACTION_REJECTED") {
              console.log(`🚫 [MetaMask Vote] ${voteType} vote transaction rejected by user`);
              throw sendErr; // Пробрасываем ошибку, чтобы не пытаться отправлять повторно
            }
            throw sendErr; // Пробрасываем другие ошибки
          }

          console.log(`✅ [MetaMask Vote] ${voteType} vote transaction sent, hash:`, tx.hash);
          console.log(`📋 [MetaMask Vote] ${voteType} vote transaction details:`, {
            hash: tx.hash,
            gasLimit: tx.gasLimit?.toString(),
            expectedGasLimit: increasedGasLimit.toString(),
            to: tx.to,
            from: tx.from,
            voteType
          });

          // Проверяем, что gasLimit применился
          if (tx.gasLimit && tx.gasLimit.toString() !== increasedGasLimit.toString()) {
            console.warn("⚠️ [MetaMask Vote] GasLimit mismatch!", {
              requested: increasedGasLimit.toString(),
              actual: tx.gasLimit.toString(),
              ratio: (Number(tx.gasLimit) / Number(increasedGasLimit) * 100).toFixed(2) + "%"
            });
          }

          // Ждем подтверждения транзакции
          console.log(`⏳ [MetaMask Vote] Waiting for ${voteType} vote confirmation...`);
          let receipt;
          try {
            receipt = await tx.wait();
          } catch (waitErr) {
            // Проверяем, не отменил ли пользователь транзакцию во время ожидания
            if (waitErr?.message?.includes("user rejected") || 
                waitErr?.message?.includes("User denied") ||
                waitErr?.message?.includes("User rejected") ||
                waitErr?.code === 4001 ||
                waitErr?.code === "ACTION_REJECTED") {
              console.log(`🚫 [MetaMask Vote] ${voteType} vote transaction rejected by user during wait`);
              throw waitErr;
            }
            // Если транзакция провалилась по другой причине (например, out of gas), пробрасываем ошибку
            throw waitErr;
          }

          console.log(`✅ [MetaMask Vote] ${voteType} vote transaction confirmed:`, {
            hash: receipt.hash,
            gasUsed: receipt.gasUsed.toString(),
            gasLimit: receipt.gasLimit?.toString(),
            status: receipt.status === 1 ? "success" : "failed",
            voteType
          });

          if (receipt.status !== 1) {
            throw new Error("Transaction failed with status: " + receipt.status);
          }

          const [happy, sad] = await contract.getVotes();
          setHappyVotes(Number(happy));
          setSadVotes(Number(sad));
          setCanVote(false);

          const seconds = await contract.timeUntilNextVote(account);
          setTimeLeft(Number(seconds));

          if (targetConfig.hasLeaderboard && typeof contract.getHappyLeaderboard === "function") {
            const [addresses, happyCounts] = await contract.getHappyLeaderboard();
            const mapped = addresses.map((addr, index) => ({
              address: addr,
              happyVotes: Number(happyCounts[index]),
            }));
            setLeaderboard(mapped.filter((row) => row.happyVotes > 0));
          }

          showMessage("Vote successful!", "success");
        } catch (metaMaskErr) {
          const voteType = isHappy ? "Happy" : "Sad";
          console.error(`❌ [MetaMask Vote] Error in ${voteType} vote transaction:`, metaMaskErr);
          throw metaMaskErr; // Пробрасываем ошибку в общий catch
        }
      } else {
        console.error("❌ [Vote] No contract available! walletType:", walletType, "hasContract:", !!contract, "hasProvider:", !!provider);
        showMessage("Contract not initialized. Please reconnect wallet.", "error");
      }
    } catch (err) {
      console.error("❌ [Vote] General error:", err);
      let errorMessage = "Voting failed";

      if (err?.message) {
        if (err.message.includes("out of gas") || err.message.includes("gas required exceeds")) {
          errorMessage = "Transaction failed: insufficient gas. Please try again.";
        } else if (err.message.includes("user rejected") || err.message.includes("User denied")) {
          errorMessage = "Transaction rejected by user";
        } else {
          errorMessage = `Voting failed: ${err.message}`;
        }
      }

      showMessage(errorMessage, "error");
      console.error("Full error details:", err);
    } finally {
      setLoading((prev) => ({ ...prev, voting: false }));
    }
  }, [contract, account, networkCorrect, showMessage, walletType, walletClient, fetchWalletConnectState, activeNetworkKey, selectedNetwork, selectedNetworkConfig.label, getNetworkClient, provider]);

  const disconnectWallet = useCallback(() => {
    setIsDisconnecting(true);

    if (walletType === 'walletconnect' && isConnected) {
      disconnect();
    }

    // Сбрасываем все состояния синхронно
    setAccount(null);
    setProvider(null);
    setContract(null);
    setNetworkCorrect(null);
    setCanVote(false);
    setTimeLeft(null);
    setWalletType(null);
    setLeaderboard([]);
    setWalletChainId(null);
    pendingNetworkRef.current = null;
    prevAccountRef.current = null;

    // Сбрасываем флаг отключения после небольшой задержки, чтобы useEffect не переподключил
    setTimeout(() => {
      setIsDisconnecting(false);
    }, 100);

    showMessage("Wallet disconnected", "info");
  }, [showMessage, walletType, isConnected, disconnect]);

  const donate = useCallback(async () => {
    if (!account) {
      showMessage("Connect wallet first", "error");
      return;
    }

    const networkKey = walletType === 'walletconnect' ? activeNetworkKey : selectedNetwork;
    const targetConfig = networkKey ? NETWORKS[networkKey] : null;

    try {
      setLoading((prev) => ({ ...prev, donation: true }));

      if (walletType === 'walletconnect') {
        if (!walletClient) {
          showMessage("WalletConnect client not ready", "error");
          return;
        }
        if (!targetConfig) {
          showMessage("Unsupported network", "error");
          return;
        }
        if (walletClient.chain?.id !== targetConfig.chainId) {
          showMessage(`Please switch to Monad ${targetConfig.label}`, "error");
          return;
        }

        const client = getNetworkClient(networkKey);
        if (!client) {
          showMessage("Unable to initialize network client", "error");
          return;
        }

        const txHash = await walletClient.sendTransaction({
          to: "0x1f1dd9c30181e8e49D5537Bc3E81c33896e778Bd",
          value: ethers.parseEther("10"),
          account: walletClient.account?.address ?? account,
        });
        await client.waitForTransactionReceipt({ hash: txHash });
        showMessage("Thanks for donating!", "success");
        return;
      }

      if (!provider) {
        showMessage("Connect wallet first", "error");
        return;
      }

      const signer = await provider.getSigner();
      const tx = await signer.sendTransaction({
        to: "0x1f1dd9c30181e8e49D5537Bc3E81c33896e778Bd",
        value: ethers.parseEther("10"),
      });
      await tx.wait();
      showMessage("Thanks for donating!", "success");
    } catch (err) {
      showMessage("Donation failed", "error");
      console.error(err);
    } finally {
      setLoading((prev) => ({ ...prev, donation: false }));
    }
  }, [provider, account, walletType, walletClient, activeNetworkKey, selectedNetwork, showMessage, getNetworkClient]);

  const handleNetworkChange = useCallback((networkKey) => {
    if (!NETWORKS[networkKey]) return;
    setSelectedNetwork(networkKey);
    setIsNetworkDropdownOpen(false);

    if (account) {
      pendingNetworkRef.current = networkKey;
      switchNetwork(networkKey).finally(() => {
        pendingNetworkRef.current = null;
      });
    } else if (walletType === 'metamask' && provider) {
      checkNetwork(provider, networkKey);
    }
  }, [account, walletType, provider, checkNetwork, switchNetwork]);

  const handleConnectWallet = useCallback(() => {
    if (account) return;
    openConnectModal();
  }, [account]);

  // Обработка подключения через WalletConnect
  useEffect(() => {
    // Если walletType уже установлен как 'metamask', не обрабатываем это как WalletConnect
    if (walletType === 'metamask') return;
    
    if (!isConnected || !address) {
      if (isDisconnecting) {
        setIsDisconnecting(false);
      }
      if (walletType === 'walletconnect') {
        if (account) {
          setAccount(null);
          setNetworkCorrect(null);
          setCanVote(false);
          setTimeLeft(null);
          setLeaderboard([]);
          setWalletChainId(null);
        }
        setWalletType(null);
      }
      prevAccountRef.current = account;
      return;
    }

    // Определяем тип кошелька: если есть window.ethereum и walletType еще не установлен,
    // проверяем, подключен ли MetaMask напрямую
    // Если walletType еще не установлен, определяем его
    if (!walletType) {
      // Проверяем, подключен ли MetaMask напрямую через window.ethereum
      if (window.ethereum && window.ethereum.isMetaMask) {
        // Проверяем, есть ли активные аккаунты в MetaMask
        window.ethereum.request({ method: 'eth_accounts' })
          .then((accounts) => {
            if (accounts && accounts.length > 0) {
              // Если есть аккаунты в MetaMask и они совпадают с адресом из wagmi,
              // проверяем, не был ли это MetaMask подключен напрямую
              // Если адрес совпадает и есть provider, это может быть MetaMask
              const isMetaMaskDirect = accounts[0]?.toLowerCase() === address?.toLowerCase() && provider;
              if (isMetaMaskDirect) {
                setWalletType('metamask');
                setAccount(accounts[0]);
              } else {
                setWalletType('walletconnect');
              }
            } else {
              // Иначе это WalletConnect
              setWalletType('walletconnect');
            }
          })
          .catch(() => {
            // В случае ошибки предполагаем WalletConnect
            setWalletType('walletconnect');
          });
      } else {
        // Если нет window.ethereum, это WalletConnect
        setWalletType('walletconnect');
      }
      return; // Выходим, чтобы дождаться установки walletType
    }

    // Если walletType уже установлен как 'metamask', не обрабатываем это как WalletConnect
    if (walletType === 'metamask') return;

    if (walletType !== 'walletconnect') return;

    if (account !== address) {
      setAccount(address);
    }

    if (!activeNetworkKey) {
      setNetworkCorrect(false);
      return;
    }

    const matches = activeNetworkKey === selectedNetwork;
    setNetworkCorrect(matches);

    if (matches && account) {
      fetchWalletConnectState(activeNetworkKey);
    }

    prevAccountRef.current = account;
  }, [isConnected, address, walletType, activeNetworkKey, selectedNetwork, fetchWalletConnectState, isDisconnecting, account]);

  useEffect(() => {
    if (isDisconnecting) return;
    if (walletType !== 'walletconnect') return;
    if (!isConnected || !account || !networkCorrect || !activeNetworkKey) return;

    fetchWalletConnectState(activeNetworkKey);
  }, [walletType, isConnected, account, networkCorrect, fetchWalletConnectState, activeNetworkKey, isDisconnecting]);

  // Автообновление сети при изменении
  useEffect(() => {
    if (!window.ethereum || walletType === 'walletconnect') return;

    const handleAccountsChanged = (accounts) => {
      if (accounts.length === 0) disconnectWallet();
      else {
        setAccount(accounts[0]);
        if (provider) initContract(provider, accounts[0], selectedNetwork);
      }
    };

    const handleChainChanged = async () => {
      const newProvider = new ethers.BrowserProvider(window.ethereum);
      setProvider(newProvider);
      await checkNetwork(newProvider, selectedNetwork);
      if (account) await initContract(newProvider, account, selectedNetwork);
    };

    window.ethereum.on("accountsChanged", handleAccountsChanged);
    window.ethereum.on("chainChanged", handleChainChanged);

    return () => {
      window.ethereum.removeListener("accountsChanged", handleAccountsChanged);
      window.ethereum.removeListener("chainChanged", handleChainChanged);
    };
  }, [provider, account, initContract, checkNetwork, disconnectWallet, walletType, selectedNetwork]);

  useEffect(() => {
    if (provider) checkNetwork(provider, selectedNetwork);
  }, [provider, checkNetwork, selectedNetwork]);

  useEffect(() => {
    if (walletType !== 'walletconnect') return;
    if (!activeNetworkKey) {
      setNetworkCorrect(false);
      return;
    }
    setNetworkCorrect(activeNetworkKey === selectedNetwork);
  }, [walletType, activeNetworkKey, selectedNetwork]);

  useEffect(() => {
    let interval;
    if (timeLeft > 0) {
      interval = setInterval(() => {
        setTimeLeft((prev) => Math.max(prev - 1, 0));
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [timeLeft]);

  // Закрытие выпадающего списка при клике вне его
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (isNetworkDropdownOpen && !event.target.closest('.network-dropdown-container')) {
        setIsNetworkDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isNetworkDropdownOpen]);

  // Центрирование модального окна WalletConnect на мобильных устройствах
  useEffect(() => {
    if (typeof window === 'undefined' || window.innerWidth > 640) return;

    let animationFrameId = null;

    const applyModalStyles = () => {
      // Ищем все возможные селекторы модального окна
      const modalSelectors = [
        'w3m-modal',
        'appkit-modal',
        '[data-appkit-modal]',
        '.w3m-modal',
        '.appkit-modal',
        'div[class*="w3m-modal"]',
        'div[class*="appkit-modal"]'
      ];

      modalSelectors.forEach(selector => {
        try {
          const modals = document.querySelectorAll(selector);
          modals.forEach(modal => {
            if (modal && modal.offsetParent !== null) {
              // Применяем стили к самому модальному окну
              modal.style.setProperty('display', 'flex', 'important');
              modal.style.setProperty('align-items', 'center', 'important');
              modal.style.setProperty('justify-content', 'center', 'important');
              modal.style.setProperty('position', 'fixed', 'important');
              modal.style.setProperty('top', '0', 'important');
              modal.style.setProperty('left', '0', 'important');
              modal.style.setProperty('right', '0', 'important');
              modal.style.setProperty('bottom', '0', 'important');
              modal.style.setProperty('margin', '0', 'important');
              modal.style.setProperty('padding', '0 5px', 'important');
              modal.style.setProperty('background', 'transparent', 'important');
              modal.style.setProperty('z-index', '9999', 'important');
              modal.style.setProperty('transform', 'none', 'important');
              modal.style.setProperty('align-self', 'center', 'important');

              // Обрабатываем все дочерние элементы, особенно контейнеры
              const allChildren = modal.querySelectorAll('*');
              allChildren.forEach((child, index) => {
                if (child && child.style) {
                  // Убираем позиционирование снизу
                  if (child.style.bottom || child.getAttribute('style')?.includes('bottom')) {
                    child.style.setProperty('bottom', 'auto', 'important');
                    child.style.setProperty('top', 'auto', 'important');
                    child.style.setProperty('position', 'relative', 'important');
                    child.style.setProperty('transform', 'none', 'important');
                    child.style.setProperty('align-self', 'center', 'important');
                  }

                  // Убираем transform, который может сдвигать элемент
                  const transform = child.style.transform || child.getAttribute('style')?.match(/transform:\s*([^;]+)/)?.[1];
                  if (transform && (transform.includes('translateY') || transform.includes('translate'))) {
                    child.style.setProperty('transform', 'none', 'important');
                  }

                  // Применяем отступы и ширину к первому уровню дочерних элементов
                  if (child.parentElement === modal) {
                    child.style.setProperty('margin', '0 5px', 'important');
                    child.style.setProperty('max-width', 'calc(100% - 10px)', 'important');
                    child.style.setProperty('width', 'calc(100% - 10px)', 'important');
                    child.style.setProperty('align-self', 'center', 'important');
                  }

                  // Убираем темный фон
                  if (child.style.background && child.style.background !== 'transparent') {
                    child.style.setProperty('background', 'transparent', 'important');
                  }
                }
              });
            }
          });
        } catch (e) {
          // Игнорируем ошибки для невалидных селекторов
        }
      });
    };

    const runWithAnimationFrame = () => {
      applyModalStyles();
      animationFrameId = requestAnimationFrame(runWithAnimationFrame);
    };

    // Применяем стили сразу
    applyModalStyles();

    // Используем requestAnimationFrame для более частого обновления
    animationFrameId = requestAnimationFrame(runWithAnimationFrame);

    // Также используем интервал как резерв
    const interval = setInterval(applyModalStyles, 50);

    // Отслеживаем изменения в DOM
    const observer = new MutationObserver(() => {
      applyModalStyles();
    });
    observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['style', 'class']
    });

    return () => {
      if (animationFrameId) {
        cancelAnimationFrame(animationFrameId);
      }
      clearInterval(interval);
      observer.disconnect();
    };
  }, []);

  const totalVotes = happyVotes + sadVotes;
  const happyPercent = totalVotes ? Math.round((happyVotes / totalVotes) * 100) : 0;
  const sadPercent = totalVotes ? 100 - happyPercent : 0;
  const topLeaderboard = leaderboard.slice(0, 10);
  const extraLeaderboard = leaderboard.slice(10);

  const NetworkIcon = ({ isMainnet }) => (
      <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
        <g clipPath="url(#clip0_3845_96712)">
          <path d="M9.99994 0C7.11219 0 0 7.112 0 9.99994C0 12.8879 7.11219 20 9.99994 20C12.8877 20 20 12.8877 20 9.99994C20 7.11212 12.8878 0 9.99994 0ZM8.44163 15.7183C7.22388 15.3864 3.94988 9.65938 4.28177 8.44163C4.61366 7.22381 10.3406 3.94987 11.5583 4.28175C12.7761 4.61358 16.0501 10.3406 15.7183 11.5584C15.3864 12.7761 9.65938 16.0501 8.44163 15.7183Z" fill={isMainnet ? "#836EF9" : "#9CA3AF"}></path>
        </g>
        <defs>
          <clipPath id="clip0_3845_96712">
            <rect width="20" height="20" fill="white"></rect>
          </clipPath>
        </defs>
      </svg>
  );

  const WalletIcon = () => (
      <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M16.6667 4.16667H15.8333V2.5C15.8333 1.57917 15.0875 0.833336 14.1667 0.833336H2.5C1.57917 0.833336 0.833336 1.57917 0.833336 2.5V17.5C0.833336 18.4208 1.57917 19.1667 2.5 19.1667H14.1667C15.0875 19.1667 15.8333 18.4208 15.8333 17.5V15.8333H16.6667C17.5875 15.8333 18.3333 15.0875 18.3333 14.1667V5.83333C18.3333 4.9125 17.5875 4.16667 16.6667 4.16667ZM14.1667 17.5H2.5V2.5H14.1667V4.16667H8.33334C7.4125 4.16667 6.66667 4.9125 6.66667 5.83333V14.1667C6.66667 15.0875 7.4125 15.8333 8.33334 15.8333H14.1667V17.5ZM16.6667 14.1667H8.33334V5.83333H16.6667V14.1667Z" fill="currentColor"/>
      </svg>
  );

  return (
      <div className="app-container">
        <div className="floating-controls">
          <div className="controls-row">
            {/* Network Selector */}
            <div className="network-dropdown-container">
              <button
                  className="network-selector-button"
                  onClick={() => setIsNetworkDropdownOpen(!isNetworkDropdownOpen)}
                  disabled={isWalletConnectLocked}
              >
                <NetworkIcon isMainnet={selectedNetwork === 'mainnet'} />
                <span>Monad {selectedNetworkConfig.label}</span>
                <svg width="12" height="12" viewBox="0 0 12 12" fill="none" xmlns="http://www.w3.org/2000/svg" className="dropdown-arrow">
                  <path d="M6 9L1 4H11L6 9Z" fill="currentColor"/>
                </svg>
              </button>
              {isNetworkDropdownOpen && (
                  <div className="network-dropdown">
                    {networkOptions.map((network) => (
                        <button
                            key={network.key}
                            className={`network-dropdown-item ${selectedNetwork === network.key ? 'active' : ''}`}
                            onClick={() => handleNetworkChange(network.key)}
                        >
                          <NetworkIcon isMainnet={network.key === 'mainnet'} />
                          <span>Monad {network.label}</span>
                        </button>
                    ))}
                  </div>
              )}
            </div>

            {/* Connect Wallet Button */}
            {account ? (
                <div className="wallet-connected">
                  <span className="wallet-address">{formatAddressShort(account)}</span>
                  <button onClick={disconnectWallet} className="disconnect-button-small">Disconnect</button>
                </div>
            ) : (
                <button
                    className="connect-wallet-button"
                    onClick={handleConnectWallet}
                    disabled={loading.wallet}
                >
                  <WalletIcon />
                  <span>Connect Wallet</span>
                </button>
            )}

            {/* Theme Toggle */}
            <button onClick={toggleTheme} className="theme-toggle">
              <span className="theme-icon">{isDarkTheme ? '🌙' : '☀️'}</span>
            </button>
          </div>
        </div>

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
                  onClick={() => switchNetwork()}
                  className="switch-network-button"
                  disabled={loading.network}
              >
                {loading.network ? "Switching..." : `Switch to Monad ${selectedNetworkConfig.label}`}
              </button>
            </div>
        )}

        <div className="title-row">
          <h1 className="app-title">Make the world happier 🌍</h1>
          <span className={`network-badge ${displayNetworkKey === 'mainnet' ? 'badge-mainnet' : 'badge-testnet'}`}>
            {displayNetworkConfig?.label || 'Mainnet'}
          </span>
          {refundEnabled ? (
              <div
                className={`refund-badge-container ${tooltipVisible ? 'tooltip-visible' : ''}`}
                onClick={(e) => {
                  e.stopPropagation();
                  setTooltipVisible(!tooltipVisible);
                }}
              >
                <span className="refund-badge" title="Gas refund is enabled">
                  💰 Gas Refund
                </span>
                <div className="refund-tooltip">
                  Gas refund is active! When you vote, a portion of your transaction fee will be automatically refunded to your wallet.
                </div>
              </div>
            ) : null}
        </div>

        <p className="app-description">
          The app is designed to highlight the abundance of positivity around us and to track the overall mood of users across the Monad network.
        </p>

        <div className="vote-section">
          <div className="vote-buttons">
            <button
                onClick={() => vote(true)}
                disabled={!account || !canVote || loading.voting}
                className="happy-button"
            >
              😊 I'm Happy
            </button>
            <button
                onClick={() => vote(false)}
                disabled={!account || !canVote || loading.voting}
                className="sad-button"
            >
              😢 I'm Sad
            </button>
          </div>

          {!account && (
              <p className="connect-hint"><strong>Connect a wallet to vote and track your cooldown.</strong></p>
          )}

          {account && !canVote && timeLeft !== null && (
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

          {displayNetworkKey === 'mainnet' && (
              <div className="leaderboard">
                <div className="leaderboard-header">
                  <h3>Happy Leaderboard</h3>
                  <span>Top smiles on Monad {displayNetworkConfig?.label}</span>
                </div>

                {topLeaderboard.length === 0 ? (
                    <p className="leaderboard-empty">Be the first happy voter on mainnet!</p>
                ) : (
                    <>
                      <ol className="leaderboard-list">
                        {topLeaderboard.map((row, index) => (
                            <li key={`${row.address}-${index}`}>
                              <span className="leaderboard-rank">#{index + 1}</span>
                              <span className="leaderboard-address">{formatAddressShort(row.address)}</span>
                              <span className="leaderboard-votes">{row.happyVotes} 😊</span>
                            </li>
                        ))}
                      </ol>

                      {extraLeaderboard.length > 0 && (
                          <details className="leaderboard-extra">
                            <summary>Show the rest ({extraLeaderboard.length})</summary>
                            <div className="leaderboard-scroll">
                              <ol start={11}>
                                {extraLeaderboard.map((row, index) => (
                                    <li key={`${row.address}-${index + 10}`}>
                                      <span className="leaderboard-rank">#{index + 11}</span>
                                      <span className="leaderboard-address">{formatAddressShort(row.address)}</span>
                                      <span className="leaderboard-votes">{row.happyVotes} 😊</span>
                                    </li>
                                ))}
                              </ol>
                            </div>
                          </details>
                      )}
                    </>
                )}
              </div>
          )}
        </div>

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
            <button
                onClick={donate}
                className="donate-button"
                disabled={loading.donation}
            >
              {loading.donation ? "Processing..." : "Donate 10 MON"}
            </button>
          </div>
        </div>

        <a
          href="https://github.com/pittpv/happy-vote-app/blob/master/public/Concept-Evaluation-Summary-En.md"
          target="_blank"
          rel="noopener noreferrer"
          className="concept-evaluation-link"
        >
          Concept Evaluation Summary
        </a>
      </div>
  );
}

export default App;
