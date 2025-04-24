const express = require('express');
const Web3 = require('web3');
const fs = require('fs');
const path = require('path');
const cors = require('cors');
const app = express();
const port = 3000;

// Configuration
const GANACHE_URL = 'http://127.0.0.1:8545';
const CONTRACT_PATH = '../build/contracts/Voting.json';
const TRANSACTION_HISTORY_PATH = './transactionHistory.json';
const VERIFIED_USERS_PATH = './verified-users.json';

// Web3 and contract initialization
let web3, contract;
let transactionHistory = loadTransactionHistory();

console.log('Initializing application...');

// Create verified-users.json if it doesn't exist
if (!fs.existsSync(VERIFIED_USERS_PATH)) {
  console.log('Creating verified-users.json as it does not exist');
  fs.writeFileSync(VERIFIED_USERS_PATH, JSON.stringify([]));
}

async function initializeBlockchain() {
  try {
    console.log('Initializing blockchain connection...');
    web3 = new Web3.default(GANACHE_URL);

    const nodeInfo = await web3.eth.getNodeInfo();
    console.log(`Connected to: ${nodeInfo}`);

    console.log('Loading contract...');
    const contractJSON = JSON.parse(fs.readFileSync(CONTRACT_PATH));
    const networkId = await web3.eth.net.getId();
    console.log(`Current network ID: ${networkId}`);

    const deployedNetwork = contractJSON.networks[networkId];

    if (!deployedNetwork) throw new Error('Contract not deployed on current network');

    contract = new web3.eth.Contract(contractJSON.abi, deployedNetwork.address);
    console.log(`Contract initialized at ${deployedNetwork.address}`);

    // Load past events from the blockchain
    console.log('Loading past VoteCast events...');
    const pastEvents = await contract.getPastEvents('VoteCast', {
      fromBlock: 0,
      toBlock: 'latest'
    });

    transactionHistory = pastEvents.map(event => ({
      voter: event.returnValues.voter,
      candidateId: event.returnValues.candidateId,
      transactionHash: event.transactionHash,
      timestamp: new Date().toISOString()
    }));

    console.log(`Loaded ${transactionHistory.length} past votes`);
  

    // Listen for new events
    console.log('Setting up VoteCast event listener...');
    contract.events.VoteCast({}, (error, event) => {
      if (error) {
        console.error('Error listening to VoteCast event:', error);
        return;
      }

      console.log('New VoteCast event detected:', event);
      const voteRecord = {
        voter: event.returnValues.voter,
        candidateId: event.returnValues.candidateId,
        transactionHash: event.transactionHash,
        timestamp: new Date().toISOString()
      };

      transactionHistory.push(voteRecord);
      saveTransactionHistory();
    });

    return true;
  } catch (error) {
    console.error('Blockchain initialization failed:', error.message);
    return false;
  }
}

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '../frontend')));

// Routes
app.get('/', (req, res) => {
  console.log('Serving index.html');
  res.sendFile(path.join(__dirname, '../frontend/index.html'));
});

