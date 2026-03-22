// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title PrismReceipts — On-chain analysis receipts for Prism Oracle
/// @notice Thin receipt contract. Does NOT handle payments (x402 handles that).
/// @dev Logs immutable records of completed analyses on Base.
contract PrismReceipts {
    address public agent;
    uint256 public totalAnalyses;

    struct Receipt {
        address requester;
        string reportCID;      // IPFS CID of the full analysis report
        uint256 costUSDC;      // Cost in USDC (6 decimals)
        uint256 depthScore;    // Depth score * 10 (e.g., 98 = 9.8)
        uint256 bugsFound;
        uint256 timestamp;
    }

    mapping(uint256 => Receipt) public receipts;

    event AnalysisCompleted(
        uint256 indexed id,
        address indexed requester,
        string reportCID,
        uint256 costUSDC,
        uint256 depthScore,
        uint256 bugsFound,
        uint256 timestamp
    );

    modifier onlyAgent() {
        require(msg.sender == agent, "Only the agent can record analyses");
        _;
    }

    constructor() {
        agent = msg.sender;
    }

    /// @notice Record a completed analysis
    function recordAnalysis(
        address requester,
        string calldata reportCID,
        uint256 costUSDC,
        uint256 depthScore,
        uint256 bugsFound
    ) external onlyAgent returns (uint256) {
        uint256 id = totalAnalyses++;
        receipts[id] = Receipt({
            requester: requester,
            reportCID: reportCID,
            costUSDC: costUSDC,
            depthScore: depthScore,
            bugsFound: bugsFound,
            timestamp: block.timestamp
        });

        emit AnalysisCompleted(
            id,
            requester,
            reportCID,
            costUSDC,
            depthScore,
            bugsFound,
            block.timestamp
        );

        return id;
    }

    /// @notice Get receipt by ID
    function getReceipt(uint256 id) external view returns (Receipt memory) {
        require(id < totalAnalyses, "Receipt does not exist");
        return receipts[id];
    }

    /// @notice Transfer agent role (for key rotation)
    function transferAgent(address newAgent) external onlyAgent {
        require(newAgent != address(0), "Invalid agent address");
        agent = newAgent;
    }
}
