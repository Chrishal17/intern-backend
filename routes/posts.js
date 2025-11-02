const express = require('express');
const { body, validationResult } = require('express-validator');
const Post = require('../models/Post');
const auth = require('../middleware/auth');

const router = express.Router();

// Get all posts
router.get('/', auth, async (req, res) => {
  try {
    const posts = await Post.find().populate('author', 'name profilePicture').sort({ createdAt: -1 });
    res.json(posts);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Create a post
router.post('/', auth, [
  body('content').notEmpty().withMessage('Content is required'),
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  try {
    const post = new Post({
      author: req.user._id,
      content: req.body.content,
      image: req.body.image || '',
    });
    await post.save();
    await post.populate('author', 'name profilePicture');
    res.status(201).json(post);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Update a post
router.put('/:id', auth, async (req, res) => {
  try {
    const post = await Post.findOne({ _id: req.params.id, author: req.user._id });
    if (!post) {
      return res.status(404).json({ error: 'Post not found' });
    }

    post.content = req.body.content || post.content;
    post.image = req.body.image || post.image;
    await post.save();
    await post.populate('author', 'name profilePicture');
    res.json(post);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Delete a post
router.delete('/:id', auth, async (req, res) => {
  try {
    const post = await Post.findOneAndDelete({ _id: req.params.id, author: req.user._id });
    if (!post) {
      return res.status(404).json({ error: 'Post not found' });
    }
    res.json({ message: 'Post deleted' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Like a post
router.post('/:id/like', auth, async (req, res) => {
  try {
    const post = await Post.findById(req.params.id);
    if (!post) {
      return res.status(404).json({ error: 'Post not found' });
    }

    const likeIndex = post.likes.indexOf(req.user._id);
    const Notification = require('../models/Notification');

    if (likeIndex > -1) {
      post.likes.splice(likeIndex, 1);
    } else {
      post.likes.push(req.user._id);

      // Create notification if liking (not unliking)
      if (post.author.toString() !== req.user._id.toString()) {
        const liker = await require('../models/User').findById(req.user._id);
        const notification = new Notification({
          recipient: post.author,
          sender: req.user._id,
          type: 'like',
          message: `${liker.name} liked your post`,
          relatedPost: post._id,
        });
        await notification.save();
      }
    }

    await post.save();
    await post.populate('author', 'name profilePicture');
    res.json(post);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Add a comment
router.post('/:id/comment', auth, [
  body('text').notEmpty().withMessage('Comment text is required'),
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  try {
    const post = await Post.findById(req.params.id);
    if (!post) {
      return res.status(404).json({ error: 'Post not found' });
    }

    post.comments.push({
      user: req.user._id,
      text: req.body.text,
    });

    await post.save();

    // Create notification if commenting on someone else's post
    if (post.author.toString() !== req.user._id.toString()) {
      const commenter = await require('../models/User').findById(req.user._id);
      const Notification = require('../models/Notification');
      const notification = new Notification({
        recipient: post.author,
        sender: req.user._id,
        type: 'comment',
        message: `${commenter.name} commented on your post`,
        relatedPost: post._id,
      });
      await notification.save();
    }

    await post.populate('author', 'name profilePicture');
    await post.populate('comments.user', 'name profilePicture');
    res.json(post);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

module.exports = router;
