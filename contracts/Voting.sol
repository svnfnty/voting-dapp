// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

contract Voting {
    struct Candidate {
        string name;
        uint voteCount;
    }

    address public owner;
    mapping(address => bool) public hasVoted;
    Candidate[] public candidates;

    // Declare the VoteCast event
    event VoteCast(address indexed voter, uint indexed candidateIndex);

    constructor(string[] memory candidateNames) {
        owner = msg.sender;
        for (uint i = 0; i < candidateNames.length; i++) {
            candidates.push(Candidate(candidateNames[i], 0));
        }
    }

    function vote(uint candidateIndex) public {
        require(!hasVoted[msg.sender], "Already voted.");
        require(candidateIndex < candidates.length, "Invalid candidate.");
        hasVoted[msg.sender] = true;
        candidates[candidateIndex].voteCount++;

        // Emit the VoteCast event after the vote
        emit VoteCast(msg.sender, candidateIndex);
    }

    function getNumOfCandidates() public view returns (uint) {
        return candidates.length;
    }

    function totalCandidates() public view returns (uint) {
        return candidates.length;
    }
}
