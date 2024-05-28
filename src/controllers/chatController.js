const { encryptMessage, decryptMessage } = require('../utils/encryption');
const moment = require('moment');

const rooms = {};

function createRoom(req, res) {
    const { roomName, key, users } = req.body;
    if (!roomName || !key || !users || !Array.isArray(users)) {
        return res.status(400).send('Rooms name, Rooms key and Authorized users are required.');
    }
    const today = moment().format('YYYYMMDD');
    const roomKey = encryptMessage(`${today}-${roomName}-${key}`, key);

    rooms[roomKey] = {
        name: roomName,
        users: new Set(users),
        messages: [],
        connectedUsers: new Set()
    };

    res.status(201).send({ roomKey });
}

function joinRoom(req, res) {
    const { roomKey, userName } = req.body;

    if (!roomKey || !userName) {
        return res.status(400).send('Rooms key and username are required');
    }

    const room = rooms[roomKey];
    if (!room || !room.users.has(userName)) {
        return res.status(400).send('The specified room does not exist.'); //if the user isnt authorzied or the room does not exist
    }

    room.connectedUsers.add(userName);

    // Send event to all clients saying that theres a new user
    io.emit('join', { roomKey, userName });

    res.status(200).send({ roomName: room.name, userCount: room.connectedUsers.size });
}


function leaveRoom(req, res) {
    const { roomKey, userName } = req.body;
    const room = rooms[roomKey];

    if (room) {
        room.connectedUsers.delete(userName);
    }

    res.status(200).send('User left.');
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

module.exports = { createRoom, joinRoom, leaveRoom, getMessages, postMessage, rooms };
