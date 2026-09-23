const { verifyAccessToken } = require('../utils/tokens');

function authenticate(req, res, next) {
  const header = req.headers.authorization || '';
  const [scheme, token] = header.split(' ');

  if (scheme !== 'Bearer' || !token) {
    return res.status(401).json({ status: 'error', message: 'Missing or invalid Authorization header' });
  }

  try {
    const payload = verifyAccessToken(token);
    req.user = {
      id: payload.sub,
      organizationId: payload.organization_id,
      role: payload.role,
    };
    next();
  } catch (err) {
    return res.status(401).json({ status: 'error', message: 'Invalid or expired access token' });
  }
}

module.exports = { authenticate };
