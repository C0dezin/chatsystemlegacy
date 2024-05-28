const express = require('express');
const router = express.Router();
const chatController = require('../controllers/chatController');

router.get('/messages', chatController.getMessages);
router.post('/create-room', chatController.createRoom);
router.post('/join-room', chatController.joinRoom);
router.post('/leave-room', chatController.leaveRoom);
router.post('/messages', chatController.postMessage);

module.exports = router;
