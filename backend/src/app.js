const express = require('express');
const cors = require('cors');

const healthRoutes = require('./routes/health');

const app = express();

app.use(cors());
app.use(express.json());

app.use('/api', healthRoutes);

app.use((req, res) => {
  res.status(404).json({ status: 'error', message: 'Not found' });
});

module.exports = app;