app.post('/store-verified-user', (req, res) => {
  try {
    console.log('Storing verified user:', req.body);
    const { address, nullifier_hash, timestamp } = req.body;
    
    if (!nullifier_hash) {
      console.log('Missing nullifier_hash in request');
      return res.status(400).json({ success: false, message: 'Missing nullifier_hash' });
    }

    let users = [];
    if (fs.existsSync(VERIFIED_USERS_PATH)) {
      users = JSON.parse(fs.readFileSync(VERIFIED_USERS_PATH));
    }

    // Check if nullifier_hash already exists
    const alreadyVerified = users.some(user => user.nullifier_hash === nullifier_hash);
    if (alreadyVerified) {
      console.log('User already verified');
      return res.status(200).json({ success: false, message: 'Already verified' });
    }

    const newUser = { address, nullifier_hash, timestamp };
    users.push(newUser);
    fs.writeFileSync(VERIFIED_USERS_PATH, JSON.stringify(users, null, 2));
    console.log('Verified user stored successfully');

    res.json({ success: true });
  } catch (error) {
    console.error('Error storing verified user:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

app.post('/vote', async (req, res) => {
  try {
    console.log('Vote request received:', req.body);
    const { candidateId, voterAddress } = req.body;

    if (!contract) {
      console.log('No contract available - running in test mode');
      return res.json({
        success: true,
        message: "Vote simulated (test mode)",
        candidateId
      });
    }

    // Load transaction history
    let transactionHistory = [];
    try {
      if (fs.existsSync(TRANSACTION_HISTORY_PATH)) {
        transactionHistory = JSON.parse(fs.readFileSync(TRANSACTION_HISTORY_PATH));
      }
    } catch (err) {
      console.error('Error reading transaction history:', err);
    }

    // Check if voterAddress exists in transaction history
    const hasAlreadyVoted = transactionHistory.some(
      tx => tx.voter.toLowerCase() === voterAddress.toLowerCase()
    );

    if (hasAlreadyVoted) {
      throw new Error('Voters Address already cast a vote');
    }

    console.log('Getting accounts...');
    const accounts = await web3.eth.getAccounts();
    if (accounts.length === 0) throw new Error('No accounts available for voting');
    console.log(`Using account: ${accounts[0]}`);

    console.log('Estimating gas for vote transaction...');
    const gasEstimate = await contract.methods.vote(candidateId)
      .estimateGas({ from: accounts[0] });
    console.log(`Gas estimate: ${gasEstimate}`);

    console.log('Fetching current gas price...');
    const gasPrice = await web3.eth.getGasPrice();
    console.log(`Gas price: ${gasPrice}`);

    console.log('Sending vote transaction...');
    const receipt = await contract.methods.vote(candidateId)
      .send({
        from: accounts[0],
        gas: Number(gasEstimate) + 10000,
        gasPrice: gasPrice
      });
    console.log('Transaction mined:', receipt);

    const voteRecord = {
      voter: accounts[0],
      candidateId: candidateId,
      transactionHash: receipt.transactionHash,
      timestamp: new Date().toISOString()
    };

    // Update transaction history
    transactionHistory.push(voteRecord);
    try {
      fs.writeFileSync(TRANSACTION_HISTORY_PATH, JSON.stringify(transactionHistory, null, 2));
      console.log('Vote recorded successfully in transaction history');
    } catch (err) {
      console.error('Error saving transaction history:', err);
    }

    res.json({
      success: true,
      transactionHash: receipt.transactionHash
    });
  } catch (error) {
    console.error('Error voting:', error);
    const errorMessage = error.message.includes('already voted') || 
                         error.message.includes('already cast a vote') ||
                         error.message.includes('Already voted') ||
                         error.message.includes('Voter has already voted') ?
                         'Voters account already cast a vote' : error.message;
    
    res.status(500).json({
      success: false,
      message: errorMessage
    });
  }
});
app.get('/candidates', async (req, res) => {
  try {
    console.log('Fetching candidates...');
    if (!contract) {
      console.log('No contract available - returning sample candidates');
      return res.json({ success: true, candidates: SAMPLE_CANDIDATES });
    }

    const candidateCount = await contract.methods.getNumOfCandidates().call();
    const count = parseInt(candidateCount);
    console.log(`Found ${count} candidates`);
    let candidates = [];

    for (let i = 0; i < count; i++) {
      const candidate = await contract.methods.candidates(i).call();
      candidates.push({
        id: i,
        name: candidate.name,
        voteCount: Number(candidate.voteCount)
      });
    }

    console.log('Returning candidates:', candidates);
    res.json({ success: true, candidates });
  } catch (error) {
    console.error('Error fetching candidates:', error.message);
    res.json({ success: true, candidates: SAMPLE_CANDIDATES });
  }
});

app.get('/voting-history', async (req, res) => {
  try {
    console.log('Fetching voting history...');
    // Make sure transactionHistory is properly loaded
    const transactionHistory = loadTransactionHistory();
    
    res.json({
      success: true,
      data: {  // Standardized response structure
        votingHistory: transactionHistory || []
      }
    });
  } catch (error) {
    console.error('Error fetching voting history:', error);
    res.status(500).json({
      success: false,
      error: 'Error fetching voting history',
      details: error.message
    });
  }
});

app.get('/candidate-votes', (req, res) => {
  try {
    console.log('Calculating vote counts from transaction history...');
    const transactionHistory = loadTransactionHistory();

    // Initialize vote counts for each candidate
    const voteCounts = {};

    // Process transaction history
    transactionHistory.forEach(tx => {
      const candidateId = tx.candidateId;
      if (!voteCounts[candidateId]) {
        voteCounts[candidateId] = 0;
      }
      voteCounts[candidateId]++;
    });

    // Format the response
    const candidatesWithVotes = SAMPLE_CANDIDATES.map(candidate => ({
      id: candidate.id,
      name: candidate.name,
      voteCount: voteCounts[candidate.id] || 0
    }));

    console.log('Vote counts calculated:', candidatesWithVotes);
    res.json({ success: true, candidates: candidatesWithVotes });
  } catch (error) {
    console.error('Error calculating vote counts:', error);
    res.status(500).json({ success: false, message: 'Error calculating vote counts' });
  }
});

function loadTransactionHistory() {
  try {
    console.log('Loading transaction history...');
    if (fs.existsSync(TRANSACTION_HISTORY_PATH)) {
      const data = fs.readFileSync(TRANSACTION_HISTORY_PATH);
      console.log(`Loaded transaction history from ${TRANSACTION_HISTORY_PATH}`);
      return JSON.parse(data);
      console.log('Success...');
    }
    console.log('No transaction history file found, starting with empty history');
    return [];
  } catch (err) {
    console.error('Error reading transaction history:', err);
    return [];
  }
}

function saveTransactionHistory() {
  try {
    console.log('Saving transaction history...');
    fs.writeFileSync(TRANSACTION_HISTORY_PATH, JSON.stringify(transactionHistory, null, 2));
    console.log('Transaction history saved successfully');
  } catch (err) {
    console.error('Error saving transaction history:', err);
  }
}

const SAMPLE_CANDIDATES = [
  { id: 0, name: "Alice", voteCount: 0 },
  { id: 1, name: "Bob", voteCount: 0 },
  { id: 2, name: "Charlie", voteCount: 0 }
];

// Launch server
initializeBlockchain().then(success => {
  if (!success) {
    console.log('Running in test mode without blockchain connection');
  }

  app.listen(port, () => {
    console.log(`Server running at http://localhost:${port}`);
  });
});