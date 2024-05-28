const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const bodyParser = require('body-parser');
const chatRoutes = require('./src/routes/chatRoute');
const { rooms } = require("./src/controllers/chatController")
const { encryptMessage } = require("./src/utils/encryption")

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

// Middleware
app.use(bodyParser.json());


// Websocket config
io.on('connection', (socket) => {
    console.log('Novo cliente conectado');
    socket.on('disconnect', () => {
        console.log('Cliente desconectado');
    });

    socket.on('message', (data) => {
        console.log(data)
        // Get data from the message event
        const { roomKey, userName, message } = data;
    
        // Verifies room existance and users authorization
        const room = rooms[roomKey];
        if (!room || !room.connectedUsers.has(userName)) {
            // If the user isnt authorzied, fake's room existance to prevent bruteforcing.
            socket.emit('messageError', 'The specified room does not exist.');
            return;
        }
    
        // If the user is authorized, add the message to room's temporary data
        const encryptedMessage = encryptMessage(message, roomKey);
        room.messages.push({ user: userName, message: encryptedMessage });
    
        // If successful, make all clients reload messages.
        io.to(roomKey).emit('messageSuccess', 'Message event called');
    });

    socket.on('join', (data) => {
        const room = rooms[data.roomKey];
        if (room) {
            // Verifies if the user is authorized to join the specified room
            if (!room.users.has(data.userName)) {
                // If the user is not authorized to join, fakes room's existence to prevent bruteforcing.
                socket.emit('joinError', 'The specified room does not exist.');
                return;
            }
    
            // There is an user with the same name already connected?
            for (let user of room.connectedUsers) {
                if (user === data.userName) {
                    // If true, fakes room's existence to prevent from bruteforcing
                    socket.emit('joinError', 'The specified room does not exist.');
                    return;
                }
            }
    
            // If everthing is ok, add the user to the chat
            socket.join(data.roomKey);
            room.connectedUsers.add(data.userName);
            io.to(data.roomKey).emit('userJoined', { userName: data.userName });
            io.to(data.roomKey).emit('userCount', room.connectedUsers.size);
            socket.emit('joinSuccess', { roomName: room.name, userCount: room.connectedUsers.size });
        } else {
            // If the room dont exist, emit an error
            socket.emit('joinError', 'The specified room does not exist.');
        }
    });

    socket.on('leave', (data) => {
        const room = rooms[data.roomKey];
        if (room && room.connectedUsers.has(data.userName)) {
            socket.leave(data.roomKey);
            room.connectedUsers.delete(data.userName);
            socket.emit('leaveSuccess')
            // Change the usercount if someone leaves
            io.to(data.roomKey).emit('userCount', room.connectedUsers.size);
        }
    });

    socket.on('message', (data) => {
        io.to(data.roomKey).emit('message', { user: data.userName, message: data.message });
    });
});

app.use('/api', chatRoutes);

app.get('/', (req, res) => {
    res.sendFile(__dirname + '/src/public/index.html');
});


const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Servidor WebSocket e HTTP iniciado na porta ${PORT}`);
});
