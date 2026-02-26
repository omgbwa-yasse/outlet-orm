'use strict';

const User = require('../models/User');
const bcrypt = require('bcrypt');

/**
 * UserController — Simplified Architecture Example
 *
 * All HTTP handling, business logic, and ORM calls are contained here.
 * No Service or Repository layer is used.
 *
 * Routes map:
 *   GET    /users          → index
 *   GET    /users/:id      → show
 *   POST   /users          → store
 *   PUT    /users/:id      → update
 *   DELETE /users/:id      → destroy
 *   POST   /users/login    → login
 */
class UserController {
  /**
   * List all users.
   * @param {import('express').Request} req
   * @param {import('express').Response} res
   */
  async index(req, res) {
    try {
      const users = await User.all();
      res.json({ success: true, data: users });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  }

  /**
   * Show a single user with their posts.
   * @param {import('express').Request} req
   * @param {import('express').Response} res
   */
  async show(req, res) {
    try {
      const user = await User.with('posts').where('id', req.params.id).first();
      if (!user) {
        return res.status(404).json({ success: false, message: 'User not found' });
      }
      res.json({ success: true, data: user });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  }

  /**
   * Create a new user.
   * Business logic (duplicate email check, password hashing) is inline.
   * @param {import('express').Request} req
   * @param {import('express').Response} res
   */
  async store(req, res) {
    try {
      // Business rule: email must be unique
      const existing = await User.where('email', req.body.email).first();
      if (existing) {
        return res.status(409).json({ success: false, message: 'Email already in use' });
      }

      // Business logic: hash password before persisting
      const data = { ...req.body };
      data.password = await bcrypt.hash(data.password, 10);

      const user = await User.create(data);
      res.status(201).json({ success: true, data: user });
    } catch (error) {
      res.status(400).json({ success: false, message: error.message });
    }
  }

  /**
   * Update an existing user.
   * @param {import('express').Request} req
   * @param {import('express').Response} res
   */
  async update(req, res) {
    try {
      const user = await User.find(req.params.id);
      if (!user) {
        return res.status(404).json({ success: false, message: 'User not found' });
      }

      // Re-hash password if it is being updated
      const data = { ...req.body };
      if (data.password) {
        data.password = await bcrypt.hash(data.password, 10);
      }

      user.fill(data);
      await user.save();
      res.json({ success: true, data: user });
    } catch (error) {
      res.status(400).json({ success: false, message: error.message });
    }
  }

  /**
   * Delete a user.
   * @param {import('express').Request} req
   * @param {import('express').Response} res
   */
  async destroy(req, res) {
    try {
      const user = await User.find(req.params.id);
      if (!user) {
        return res.status(404).json({ success: false, message: 'User not found' });
      }
      await user.delete();
      res.json({ success: true, message: 'User deleted successfully' });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  }

  /**
   * Authenticate a user (login).
   * Business logic (credential check) is inline — no AuthService needed.
   * @param {import('express').Request} req
   * @param {import('express').Response} res
   */
  async login(req, res) {
    try {
      const user = await User.where('email', req.body.email).first();
      if (!user) {
        return res.status(401).json({ success: false, message: 'Invalid credentials' });
      }

      const passwordMatch = await bcrypt.compare(
        req.body.password,
        user.getAttribute('password')
      );

      if (!passwordMatch) {
        return res.status(401).json({ success: false, message: 'Invalid credentials' });
      }

      // In a real app, generate a JWT here.
      res.json({ success: true, data: user, token: 'your-jwt-token-here' });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  }
}

module.exports = new UserController();
