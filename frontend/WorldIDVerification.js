// main.js
import IDKit from '@worldcoin/idkit-standalone';

const client = new IDKit({
  app_id: 'your-app-id', // from Worldcoin Developer Portal
  action: 'vote',        // any identifier for this action
  signal: '',            // optional, if you want to bind a signal
  onSuccess: (result) => {
    console.log('✅ Proof:', result);

    // Send to your backend for verification
    fetch('/verify-world-id', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(result),
    }).then((res) => res.json())
      .then((data) => {
        if (data.success) {
          alert('✅ Verified! You may vote.');
        } else {
          alert('❌ Verification failed.');
        }
      });
  },
});

document.getElementById('verify-world-id').addEventListener('click', () => {
  client.open();
});
