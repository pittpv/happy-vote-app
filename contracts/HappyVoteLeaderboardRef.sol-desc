// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

contract HappyVoteLeaderboardTopN {
    uint256 public constant COOLDOWN = 1 days;
    uint256 private constant FIXED_OVERHEAD = 50000; // Gas overhead for refund calculation

    uint256 public happyVotes;
    uint256 public sadVotes;

    mapping(address => uint256) public lastVotedAt;
    mapping(address => uint256) public happyVoteCount;

    address[] private leaderboard;
    mapping(address => uint256) private indexOf;
    uint256 public topN;

    address public owner;

    // Refund-on-vote state variables
    bool public refundEnabled;
    uint256 public maxRefundPerVoteWei;
    uint256 public totalRefunded;
    mapping(address => uint256) public refundedBy;
    mapping(address => uint256) public owed; // Pull model for failed transfers
    bool public paused;

    // ReentrancyGuard
    uint256 private _status;
    uint256 private constant _NOT_ENTERED = 1;
    uint256 private constant _ENTERED = 2;

    event Voted(address indexed user, bool isHappy);
    event LeaderboardUpdated(address indexed by, address indexed account, uint256 newCount);
    event LeaderboardMemberRemoved(address indexed account);
    event LeaderboardCleared();
    event TopNChanged(uint256 oldTopN, uint256 newTopN);
    event OwnerTransferred(address indexed oldOwner, address indexed newOwner);

    // Refund events
    event RefundEnabledChanged(bool oldValue, bool newValue);
    event MaxRefundPerVoteChanged(uint256 oldValue, uint256 newValue);
    event RefundPaid(address indexed to, uint256 requestedWei, uint256 paidWei);
    event RefundFailed(address indexed to, uint256 requestedWei, string reason);
    event FundsDeposited(address indexed from, uint256 amount);
    event FundsWithdrawn(address indexed to, uint256 amount);
    event Paused(address indexed by);
    event Unpaused(address indexed by);
    event RefundClaimed(address indexed to, uint256 amount);

    modifier onlyOwner() {
        require(msg.sender == owner, "Not owner");
        _;
    }

    modifier whenNotPaused() {
        require(!paused, "Contract is paused");
        _;
    }

    modifier nonReentrant() {
        require(_status != _ENTERED, "ReentrancyGuard: reentrant call");
        _status = _ENTERED;
        _;
        _status = _NOT_ENTERED;
    }

    constructor(uint256 _topN) {
        require(_topN > 0, "topN must be > 0");
        topN = _topN;
        owner = msg.sender;
        _status = _NOT_ENTERED;
        refundEnabled = false;
        paused = false;
        // Default maxRefundPerVoteWei = 0.01 MON (assuming 18 decimals)
        // This should be set explicitly by owner after deployment
        maxRefundPerVoteWei = 0;
    }

    function transferOwnership(address newOwner) external onlyOwner {
        require(newOwner != address(0), "zero address");
        address old = owner;
        owner = newOwner;
        emit OwnerTransferred(old, newOwner);
    }

    function vote(bool isHappy) external nonReentrant whenNotPaused {
        // Checks
        require(
            block.timestamp - lastVotedAt[msg.sender] >= COOLDOWN,
            "You can only vote once every 24 hours"
        );

        // Measure gas at start for refund calculation
        uint256 gasStart = gasleft();

        // Effects
        lastVotedAt[msg.sender] = block.timestamp;

        if (isHappy) {
            happyVotes += 1;
            happyVoteCount[msg.sender] += 1;
            _updateLeaderboardOnHappyVote(msg.sender);
        } else {
            sadVotes += 1;
        }

        emit Voted(msg.sender, isHappy);

        // Measure gas after effects but BEFORE refund logic
        // This gives us the gas consumed by the vote logic itself
        uint256 gasAfterEffects = gasleft();

        // Interactions: refund attempt (if enabled)
        if (refundEnabled) {
            _processRefund(gasStart, gasAfterEffects);
        }
    }

    // Internal function to process refund
    function _processRefund(uint256 gasStart, uint256 gasAfterEffects) internal {
        uint256 estimatedWei = _estimateRefund(gasStart, gasAfterEffects);
        if (estimatedWei == 0) {
            return;
        }

        // Calculate payable amount: min(estimated, maxRefund, balance)
        uint256 pay = estimatedWei;
        if (pay > maxRefundPerVoteWei) {
            pay = maxRefundPerVoteWei;
        }
        if (pay > address(this).balance) {
            pay = address(this).balance;
        }

        if (pay > 0) {
            // Attempt to send refund (push model)
            (bool success, ) = payable(msg.sender).call{value: pay}("");
            if (success) {
                totalRefunded += pay;
                refundedBy[msg.sender] += pay;
                emit RefundPaid(msg.sender, estimatedWei, pay);
            } else {
                // Transfer failed - use pull model
                owed[msg.sender] += pay;
                emit RefundFailed(msg.sender, estimatedWei, "transfer failed");
            }
        }
    }

    // Estimate refund based on gas consumed by vote logic (excluding refund logic itself)
    // gasStart: gas remaining at the start of vote()
    // gasAfterEffects: gas remaining after effects but before refund logic
    function _estimateRefund(uint256 gasStart, uint256 gasAfterEffects) internal view returns (uint256) {
        // Calculate gas used by the vote logic itself (checks + effects)
        // This excludes the refund logic gas consumption
        uint256 gasUsedByVote = gasStart - gasAfterEffects;
        
        // Add fixed overhead to account for:
        // - Gas cost of the refund calculation and transfer
        // - Additional overhead that may occur after measurement
        uint256 gasEstimate = gasUsedByVote + FIXED_OVERHEAD;
        
        // Calculate estimated cost in wei
        uint256 estimatedWei = gasEstimate * tx.gasprice;
        return estimatedWei;
    }

    // Owner functions for refund management
    function setRefundEnabled(bool enabled) external onlyOwner {
        bool oldValue = refundEnabled;
        refundEnabled = enabled;
        emit RefundEnabledChanged(oldValue, enabled);
    }

    function setMaxRefundPerVote(uint256 maxWei) external onlyOwner {
        uint256 oldValue = maxRefundPerVoteWei;
        maxRefundPerVoteWei = maxWei;
        emit MaxRefundPerVoteChanged(oldValue, maxWei);
    }

    function deposit() external payable {
        require(msg.value > 0, "Must send value");
        emit FundsDeposited(msg.sender, msg.value);
    }

    function withdraw(uint256 amountWei, address payable to) external onlyOwner {
        require(to != address(0), "zero address");
        require(amountWei > 0, "amount must be > 0");
        require(address(this).balance >= amountWei, "Insufficient balance");
        (bool success, ) = to.call{value: amountWei}("");
        require(success, "Withdraw failed");
        emit FundsWithdrawn(to, amountWei);
    }

    function pause() external onlyOwner {
        require(!paused, "Already paused");
        paused = true;
        emit Paused(msg.sender);
    }

    function unpause() external onlyOwner {
        require(paused, "Not paused");
        paused = false;
        emit Unpaused(msg.sender);
    }

    // Pull model: allow users to claim their owed refunds
    function claimRefund() external nonReentrant {
        uint256 amount = owed[msg.sender];
        require(amount > 0, "No refund owed");
        require(address(this).balance >= amount, "Insufficient contract balance");

        owed[msg.sender] = 0;
        totalRefunded += amount;
        refundedBy[msg.sender] += amount;

        (bool success, ) = payable(msg.sender).call{value: amount}("");
        require(success, "Refund claim failed");
        emit RefundClaimed(msg.sender, amount);
    }

    // View function to get refund statistics
    function getRefundStats() external view returns (
        bool enabled,
        uint256 maxRefund,
        uint256 totalRefundedAmount,
        uint256 contractBalance,
        uint256 userRefunded,
        uint256 userOwed
    ) {
        return (
            refundEnabled,
            maxRefundPerVoteWei,
            totalRefunded,
            address(this).balance,
            refundedBy[msg.sender],
            owed[msg.sender]
        );
    }

    function getVotes() external view returns (uint256 happy, uint256 sad) {
        return (happyVotes, sadVotes);
    }

    function canVote(address user) external view returns (bool) {
        return block.timestamp - lastVotedAt[user] >= COOLDOWN;
    }

    function timeUntilNextVote(address user) external view returns (uint256) {
        uint256 lastTime = lastVotedAt[user];
        if (block.timestamp - lastTime >= COOLDOWN) {
            return 0;
        }
        return COOLDOWN - (block.timestamp - lastTime);
    }

    function getHappyLeaderboard()
        external
        view
        returns (address[] memory addresses, uint256[] memory counts)
    {
        uint256 len = leaderboard.length;
        addresses = new address[](len);
        counts = new uint256[](len);
        for (uint256 i = 0; i < len; i++) {
            addresses[i] = leaderboard[i];
            counts[i] = happyVoteCount[leaderboard[i]];
        }
    }

    function _updateLeaderboardOnHappyVote(address voter) internal {
        uint256 voterCount = happyVoteCount[voter];
        uint256 currentIndex = indexOf[voter];

        if (currentIndex > 0) {
            uint256 idx = currentIndex - 1;
            while (idx > 0) {
                address prevAddr = leaderboard[idx - 1];
                if (voterCount <= happyVoteCount[prevAddr]) break;
                leaderboard[idx - 1] = voter;
                leaderboard[idx] = prevAddr;
                indexOf[voter] = idx;
                indexOf[prevAddr] = idx + 1;
                idx--;
            }
            emit LeaderboardUpdated(msg.sender, voter, voterCount);
            return;
        }

        if (leaderboard.length < topN) {
            leaderboard.push(voter);
            indexOf[voter] = leaderboard.length;
            uint256 idx = leaderboard.length - 1;
            while (idx > 0) {
                address prevAddr = leaderboard[idx - 1];
                if (voterCount <= happyVoteCount[prevAddr]) break;
                leaderboard[idx - 1] = voter;
                leaderboard[idx] = prevAddr;
                indexOf[voter] = idx;
                indexOf[prevAddr] = idx + 1;
                idx--;
            }
            emit LeaderboardUpdated(msg.sender, voter, voterCount);
            return;
        }

        uint256 lastIndex = leaderboard.length - 1;
        address lastAddr = leaderboard[lastIndex];
        uint256 lastCount = happyVoteCount[lastAddr];

        if (voterCount <= lastCount) {
            return;
        }

        indexOf[lastAddr] = 0;
        leaderboard[lastIndex] = voter;
        indexOf[voter] = lastIndex + 1;

        uint256 idx2 = lastIndex;
        while (idx2 > 0) {
            address prevAddr = leaderboard[idx2 - 1];
            if (voterCount <= happyVoteCount[prevAddr]) break;
            leaderboard[idx2 - 1] = voter;
            leaderboard[idx2] = prevAddr;
            indexOf[voter] = idx2;
            indexOf[prevAddr] = idx2 + 1;
            idx2--;
        }

        emit LeaderboardUpdated(msg.sender, voter, voterCount);
    }

    function removeMember(address account) external onlyOwner {
        uint256 idx1 = indexOf[account];
        require(idx1 > 0, "not in leaderboard");
        uint256 idx = idx1 - 1;
        uint256 len = leaderboard.length;

        for (uint256 i = idx; i + 1 < len; i++) {
            leaderboard[i] = leaderboard[i + 1];
            indexOf[leaderboard[i]] = i + 1;
        }
        leaderboard.pop();
        indexOf[account] = 0;
        emit LeaderboardMemberRemoved(account);
    }

    function clearLeaderboard() external onlyOwner {
        for (uint256 i = 0; i < leaderboard.length; i++) {
            indexOf[leaderboard[i]] = 0;
        }
        delete leaderboard;
        emit LeaderboardCleared();
    }

    function setTopN(uint256 newTopN) external onlyOwner {
        require(newTopN > 0, "topN must be > 0");
        uint256 old = topN;
        if (newTopN == old) return;
        topN = newTopN;

        if (leaderboard.length > newTopN) {
            for (uint256 i = newTopN; i < leaderboard.length; i++) {
                indexOf[leaderboard[i]] = 0;
            }
            while (leaderboard.length > newTopN) {
                leaderboard.pop();
            }
        }
        emit TopNChanged(old, newTopN);
    }

    function getIndexOf(address account) external view returns (uint256) {
        return indexOf[account];
    }

    function getLeaderboardAddresses() external view returns (address[] memory) {
        return leaderboard;
    }
}
