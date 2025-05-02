const contractAddress = "YOUR_CONTRACT_ADDRESS"; // Адрес контракта
const abi = [
    // Минимальный ABI для работы с контрактом
    "function vote(bool isHappy) external",
    "function getVotes() external view returns (uint256 happy, uint256 sad)",
    "function timeUntilNextVote(address user) external view returns (uint256)"
];

// Подключение к MetaMask
const provider = new ethers.Web3Provider(window.ethereum);
let signer;
let contract;

async function init() {
    await provider.send("eth_requestAccounts", []);
    signer = provider.getSigner();
    contract = new ethers.Contract(contractAddress, abi, signer);

    // Загрузка голосов и времени до следующего голосования
    await updateVotes();
}

async function updateVotes() {
    const [happyVotes, sadVotes] = await contract.getVotes();
    const timeLeft = await contract.timeUntilNextVote(await signer.getAddress());

    // Обновление интерфейса
    document.getElementById("happy-count").innerText = happyVotes.toString();
    document.getElementById("sad-count").innerText = sadVotes.toString();

    const totalVotes = happyVotes + sadVotes;
    const happyPercentage = totalVotes > 0 ? Math.round((happyVotes / totalVotes) * 100) : 0;
    const sadPercentage = totalVotes > 0 ? Math.round((sadVotes / totalVotes) * 100) : 0;

    document.getElementById("counter").innerText = `Happy: ${happyPercentage}% | Sad: ${sadPercentage}%`;

    if (timeLeft > 0) {
        document.getElementById("time-left").innerText = timeLeft;
    } else {
        document.getElementById("time-left").innerText = "You can vote now!";
    }
}

async function vote(isHappy) {
    const canVote = await contract.canVote(await signer.getAddress());
    if (!canVote) {
        alert("You can only vote once every 24 hours.");
        return;
    }

    // Отправка голосования в блокчейн
    await contract.vote(isHappy);
    await updateVotes();
}

// Инициализация приложения
init();
