const SAMPLE_CANDIDATES = [
  { id: 0, name: "Alice", voteCount: 0 },
  { id: 1, name: "Bob", voteCount: 0 },
  { id: 2, name: "Charlie", voteCount: 0 }
];

let currentCandidates = [...SAMPLE_CANDIDATES];
let isTestMode = false;
let worldIDVerification = null;
let worldIDInitialized = false;

// DOM Elements
const walletAddressElement = document.getElementById('walletAddress');
const connectWalletButton = document.getElementById('connectWallet');
const candidatesContainer = document.getElementById('candidates');
const statusMessageElement = document.getElementById('statusMessage');
const verifyWorldIDButton = document.getElementById('verify-world-id');
const transactionList = document.getElementById('transactionList');

// Initialize application
document.addEventListener('DOMContentLoaded', async () => {
  console.log("[INIT] Application starting...");
  await initializeApplication();
  await checkVerificationStatus();
  await loadVotingHistory();
});

async function initializeApplication() {
  try {
    console.log("[INIT] Checking for Ethereum provider...");
    if (await checkEthereumProvider()) {
      console.log("[INIT] Ethereum provider found");
      await initializeWallet();
      await loadCandidates();
      await fetchAndDisplayVoteCounts(); // Fetch and display vote counts
      showStatus("Application initialized successfully", 'success');
    } else {
      console.log("[INIT] No Ethereum provider - test mode activated");
      activateTestMode();
    }
  } catch (error) {
    console.error("[INIT] Initialization error:", error);
    activateTestMode();
  }
}

async function initializeWorldID() {
  if (worldIDInitialized) {
    console.log("[WORLDID] Already initialized");
    return true;
  }

  try {
    console.log("[WORLDID] Initializing World ID...");
    await IDKit.init({
      app_id: "app_staging_a130e78833240a7d415c250fdcbc85a6",
      action: "anonymousvote1",
      signal: window.userAddress || "",
      enable_telemetry: true,
    });
    worldIDInitialized = true;
    console.log("[WORLDID] Initialization successful");
    return true;
  } catch (err) {
    console.error("[WORLDID] Init error:", err);
    worldIDInitialized = false;
    return false;
  }
}

async function verifyWithWorldID() {
  try {
    console.log("[WORLDID] Starting verification...");
    const initSuccess = await initializeWorldID();
    if (!initSuccess) {
      console.error("[WORLDID] Init failed");
      showStatus("Failed to initialize World ID", 'error');
      return false;
    }

    console.log("[WORLDID] Opening verification modal...");
    const proof = await IDKit.open();

    // Process the successful verification
    worldIDVerification = {
      proof: proof.proof,
      merkle_root: proof.merkle_root,
      nullifier_hash: proof.nullifier_hash,
      timestamp: Date.now()
    };

    console.log("[WORLDID] Storing verification locally...");
    localStorage.setItem('worldIDVerification', JSON.stringify(worldIDVerification));

    console.log("[WORLDID] Sending to backend...");
    const storeResult = await storeVerifiedUser(worldIDVerification);
    console.log("[WORLDID] Backend response:", storeResult);

    if (storeResult.success) {
       console.log("[WORLDID] Verification succeeded!");
        updateVerificationUI(true);
        showStatus("Identity verified with World ID!", 'success');
    } else if (storeResult.message === 'Already verified') {
      console.log('⚠️ User already verified');
      showStatus("Double voting not allowed", 'success');
      updateVerificationUI(true);
    } else {
      console.error('❌ Verification failed:', storeResult.message);
      showStatus("Verification failed", 'error');
    }
   
    return true;
  } catch (error) {
    console.error("[WORLDID] Verification error:", error);
    showStatus("Verification failed: " + error.message, 'error');
    return false;
  }
}

let votingChart; // Chart.js instance

