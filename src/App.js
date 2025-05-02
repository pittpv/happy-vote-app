import React, { useState } from "react";
import { ethers } from "ethers";
import abi from "./abi.json";

const contractAddress = "0x7fB4F5Fc2a6f2FAa86F5F37EAEE8A0db820ad9E0";

function App() {
  const [provider, setProvider] = useState(null);
  const [contract, setContract] = useState(null);
  const [account, setAccount] = useState(null);
  const [happyVotes, setHappyVotes] = useState(0);
  const [sadVotes, setSadVotes] = useState(0);
  const [canVote, setCanVote] = useState(false);
  const [loading, setLoading] = useState(false);

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

      await updateVotes(newContract);
      await checkCanVote(newContract, accounts[0]);
    } catch (err) {
      console.error("Wallet connection failed", err);
      alert("Failed to connect wallet.");
    }
  };

  const updateVotes = async (contractInstance) => {
    try {
      const [happy, sad] = await contractInstance.getVotes();
      setHappyVotes(Number(happy));
      setSadVotes(Number(sad));
    } catch (err) {
      console.error("Failed to fetch votes:", err);
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

  const vote = async (isHappy) => {
    if (!contract) {
      alert("Please connect wallet first.");
      return;
    }

    try {
      setLoading(true);
      const tx = await contract.vote(isHappy);
      await tx.wait();

      await updateVotes(contract);
      await checkCanVote(contract, account);
    } catch (err) {
      console.error("Vote failed:", err);
      alert("Vote failed or already voted.");
    } finally {
      setLoading(false);
    }
  };

  const totalVotes = happyVotes + sadVotes;
  const happyPercent = totalVotes ? ((happyVotes / totalVotes) * 100).toFixed(1) : 0;
  const sadPercent = totalVotes ? ((sadVotes / totalVotes) * 100).toFixed(1) : 0;

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
                  <p style={{ color: "red" }}>
                    You’ve already voted. Try again in 24 hours.
                  </p>
              )}

              <h3>Current Mood</h3>
              <p>😊 Happy: {happyPercent}%</p>
              <p>😊 Happy: {happyVotes}</p>
              <p>😢 Sad: {sadPercent}%</p>
            </>
        )}
      </div>
  );
}

export default App;
