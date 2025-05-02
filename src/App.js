import React, { useState, useEffect } from "react";
import { ethers } from "ethers";
import abi from "./abi.json";

const contractAddress = "0x7fB4F5Fc2a6f2FAa86F5F37EAEE8A0db820ad9E0";

function App() {
  const [provider, setProvider] = useState(null);
  const [contract, setContract] = useState(null);
  const [account, setAccount] = useState(null);
  const [happyPercent, setHappyPercent] = useState(0);
  const [sadPercent, setSadPercent] = useState(0);
  const [canVote, setCanVote] = useState(false);
  const [loading, setLoading] = useState(false);
  const [timeLeft, setTimeLeft] = useState(null);

  useEffect(() => {
    let interval;
    if (timeLeft > 0) {
      interval = setInterval(() => {
        setTimeLeft((prev) => Math.max(prev - 1, 0));
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [timeLeft]);

  const connectWallet = async () => {
    try {
      if (!window.ethereum) {
        alert("Please install MetaMask.");
        return;
      }

      const accounts = await window.ethereum.request({ method: "eth_requestAccounts" });
      setAccount(accounts[0]);

      const newProvider = new ethers.BrowserProvider(window.ethereum);
      const signer = await newProvider.getSigner();
      const newContract = new ethers.Contract(contractAddress, abi, signer);

      setProvider(newProvider);
      setContract(newContract);

      await fetchPercentages(newContract);
      await checkCanVote(newContract, accounts[0]);
      await getTimeUntilNextVote(newContract, accounts[0]);
    } catch (err) {
      console.error("Wallet connection failed", err);
      alert("Failed to connect wallet.");
    }
  };

  const fetchPercentages = async (contractInstance) => {
    try {
      const [happy, sad] = await contractInstance.getVotePercentages();
      setHappyPercent(Number(happy));
      setSadPercent(Number(sad));
    } catch (err) {
      console.warn("No votes yet or failed to fetch percentages:", err);
      setHappyPercent(0);
      setSadPercent(0);
    }
  };


  const checkCanVote = async (contractInstance, user) => {
    try {
      const allowed = await contractInstance.canVote(user);
      setCanVote(allowed);
    } catch (err) {
      console.error("Failed to check voting status:", err);
    }
  };

  const getTimeUntilNextVote = async (contractInstance, user) => {
    try {
      const seconds = await contractInstance.timeUntilNextVote(user);
      setTimeLeft(Number(seconds));
    } catch (err) {
      console.error("Failed to fetch time until next vote:", err);
    }
  };

  const vote = async (isHappy) => {
    if (!contract) {
      alert("Please connect wallet first.");
      return;
    }

    try {
      setLoading(true);
      const tx = await contract.vote(isHappy);
      await tx.wait();

      await fetchPercentages(contract);
      await checkCanVote(contract, account);
      await getTimeUntilNextVote(contract, account);
    } catch (err) {
      console.error("Vote failed:", err);
      alert("Vote failed or already voted.");
    } finally {
      setLoading(false);
    }
  };

  const formatTime = (sec) => {
    const h = Math.floor(sec / 3600);
    const m = Math.floor((sec % 3600) / 60);
    const s = sec % 60;
    return `${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  };

  return (
      <div style={{ fontFamily: "Arial", textAlign: "center", marginTop: "40px" }}>
        <h2>Make the world happier 🌍</h2>

        {!account ? (
            <button onClick={connectWallet} style={{ padding: "10px 20px", fontSize: "16px" }}>
              Connect Wallet
            </button>
        ) : (
            <>
              <p>Connected: {account}</p>

              <div style={{ margin: "20px 0" }}>
                <button
                    onClick={() => vote(true)}
                    disabled={!canVote || loading}
                    style={{ fontSize: "18px", marginRight: "20px", padding: "10px 20px" }}
                >
                  😊 I'm Happy
                </button>

                <button
                    onClick={() => vote(false)}
                    disabled={!canVote || loading}
                    style={{ fontSize: "18px", padding: "10px 20px" }}
                >
                  😢 I'm Sad
                </button>
              </div>

              {!canVote && (
                  <div>
                    <p style={{ color: "red" }}>
                      You’ve already voted. Try again in 24 hours.
                    </p>
                    {timeLeft !== null && timeLeft > 0 && (
                        <p style={{ color: "gray" }}>
                          You can vote again in {formatTime(timeLeft)}
                        </p>
                    )}
                  </div>
              )}

              <h3>Current Mood</h3>
              <p>😊 Happy: {happyPercent}%</p>
              <p>😢 Sad: {sadPercent}%</p>
            </>
        )}
      </div>
  );
}

export default App;