// Initialize the voting chart
function initializeVotingChart() {
  const ctx = document.getElementById('votingChart').getContext('2d');
  const colors = [
    'rgba(78, 68, 206, 1)', // Blue
    'rgba(34, 197, 94, 1)', // Green
    'rgba(239, 68, 68, 1)', // Red
    'rgba(234, 179, 8, 1)', // Yellow
    'rgba(59, 130, 246, 1)', // Light Blue
  ];
  const backgroundColors = colors.map(color => color.replace('1)', '0.2)')); // Transparent versions

  votingChart = new Chart(ctx, {
    type: 'line',
    data: {
      labels: Array(10).fill(''), // Start with empty labels for the heartbeat effect
      datasets: currentCandidates.map((candidate, index) => ({
        label: candidate.name,
        data: Array(10).fill(candidate.voteCount), // Start with the vote count as the baseline
        borderColor: colors[index % colors.length],
        backgroundColor: backgroundColors[index % backgroundColors.length],
        borderWidth: 2,
        tension: 0.5, // Create a wavy effect
        fill: false, // No fill under the line for a cleaner heartbeat look
      })),
    },
    options: {
      responsive: true,
      plugins: {
        legend: { display: true },
        tooltip: { enabled: true },
      },
      scales: {
        x: { display: false }, // Hide x-axis for a cleaner look
        y: { 
          title: { display: true, text: 'Votes' }, 
          beginAtZero: true 
        },
      },
      animation: {
        duration: 500, // Faster animation for a heartbeat effect
        easing: 'easeInOutSine',
      }
    }
  });

  // Update the chart every minute based on vote counts
  setInterval(async () => {
    console.log("[HEARTBEAT] Fetching updated vote counts...");
    await fetchAndDisplayVoteCounts(); // Fetch the latest vote counts
    votingChart.data.labels.push(''); // Add a new empty label
    votingChart.data.labels.shift(); // Remove the oldest label
    votingChart.data.datasets.forEach((dataset, index) => {
      const currentVoteCount = currentCandidates[index].voteCount;
      const previousVoteCount = dataset.data[dataset.data.length - 1];
      const interpolatedValue = (previousVoteCount + currentVoteCount) / 2; // Smooth transition
      dataset.data.push(interpolatedValue); // Add the interpolated value
      dataset.data.shift(); // Remove the oldest value
    });
    votingChart.update();
  }, 6000); // Update every minute
}

// Update the voting chart with new data
function updateVotingChart() {
  if (!votingChart) return;
  votingChart.data.datasets.forEach((dataset, index) => {
    dataset.data[dataset.data.length - 1] = currentCandidates[index].voteCount; // Update the latest vote count
  });
  votingChart.update();
}

// Modify fetchAndDisplayVoteCounts to update the chart
async function fetchAndDisplayVoteCounts() {
  try {
    console.log("[DATA] Fetching vote counts...");
    const response = await fetch('http://localhost:3000/candidate-votes');
    if (!response.ok) throw new Error('Failed to fetch vote counts');

    const data = await response.json();
    if (data.success) {
      console.log("[DATA] Vote counts fetched successfully:", data.candidates);
      currentCandidates = data.candidates; // Update the currentCandidates array
      displayCandidates(); // Re-render the candidates with updated vote counts
      updateVotingChart(); // Update the chart with new data
    } else {
      throw new Error(data.message || 'Failed to fetch vote counts');
    }
  } catch (error) {
    console.error("[ERROR] Fetching vote counts failed:", error);
    showStatus("Failed to fetch vote counts", 'error');
  }
}

async function handleVote(candidateId) {
  try {
    console.log(`[VOTE] Attempting vote for candidate ${candidateId}`);
    
    if (isTestMode) {
      console.log("[VOTE] Test mode vote recorded");
      currentCandidates[candidateId].voteCount++;
      displayCandidates();
      showStatus("Vote simulated (test mode)", 'success');
      return;
    }

    // First check existing verification status
    const isVerified = await checkVerificationStatus();
    
    if (!isVerified || !worldIDVerification) {
      console.log("[VOTE] User not verified");
      const verify = await showVerificationModal();
      if (verify) {
        const verificationSuccess = await verifyWithWorldID();
        if (!verificationSuccess || !worldIDVerification) {
          return;
        }
      } else {
        return;
      }
    }

    if (!window.userAddress) {
      throw new Error("No wallet connected");
    }

    // Ensure we have the verification data
    if (!worldIDVerification || !worldIDVerification.nullifier_hash) {
      throw new Error("Missing verification data");
    }

    const voteData = {
      candidateId,
      nullifier_hash: worldIDVerification.nullifier_hash,
      voterAddress: window.userAddress
    };

    console.log("[VOTE] Submitting vote:", voteData);
    const response = await fetch('http://localhost:3000/vote', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(voteData)
    });

    const result = await response.json();
    console.log("[VOTE] Vote result:", result);

    if (result.success) {
      const candidateName = currentCandidates[candidateId].name;
      updateTransactionHistory(candidateName, result.transactionHash);
      showStatus(`
        Vote recorded successfully!<br>
        You voted for: <strong>${candidateName}</strong><br>
        Transaction Hash: <a href="https://etherscan.io/tx/${result.transactionHash}" target="_blank">${shortenAddress(result.transactionHash)}</a>
      `, 'success');
      await loadCandidates();
      await loadVotingHistory();
    } else {
      throw new Error(result.message || "Vote failed");
    }
  } catch (error) {
    console.error("[VOTE] Voting error:", error);
    showStatus(error.message || "Failed to submit vote", 'error');
  }
}


