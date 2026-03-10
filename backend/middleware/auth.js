const jwt = require('jsonwebtoken');
const { getDb } = require('../services/firebaseService');

const JWT_SECRET = process.env.JWT_SECRET || 'changeme_very_secret_key';

function authMiddleware(requiredRole = null) {
  return async (req, res, next) => {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'No token provided' });
    }

    const token = authHeader.split(' ')[1];
    try {
      const decoded = jwt.verify(token, JWT_SECRET);
      const db = getDb();
      const userSnap = await db.collection('users').doc(decoded.userId).get();

      if (!userSnap.exists) {
        return res.status(401).json({ error: 'User not found' });
      }

      const user = { id: userSnap.id, ...userSnap.data() };

      if (!user.active) {
        return res.status(403).json({ error: 'Account disabled' });
      }

      if (requiredRole && user.role !== requiredRole && user.role !== 'admin') {
        return res.status(403).json({ error: 'Insufficient permissions' });
      }

      req.user = user;
      next();
    } catch (err) {
      return res.status(401).json({ error: 'Invalid or expired token' });
    }
  };
}

function generateToken(userId, role) {
  return jwt.sign({ userId, role }, JWT_SECRET, { expiresIn: '7d' });
}

module.exports = { authMiddleware, generateToken, JWT_SECRET };
