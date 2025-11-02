const express = require('express');
const User = require('../models/User');
const auth = require('../middleware/auth');

const router = express.Router();

// Get user's connections
router.get('/', auth, async (req, res) => {
  try {
    const user = await User.findById(req.user._id).populate('connections', 'name profilePicture headline');
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    res.json(user.connections);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Follow a user
router.post('/:id/follow', auth, async (req, res) => {
  try {
    if (req.params.id === req.user._id.toString()) {
      return res.status(400).json({ error: 'Cannot follow yourself' });
    }

    const userToFollow = await User.findById(req.params.id);
    const currentUser = await User.findById(req.user._id);

    if (!userToFollow || !currentUser) {
      return res.status(404).json({ error: 'User not found' });
    }

    if (currentUser.connections.includes(req.params.id)) {
      return res.status(400).json({ error: 'Already following this user' });
    }

    currentUser.connections.push(req.params.id);
    await currentUser.save();

    // Create notification for the followed user
    const Notification = require('../models/Notification');
    const notification = new Notification({
      recipient: req.params.id,
      sender: req.user._id,
      type: 'follow',
      message: `${currentUser.name} started following you`,
    });
    await notification.save();

    res.json({ message: 'User followed successfully' });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Unfollow a user
router.post('/:id/unfollow', auth, async (req, res) => {
  try {
    const currentUser = await User.findById(req.user._id);

    if (!currentUser) {
      return res.status(404).json({ error: 'User not found' });
    }

    const connectionIndex = currentUser.connections.indexOf(req.params.id);
    if (connectionIndex === -1) {
      return res.status(400).json({ error: 'Not following this user' });
    }

    currentUser.connections.splice(connectionIndex, 1);
    await currentUser.save();

    res.json({ message: 'User unfollowed successfully' });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Get connection suggestions (users not followed yet)
router.get('/suggestions', auth, async (req, res) => {
  try {
    const currentUser = await User.findById(req.user._id);
    const suggestions = await User.find({
      _id: { $ne: req.user._id, $nin: currentUser.connections }
    }).select('name profilePicture headline location skills').limit(20);

    res.json(suggestions);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get mutual connections count
router.get('/:id/mutual', auth, async (req, res) => {
  try {
    const targetUser = await User.findById(req.params.id).populate('connections');
    const currentUser = await User.findById(req.user._id).populate('connections');

    if (!targetUser || !currentUser) {
      return res.status(404).json({ error: 'User not found' });
    }

    const mutualConnections = currentUser.connections.filter(connection =>
      targetUser.connections.some(targetConnection =>
        targetConnection._id.toString() === connection._id.toString()
      )
    );

    res.json({
      count: mutualConnections.length,
      connections: mutualConnections.slice(0, 5).map(conn => ({
        _id: conn._id,
        name: conn.name,
        profilePicture: conn.profilePicture
      }))
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get connection requests (pending)
router.get('/requests', auth, async (req, res) => {
  try {
    // For now, return empty array as we don't have pending requests yet
    // This can be expanded with a separate collection for connection requests
    res.json([]);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get network stats
router.get('/stats', auth, async (req, res) => {
  try {
    const user = await User.findById(req.user._id).populate('connections');
    const totalConnections = user.connections.length;

    // Calculate network size (connections of connections)
    const networkIds = new Set();
    for (const connection of user.connections) {
      const connectionData = await User.findById(connection._id).populate('connections');
      connectionData.connections.forEach(conn => networkIds.add(conn._id.toString()));
    }
    networkIds.delete(req.user._id.toString()); // Remove self
    user.connections.forEach(conn => networkIds.delete(conn._id.toString())); // Remove direct connections

    res.json({
      connections: totalConnections,
      networkSize: networkIds.size
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
