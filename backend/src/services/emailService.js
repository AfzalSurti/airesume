const nodemailer = require('nodemailer');
const { pool } = require('../config/db');

let transporter = null;

function getTransporter() {
  if (transporter) return transporter;
  if (!process.env.GMAIL_USER || !process.env.GMAIL_APP_PASSWORD) return null;

  transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: process.env.GMAIL_USER,
      pass: process.env.GMAIL_APP_PASSWORD,
    },
  });
  return transporter;
}

async function sendEmail({ to, subject, html, organizationId = null, hiringPipelineId = null }) {
  const t = getTransporter();
  let status = 'FAILED';
  let error = null;

  if (!t) {
    error = 'Email is not configured (GMAIL_USER / GMAIL_APP_PASSWORD missing) - logged only';
    console.warn(`Email not sent (no credentials configured): to=${to} subject="${subject}"`);
  } else {
    try {
      await t.sendMail({ from: process.env.GMAIL_USER, to, subject, html });
      status = 'SENT';
    } catch (err) {
      error = err.message;
      console.error('Email send failed:', err.message);
    }
  }

  await pool.query(
    `INSERT INTO email_log (organization_id, hiring_pipeline_id, to_email, subject, body, status, error)
     VALUES ($1, $2, $3, $4, $5, $6, $7)`,
    [organizationId, hiringPipelineId, to, subject, html, status, error]
  );

  return { status, error };
}

module.exports = { sendEmail };
