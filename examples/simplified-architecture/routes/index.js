'use strict';

const { Router } = require('express');
const userController = require('../controllers/UserController');
const postController = require('../controllers/PostController');

const router = Router();

// ──────────────────────────────────────────────
//  User routes
//  Base path: /users  (mounted in index.js)
// ──────────────────────────────────────────────
router.get('/users', (req, res) => userController.index(req, res));
router.get('/users/:id', (req, res) => userController.show(req, res));
router.post('/users', (req, res) => userController.store(req, res));
router.put('/users/:id', (req, res) => userController.update(req, res));
router.delete('/users/:id', (req, res) => userController.destroy(req, res));
router.post('/users/login', (req, res) => userController.login(req, res));

// ──────────────────────────────────────────────
//  Post routes
//  Base path: /posts  (mounted in index.js)
// ──────────────────────────────────────────────
router.get('/posts', (req, res) => postController.index(req, res));
router.get('/posts/:id', (req, res) => postController.show(req, res));
router.post('/posts', (req, res) => postController.store(req, res));
router.put('/posts/:id', (req, res) => postController.update(req, res));
router.delete('/posts/:id', (req, res) => postController.destroy(req, res));

module.exports = router;