function showVerificationModal() {
  return new Promise((resolve) => {
    const modal = document.getElementById('confirmationModal');
    modal.classList.add('show'); // Changed from remove('hidden')
    const confirmBtn = document.getElementById('confirmVerifyBtn');
    const cancelBtn = document.getElementById('cancelVerifyBtn');
    const cleanup = () => {
      confirmBtn.removeEventListener('click', onConfirm);
      cancelBtn.removeEventListener('click', onCancel);
      modal.classList.remove('show'); // Changed from add('hidden')
    };
      const onConfirm = () => {
      cleanup();
      resolve(true);
    };

    const onCancel = () => {
      cleanup();
      resolve(false);
    };

    confirmBtn.addEventListener('click', onConfirm);
    cancelBtn.addEventListener('click', onCancel);
  });
}

// Handle successful verification from World ID
function handleWorldIDSuccess(proof) {
  console.log("[WORLDID] Received proof:", proof);
  worldIDVerification = {
    proof: proof.proof,
    merkle_root: proof.merkle_root,
    nullifier_hash: proof.nullifier_hash,
    timestamp: Date.now()
  };
  
  console.log("[WORLDID] Storing verification locally...");
  localStorage.setItem('worldIDVerification', JSON.stringify(worldIDVerification));
  
  console.log("[WORLDID] Sending to backend...");
  storeVerifiedUser(worldIDVerification)
    .then(result => {
      console.log("[WORLDID] Backend response:", result);
      updateVerificationUI(true);
      showStatus("Identity verified with World ID!", 'success');
    })
    .catch(error => {
      console.error("[WORLDID] Error storing verification:", error);
      showStatus("Verification stored locally but failed to sync with server", 'warning');
    });
}

async function storeVerifiedUser(verificationData) {
  try {
    console.log("[BACKEND] Storing verification:", verificationData);
    
    const response = await fetch('http://localhost:3000/store-verified-user', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        address: window.userAddress || "anonymous",
        nullifier_hash: verificationData.nullifier_hash,
        timestamp: verificationData.timestamp,
        merkle_root: verificationData.merkle_root,
        proof: verificationData.proof
      })
    });
    
    const result = await response.json();

    if (result.success) {
      console.log('✅ User successfully verified');
      showStatus("Verified successfully", 'success');
    } else if (result.message === 'Already verified') {
      console.log('⚠️ User already verified');
      showStatus("Double Voting not allowed", 'success');
    } else {
      console.error('❌ Verification failed:', result.message);
      showStatus("Verification failed", 'error');
    }

    return result;
  } catch (error) {
    console.error('🔥 Error sending verification:', error);
    showMessage('Server error. Please try again later.');
    return { success: false, error: error.message };
  }
}


async function checkVerificationStatus() {
  console.log("[VERIFY] Checking verification status...");
  const storedVerification = localStorage.getItem('worldIDVerification');
  if (!storedVerification) {
    console.log("[VERIFY] No stored verification found");
    updateVerificationUI(false);
    return false;
  }

  try {
    worldIDVerification = JSON.parse(storedVerification);
    console.log("[VERIFY] Found verification:", worldIDVerification);
    
    const MAX_VERIFICATION_AGE = 24 * 60 * 60 * 1000; // 24 hours
    const verificationAge = Date.now() - worldIDVerification.timestamp;
    
    if (verificationAge >= MAX_VERIFICATION_AGE) {
      console.log("[VERIFY] Verification expired");
      localStorage.removeItem('worldIDVerification');
      worldIDVerification = null;
      updateVerificationUI(false);
      return false;
    }
    
    console.log("[VERIFY] Verification valid");
    updateVerificationUI(true);
    return true;
  } catch (error) {
    console.error("[VERIFY] Verification check error:", error);
    localStorage.removeItem('worldIDVerification');
    updateVerificationUI(false);
    return false;
  }
}

