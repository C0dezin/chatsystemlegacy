const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const bodyParser = require('body-parser');
const chatRoutes = require('./src/routes/chatRoute');
const { rooms, startInitialConnectionTimer } = require("./src/controllers/chatController")
const { encryptMessage } = require("./src/utils/encryption")

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

// Middleware
app.use(bodyParser.json());


function startInactivityTimer(roomKey) {
    if (rooms[roomKey].inactivityTimer) {
        clearTimeout(rooms[roomKey].inactivityTimer);
    }
    rooms[roomKey].inactivityTimer = setTimeout(() => {
        console.log(`Sala ${roomKey} deletada por inatividade.`);
        io.to(roomKey).emit('leaveSuccess')
        delete rooms[roomKey];
        console.log(rooms)
    }, 15 * 60 * 1000);
}

// Websocket config
io.on('connection', (socket) => {
    console.log('New connection to socket.');

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
        //Restarts inactivity timer
        startInactivityTimer(data.roomKey, socket);
    });

    socket.on('image', (data) => {
        const room = rooms[data.roomKey];
        if (room && room.connectedUsers.has(data.userName)) {
            const base64Image = `data:${data.imageType};base64,${data.image}`;
            const encryptedMessage = encryptMessage(base64Image, data.roomKey);
            room.messages.push({ user: data.userName, message: encryptedMessage });

            startInactivityTimer(data.roomKey);

            io.to(data.roomKey).emit('message', { user: data.userName, message: base64Image });
            io.to(data.roomKey).emit('messageSuccess', 'Message event called');
            startInactivityTimer(data.roomKey, socket);
        }
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
    
            if (room.connectedUsers.size === 0) {
                // Primeira conexão de um usuário, cancela o temporizador inicial
                clearTimeout(room.initialConnectionTimer);
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

            if (room.connectedUsers.size === 0) {
                console.log(`Room ${data.roomKey} deleted for having no users.`);
                delete rooms[data.roomKey];
                console.log(rooms)
            }
        }
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