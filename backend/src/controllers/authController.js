const { pool } = require('../config/db');
const { hashPassword, comparePassword } = require('../utils/password');
const {
  signAccessToken,
  signRefreshToken,
  verifyRefreshToken,
  REFRESH_TOKEN_TTL_DAYS,
} = require('../utils/tokens');
const { AppError } = require('../utils/AppError');
const { ROLES } = require('../constants/roles');

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const REFRESH_COOKIE_NAME = 'refreshToken';
const REFRESH_COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax',
  path: '/api/auth',
  maxAge: REFRESH_TOKEN_TTL_DAYS * 24 * 60 * 60 * 1000,
};

function sanitizeUser(user) {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    organizationId: user.organization_id,
  };
}

async function issueTokens(res, user) {
  const { rows } = await pool.query(
    `INSERT INTO refresh_tokens (user_id, expires_at)
     VALUES ($1, now() + interval '${REFRESH_TOKEN_TTL_DAYS} days')
     RETURNING id`,
    [user.id]
  );
  const tokenId = rows[0].id;

  const refreshToken = signRefreshToken(user, tokenId);
  const accessToken = signAccessToken(user);

  res.cookie(REFRESH_COOKIE_NAME, refreshToken, REFRESH_COOKIE_OPTIONS);
  return accessToken;
}

async function register(req, res, next) {
  try {
    const { organizationName, name, email, password } = req.body;

    if (!organizationName || !name || !email || !password) {
      throw new AppError('organizationName, name, email and password are required', 400);
    }
    if (!EMAIL_RE.test(email)) {
      throw new AppError('Invalid email address', 400);
    }
    if (password.length < 8) {
      throw new AppError('Password must be at least 8 characters', 400);
    }

    const normalizedEmail = email.toLowerCase().trim();

    const existing = await pool.query('SELECT id FROM users WHERE lower(email) = $1', [normalizedEmail]);
    if (existing.rows.length > 0) {
      throw new AppError('An account with this email already exists', 409);
    }

    const passwordHash = await hashPassword(password);

    const client = await pool.connect();
    let user;
    try {
      await client.query('BEGIN');

      const orgResult = await client.query(
        'INSERT INTO organizations (name) VALUES ($1) RETURNING id',
        [organizationName.trim()]
      );
      const organizationId = orgResult.rows[0].id;

      const userResult = await client.query(
        `INSERT INTO users (organization_id, name, email, password_hash, role)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING id, organization_id, name, email, role`,
        [organizationId, name.trim(), normalizedEmail, passwordHash, ROLES.ADMIN]
      );
      user = userResult.rows[0];

      await client.query('COMMIT');
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }

    const accessToken = await issueTokens(res, user);
    res.status(201).json({ status: 'ok', accessToken, user: sanitizeUser(user) });
  } catch (err) {
    next(err);
  }
}

async function login(req, res, next) {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      throw new AppError('email and password are required', 400);
    }

    const normalizedEmail = email.toLowerCase().trim();
    const { rows } = await pool.query(
      'SELECT id, organization_id, name, email, password_hash, role FROM users WHERE lower(email) = $1',
      [normalizedEmail]
    );
    const user = rows[0];

    if (!user || !(await comparePassword(password, user.password_hash))) {
      throw new AppError('Invalid email or password', 401);
    }

    const accessToken = await issueTokens(res, user);
    res.json({ status: 'ok', accessToken, user: sanitizeUser(user) });
  } catch (err) {
    next(err);
  }
}

async function refresh(req, res, next) {
  try {
    const token = req.cookies?.[REFRESH_COOKIE_NAME];
    if (!token) {
      throw new AppError('Missing refresh token', 401);
    }

    let payload;
    try {
      payload = verifyRefreshToken(token);
    } catch (err) {
      throw new AppError('Invalid or expired refresh token', 401);
    }

    const { rows } = await pool.query(
      'SELECT id, user_id, revoked_at, expires_at FROM refresh_tokens WHERE id = $1',
      [payload.jti]
    );
    const record = rows[0];

    if (
      !record ||
      record.user_id !== payload.sub ||
      record.revoked_at ||
      new Date(record.expires_at) < new Date()
    ) {
      throw new AppError('Refresh token is no longer valid', 401);
    }

    const userResult = await pool.query(
      'SELECT id, organization_id, name, email, role FROM users WHERE id = $1',
      [payload.sub]
    );
    const user = userResult.rows[0];
    if (!user) {
      throw new AppError('User no longer exists', 401);
    }

    await pool.query('UPDATE refresh_tokens SET revoked_at = now() WHERE id = $1', [record.id]);

    const accessToken = await issueTokens(res, user);
    res.json({ status: 'ok', accessToken, user: sanitizeUser(user) });
  } catch (err) {
    next(err);
  }
}

async function logout(req, res, next) {
  try {
    const token = req.cookies?.[REFRESH_COOKIE_NAME];
    if (token) {
      try {
        const payload = verifyRefreshToken(token);
        await pool.query(
          'UPDATE refresh_tokens SET revoked_at = now() WHERE id = $1 AND revoked_at IS NULL',
          [payload.jti]
        );
      } catch (err) {
        // Token already invalid/expired - nothing left to revoke.
      }
    }
    res.clearCookie(REFRESH_COOKIE_NAME, { path: '/api/auth' });
    res.json({ status: 'ok' });
  } catch (err) {
    next(err);
  }
}

async function me(req, res, next) {
  try {
    const { rows } = await pool.query(
      'SELECT id, organization_id, name, email, role FROM users WHERE id = $1',
      [req.user.id]
    );
    const user = rows[0];
    if (!user) {
      throw new AppError('User not found', 404);
    }
    res.json({ status: 'ok', user: sanitizeUser(user) });
  } catch (err) {
    next(err);
  }
}

module.exports = { register, login, refresh, logout, me };
