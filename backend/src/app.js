const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');

const healthRoutes = require('./routes/health');
const authRoutes = require('./routes/auth');
const candidateRoutes = require('./routes/candidates');
const resumeRoutes = require('./routes/resumes');
const matchingRoutes = require('./routes/matching');
const jobRoutes = require('./routes/jobs');
const questionRoutes = require('./routes/questions');
const applicationRoutes = require('./routes/applications');
const screeningResultRoutes = require('./routes/screeningResults');
const publicRoutes = require('./routes/public');
const { errorHandler } = require('./middleware/errorHandler');

const app = express();

app.use(cors({ origin: process.env.FRONTEND_URL || true, credentials: true }));
app.use(express.json());
app.use(cookieParser());

app.use('/api', healthRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/candidates', candidateRoutes);
app.use('/api/resumes', resumeRoutes);
app.use('/api/matching', matchingRoutes);
app.use('/api/jobs', jobRoutes);
app.use('/api/questions', questionRoutes);
app.use('/api/applications', applicationRoutes);
app.use('/api/screening-results', screeningResultRoutes);
app.use('/api/public', publicRoutes);

app.use((req, res) => {
  res.status(404).json({ status: 'error', message: 'Not found' });
});

app.use(errorHandler);

module.exports = app;
