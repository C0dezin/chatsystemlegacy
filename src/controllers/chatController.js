const { encryptMessage, decryptMessage } = require('../utils/encryption');
const moment = require('moment');

const rooms = {};

function createRoom(req, res) {
    const { roomName, key, users } = req.body;
    if (!roomName || !key || !users || !Array.isArray(users)) {
        return res.status(400).send('Rooms name, Rooms key and Authorized users are required.');
    }
    const today = moment().format('YYYYMMDD');
    const currentTime = moment().format('HHmmss');
    const randomNumber = Math.floor(Math.random() * 1000000) + 1;
    const roomKey = encryptMessage(`${today}-${currentTime}-${randomNumber}-${roomName}-${key}`, key);

    rooms[roomKey] = {
        name: roomName,
        users: new Set(users),
        messages: [],
        connectedUsers: new Set(),
        inactivityTimer: null,
        initialConnectionTimer: null
    };

    startInitialConnectionTimer(roomKey);

    res.status(201).send({ roomKey });
}

function getMessages(req, res) {
    const { roomKey, userName } = req.query;
    const room = rooms[roomKey];
    console.log(room)

    if (!room || !room.connectedUsers.has(userName)) {
        return res.status(403).send('The specified room does not exist.');
    }

    res.json(room.messages.map(msg => ({ user: msg.user, message: decryptMessage(msg.message, roomKey) })));
}

function postMessage(req, res) {
    const { roomKey, userName, message } = req.body;
    const room = rooms[roomKey];

    if (!room || !room.connectedUsers.has(userName)) {
        return res.status(403).send('The specified room does not exist.');
    }

    const encryptedMessage = encryptMessage(message, roomKey);
    room.messages.push({ user: userName, message: encryptedMessage });

    // Emits an event for refreshing messages.
    io.to(roomKey).emit('message', { user: userName, message: message });

    res.status(201).send('Message sent.');
}

function startInitialConnectionTimer(roomKey) {
    if (rooms[roomKey].initialConnectionTimer) {
        clearTimeout(rooms[roomKey].initialConnectionTimer);
    }
    rooms[roomKey].initialConnectionTimer = setTimeout(() => {
        console.log(`Sala ${roomKey} deletada por falta de conexão inicial.`);
        delete rooms[roomKey];
        console.log(rooms)
    }, 5 * 60 * 1000);
}

module.exports = { createRoom, getMessages, startInitialConnectionTimer, rooms };
