const express = require('express');
const { body, validationResult } = require('express-validator');
const Message = require('../models/Message');
const User = require('../models/User');
const auth = require('../middleware/auth');

const router = express.Router();

// Get messages for current user (sent and received)
router.get('/', auth, async (req, res) => {
  try {
    const messages = await Message.find({
      $or: [{ sender: req.user._id }, { receiver: req.user._id }]
    })
    .populate('sender', 'name profilePicture')
    .populate('receiver', 'name profilePicture')
    .sort({ createdAt: -1 });

    res.json(messages);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get conversation with a specific user
router.get('/conversation/:userId', auth, async (req, res) => {
  try {
    const messages = await Message.find({
      $or: [
        { sender: req.user._id, receiver: req.params.userId },
        { sender: req.params.userId, receiver: req.user._id }
      ]
    })
    .populate('sender', 'name profilePicture')
    .populate('receiver', 'name profilePicture')
    .sort({ createdAt: 1 });

    res.json(messages);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Send a message
router.post('/', auth, [
  body('receiver').notEmpty().withMessage('Receiver is required'),
  body('content').notEmpty().withMessage('Message content is required'),
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  try {
    const { receiver, content } = req.body;

    // Check if receiver exists
    const receiverUser = await User.findById(receiver);
    if (!receiverUser) {
      return res.status(404).json({ error: 'Receiver not found' });
    }

    // Check if sender is connected to receiver
    const senderUser = await User.findById(req.user._id);
    if (!senderUser.connections.includes(receiver) && req.user._id.toString() !== receiver) {
      return res.status(403).json({ error: 'You can only message people in your network' });
    }

    const message = new Message({
      sender: req.user._id,
      receiver,
      content,
    });

    await message.save();

    // Create notification for the receiver
    if (req.user._id.toString() !== receiver) {
      const Notification = require('../models/Notification');
      const sender = await User.findById(req.user._id);
      const notification = new Notification({
        recipient: receiver,
        sender: req.user._id,
        type: 'message',
        message: `${sender.name} sent you a message`,
        relatedMessage: message._id,
      });
      await notification.save();
    }

    await message.populate('sender', 'name profilePicture');
    await message.populate('receiver', 'name profilePicture');

    res.status(201).json(message);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Mark message as read
router.put('/:id/read', auth, async (req, res) => {
  try {
    const message = await Message.findOne({
      _id: req.params.id,
      receiver: req.user._id
    });

    if (!message) {
      return res.status(404).json({ error: 'Message not found' });
    }

    message.read = true;
    await message.save();

    res.json({ message: 'Message marked as read' });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

module.exports = router;
