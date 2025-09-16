const express = require('express');
const app = express();

app.use(express.json());

app.get('/test', (req, res) => {
    res.json({ message: 'Simple server works' });
});

app.listen(3001, () => {
    console.log('Simple server running on port 3001');
});
