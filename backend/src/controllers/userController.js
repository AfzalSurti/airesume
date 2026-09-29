const crypto = require('crypto');
const { pool } = require('../config/db');
const { hashPassword } = require('../utils/password');
const { sendEmail } = require('../services/emailService');
const { AppError } = require('../utils/AppError');
const { ROLES } = require('../constants/roles');

const CREATABLE_ROLES = [ROLES.HR, ROLES.RECRUITER, ROLES.HOD, ROLES.VIEWER];
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function generateTempPassword() {
  return crypto.randomBytes(9).toString('base64url');
}

async function listUsers(req, res, next) {
  try {
    const roleFilter = req.query.role && CREATABLE_ROLES.includes(req.query.role) ? req.query.role : null;

    const { rows } = await pool.query(
      `SELECT id, name, email, role, created_at FROM users
       WHERE organization_id = $1 AND ($2::text IS NULL OR role = $2)
       ORDER BY name ASC`,
      [req.user.organizationId, roleFilter]
    );

    res.json({ status: 'ok', users: rows });
  } catch (err) {
    next(err);
  }
}

async function createUser(req, res, next) {
  try {
    const { name, email, role } = req.body;

    if (!name || !name.trim()) {
      throw new AppError('name is required', 400);
    }
    if (!email || !EMAIL_RE.test(email)) {
      throw new AppError('A valid email is required', 400);
    }
    if (!role || !CREATABLE_ROLES.includes(role)) {
      throw new AppError(`role must be one of: ${CREATABLE_ROLES.join(', ')}`, 400);
    }

    const normalizedEmail = email.toLowerCase().trim();
    const existing = await pool.query('SELECT id FROM users WHERE lower(email) = $1', [normalizedEmail]);
    if (existing.rows.length > 0) {
      throw new AppError('An account with this email already exists', 409);
    }

    const tempPassword = generateTempPassword();
    const passwordHash = await hashPassword(tempPassword);

    const { rows } = await pool.query(
      `INSERT INTO users (organization_id, name, email, password_hash, role)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, name, email, role, created_at`,
      [req.user.organizationId, name.trim(), normalizedEmail, passwordHash, role]
    );
    const user = rows[0];

    const loginUrl = `${process.env.FRONTEND_URL || 'http://localhost:5173'}/login`;
    const emailResult = await sendEmail({
      to: normalizedEmail,
      subject: 'Your account has been created',
      html: `
        <p>Hi ${user.name},</p>
        <p>An account has been created for you on the recruitment platform with the role <strong>${role}</strong>.</p>
        <p><strong>Email:</strong> ${normalizedEmail}<br/>
        <strong>Temporary password:</strong> ${tempPassword}</p>
        <p>Sign in at <a href="${loginUrl}">${loginUrl}</a></p>
      `,
      organizationId: req.user.organizationId,
    });

    res.status(201).json({
      status: 'ok',
      user,
      tempPassword,
      emailStatus: emailResult.status,
    });
  } catch (err) {
    next(err);
  }
}

module.exports = { listUsers, createUser };