function updateVerificationUI(isVerified) {
  console.log(`[UI] Updating verification UI: ${isVerified}`);
  verifyWorldIDButton.innerHTML = isVerified 
    ? '<i class="fas fa-check-circle"></i> Verified'
    : '<i class="fas fa-globe"></i> Verify with World ID';
  verifyWorldIDButton.classList.toggle('verified', isVerified);
  verifyWorldIDButton.disabled = isVerified;
  connectWalletButton.innerHTML = isVerified 
    ? '<i class="fas fa-check-circle"></i> Verified'
    : '<i class="fas fa-wallet"></i> Verify Wallet';
  connectWalletButton.classList.toggle('verified', isVerified);
  connectWalletButton.disabled = isVerified;
}



async function checkEthereumProvider(retries = 5, delay = 500) {
  for (let i = 0; i < retries; i++) {
    if (window.ethereum) {
      console.log("[CHECK] Ethereum provider detected:", window.ethereum);
      return true;
    }
    console.warn(`[CHECK] Ethereum provider not detected. Retrying... (${i + 1}/${retries})`);
    await new Promise(resolve => setTimeout(resolve, delay));
  }

  console.error("[CHECK] No Ethereum provider detected after retries.");
  showStatus("No Ethereum provider detected. Please use MetaMask.", 'error');
  return false;
}

async function initializeWallet(retries = 3, delay = 1000) {
  if (!window.ethereum && !window.web3) {
    throw new Error('No Ethereum provider detected');
  }

  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      console.log(`[WALLET] Attempt ${attempt} to connect wallet...`);
      if (window.ethereum) {
        window.web3 = new Web3(window.ethereum);
        const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });
        if (accounts.length > 0) {
          window.userAddress = accounts[0];
          walletAddressElement.textContent = `Connected: ${shortenAddress(accounts[0])}`;
          console.log("[WALLET] Wallet connected:", accounts[0]);
          return true;
        }
      } else if (window.web3) {
        window.web3 = new Web3(web3.currentProvider);
        const accounts = await web3.eth.getAccounts();
        if (accounts.length > 0) {
          window.userAddress = accounts[0];
          walletAddressElement.textContent = `Connected: ${shortenAddress(accounts[0])}`;
          console.log("[WALLET] Wallet connected:", accounts[0]);
          return true;
        }
      }
      throw new Error('No accounts found');
    } catch (error) {
      console.error(`[WALLET] Attempt ${attempt} failed:`, error);
      if (attempt === retries) throw error;
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
}

async function loadCandidates() {
  try {
    console.log("[DATA] Loading candidates...");
    const response = await fetch('http://localhost:3000/candidates');
    if (!response.ok) throw new Error('Network response was not ok');
    
    const data = await response.json();
    currentCandidates = data.candidates || SAMPLE_CANDIDATES;
    displayCandidates();
  } catch (error) {
    console.error("[DATA] Error loading candidates:", error);
    activateTestMode();
  }
}

 async function loadVotingHistory() {
  try {
    console.log("[1] Starting to load voting history...");
    
    if (!transactionList) {
      throw new Error("transactionList element not found");
    }

    // Show loading state
    transactionList.innerHTML = `
      <div class="empty-state loading">
        <i class="fas fa-spinner fa-spin"></i>
        <p>Loading voting history...</p>
      </div>
    `;

    console.log("[2] Fetching data from server...");
    const response = await fetch('http://localhost:3000/voting-history', {
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      }
    });
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
    }
    
    const data = await response.json();
    console.log("[3] Server response:", data);

    if (!data.success) {
      throw new Error(data.message || "Server returned unsuccessful response");
    }

    // CORRECTED: Access votingHistory from data.data
    const votingHistory = data.data?.votingHistory || [];
    
    console.log("[4] Current candidates:", currentCandidates);
    console.log("[4.5] Voting history:", votingHistory); // New debug log
    
    if (votingHistory.length > 0) {
      console.log("[5] Rendering history items...");
      transactionList.innerHTML = votingHistory.map(item => {
        const candidateId = Number(item.candidateId);
        const candidate = currentCandidates?.find(c => c.id === candidateId) || { 
          name: `Already Voted ${candidateId}`, 
          id: candidateId 
        };
        
        return `
          <div class="transaction-item">
            <div class="tx-header">
              <span class="tx-candidate">${candidate.name}</span>
              <span class="tx-date">${new Date(item.timestamp).toLocaleString()}</span>
            </div>
            <div class="tx-details">
              <span class="tx-voter">Voter: ${shortenAddress(item.voter)}</span>
              <a href="https://etherscan.io/tx/${item.transactionHash}" target="_blank" class="tx-link">
                View Transaction
              </a>
            </div>
          </div>
        `;
      }).join('');
    } else {
      console.log("[5] No history found, showing empty state");
      transactionList.innerHTML = `
        <div class="empty-state">
          <i class="fas fa-database"></i>
          <p>No voting activity detected</p>
          <small>Transactions will appear here once voting begins</small>
        </div>
      `;
    }
  } catch (error) {
    console.error("[ERROR] Loading voting history failed:", error);
    transactionList.innerHTML = `
      <div class="empty-state error">
        <i class="fas fa-exclamation-triangle"></i>
        <p>Failed to load history</p>
        <small>${error.message}</small>
      </div>
    `;
  }
}


