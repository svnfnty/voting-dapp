const express = require('express');
const app = express();
const cors = require('cors');
app.use(cors());
app.use(express.json());

app.get('/', (req, res) => {
    res.send('Voting backend up!');
});

app.listen(3000, () => console.log('Backend running on http://localhost:3000'));