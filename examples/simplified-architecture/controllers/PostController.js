'use strict';

const Post = require('../models/Post');

/**
 * PostController — Simplified Architecture Example
 *
 * All HTTP handling, business logic (ownership checks), and ORM calls
 * are contained here. No Service or Repository layer is used.
 *
 * Routes map:
 *   GET    /posts          → index
 *   GET    /posts/:id      → show
 *   POST   /posts          → store
 *   PUT    /posts/:id      → update
 *   DELETE /posts/:id      → destroy
 */
class PostController {
  /**
   * List all posts with their author.
   * @param {import('express').Request} req
   * @param {import('express').Response} res
   */
  async index(req, res) {
    try {
      const posts = await Post.with('user').get();
      res.json({ success: true, data: posts });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  }

  /**
   * Show a single post with its author.
   * @param {import('express').Request} req
   * @param {import('express').Response} res
   */
  async show(req, res) {
    try {
      const post = await Post.with('user').where('id', req.params.id).first();
      if (!post) {
        return res.status(404).json({ success: false, message: 'Post not found' });
      }
      res.json({ success: true, data: post });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  }

  /**
   * Create a new post.
   * The authenticated user's ID is attached inline (req.user set by auth middleware).
   * @param {import('express').Request} req
   * @param {import('express').Response} res
   */
  async store(req, res) {
    try {
      const data = {
        ...req.body,
        user_id: req.user ? req.user.id : req.body.user_id,
      };

      const post = await Post.create(data);
      res.status(201).json({ success: true, data: post });
    } catch (error) {
      res.status(400).json({ success: false, message: error.message });
    }
  }

  /**
   * Update an existing post.
   * Business rule: only the post's owner may update it.
   * @param {import('express').Request} req
   * @param {import('express').Response} res
   */
  async update(req, res) {
    try {
      const post = await Post.find(req.params.id);
      if (!post) {
        return res.status(404).json({ success: false, message: 'Post not found' });
      }

      // Ownership check — inline business logic
      const requestingUserId = req.user ? req.user.id : null;
      if (requestingUserId && post.getAttribute('user_id') !== requestingUserId) {
        return res.status(403).json({ success: false, message: 'Forbidden: you do not own this post' });
      }

      post.fill(req.body);
      await post.save();
      res.json({ success: true, data: post });
    } catch (error) {
      res.status(400).json({ success: false, message: error.message });
    }
  }

  /**
   * Delete a post.
   * Business rule: only the post's owner may delete it.
   * @param {import('express').Request} req
   * @param {import('express').Response} res
   */
  async destroy(req, res) {
    try {
      const post = await Post.find(req.params.id);
      if (!post) {
        return res.status(404).json({ success: false, message: 'Post not found' });
      }

      // Ownership check — inline business logic
      const requestingUserId = req.user ? req.user.id : null;
      if (requestingUserId && post.getAttribute('user_id') !== requestingUserId) {
        return res.status(403).json({ success: false, message: 'Forbidden: you do not own this post' });
      }

      await post.delete();
      res.json({ success: true, message: 'Post deleted successfully' });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  }
}

module.exports = new PostController();