function displayCandidates() {
  candidatesContainer.innerHTML = currentCandidates.map(candidate => `
    <div class="candidate-card">
      <div class="candidate-image-placeholder">
              <i class="fas fa-user"></i>
            </div>
            <div class="candidate-info">
              <h4 class="name">${candidate.name}</h4>
              <p class="position">President</p>
              <p class="party">Independent Party</p>
            </div>
            <div class="votes">
              <div class="vote-count">${candidate.voteCount}</div>
              <div class="vote-label">VOTES</div>
              <div class="progress-bar">
                <div class="progress" style="width: 65%"></div>
              </div>
            </div>
      <button class="vote-button" onclick="handleVote(${candidate.id})">Vote</button>
    </div>
  `).join('');
}


function updateTransactionHistory(candidateName, transactionHash) {
  const emptyState = transactionList.querySelector('.empty-state');
  if (emptyState) emptyState.style.display = 'none';

  transactionList.innerHTML += `
    <div class="transaction-item">
      <p><strong>${candidateName}</strong> voted by ${shortenAddress(window.userAddress)}</p>
      <p><small>Transaction Hash: <a href="https://etherscan.io/tx/${transactionHash}" target="_blank">${shortenAddress(transactionHash)}</a></small></p>
    </div>
  `;
}

function activateTestMode() {
  isTestMode = true;
  walletAddressElement.textContent = "Test Mode (No Wallet)";
  currentCandidates = [...SAMPLE_CANDIDATES];
  displayCandidates();
  showStatus("Using test mode with sample data", 'warning');
}

function showStatus(message, type) {
  const icons = {
    success: 'fa-check-circle',
    error: 'fa-times-circle',
    warning: 'fa-exclamation-triangle'
  };

  const messageContent = statusMessageElement.querySelector('.message-content');
  messageContent.innerHTML = `<i class="fas ${icons[type] || 'fa-info-circle'}"></i><span class="message-text">${message}</span>`;
  
  statusMessageElement.className = `status-message ${type}`;
  statusMessageElement.style.display = 'block';
  
  setTimeout(() => {
    statusMessageElement.style.display = 'none';
  }, 5000);
}

function shortenAddress(address) {
  return address ? `${address.substring(0, 6)}...${address.substring(address.length - 4)}` : '';
}

// Event listeners
connectWalletButton.addEventListener('click', async () => {
  console.log("[EVENT] Connect wallet clicked");
  try {
    if (await initializeWallet()) {
      isTestMode = false;
      await loadCandidates();
      showStatus("Wallet connected successfully", 'success');
    }
  } catch (error) {
    console.error("[EVENT] Wallet connection error:", error);
    showStatus("Failed to connect wallet", 'error');
  }
});

verifyWorldIDButton.addEventListener('click', async () => {
  console.log("[EVENT] Verify World ID clicked");
  await verifyWithWorldID();
});


// Initialize World ID with success handler
document.addEventListener('DOMContentLoaded', () => {
  window.handleWorldIDSuccess = handleWorldIDSuccess;
  // You might need to load currentCandidates first
  loadVotingHistory();
});

// Initialize the chart on DOMContentLoaded
document.addEventListener('DOMContentLoaded', () => {
  initializeVotingChart();
});

// Make functions available globally
window.handleVote = handleVote;