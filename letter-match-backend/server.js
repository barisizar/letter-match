const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');

const app = express();
app.use(cors());

const server = http.createServer(app);
const io = socketIo(server, {
    cors: {
        origin: "http://localhost:3000",
        methods: ["GET", "POST"]
    }
});

const rooms = new Map();
const clientRooms = new Map();

function generateGrid(size) {
    const grid = [];
    const consonants = 'BCDFGHJKLMNPQRSTVWXYZ';
    const vowels = 'AEIOU';
    const totalCells = size * size;
    const minVowels = Math.floor(totalCells * 0.3); // Ensure at least 30% vowels

    for (let i = 0; i < size; i++) {
        const row = [];
        for (let j = 0; j < size; j++) {
            if (grid.flat().filter(char => vowels.includes(char)).length < minVowels) {
                // Add a vowel if we haven't met the minimum yet
                row.push(vowels[Math.floor(Math.random() * vowels.length)]);
            } else {
                // Randomly choose between vowel and consonant, slightly favoring consonants
                const isVowel = Math.random() < 0.4;
                if (isVowel) {
                    row.push(vowels[Math.floor(Math.random() * vowels.length)]);
                } else {
                    row.push(consonants[Math.floor(Math.random() * consonants.length)]);
                }
            }
        }
        grid.push(row);
    }
    return grid;
}

function switchTurn(roomId) {
    const room = rooms.get(roomId);
    if (room) {
        const playerIds = Array.from(room.players.keys());
        const currentPlayerIndex = playerIds.indexOf(room.currentPlayer);
        room.currentPlayer = playerIds[(currentPlayerIndex + 1) % playerIds.length];
        io.to(roomId).emit('currentPlayer', room.currentPlayer);
    }
}

function generateRoomId() {
    return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
}

function getRoomList() {
    return Array.from(rooms.values()).map(room => ({
        id: room.id,
        name: room.name,
        players: room.players.size
    }));
}

io.on('connection', (socket) => {
    console.log('New client connected');

    socket.on('joinRoom', ({ roomId, username }) => {
        let room = rooms.get(roomId);
        if (!room) {
            room = {
                id: roomId,
                players: new Map(),
                currentPlayer: null,
                gameStarted: false,
                grid: generateGrid(16)
            };
            rooms.set(roomId, room);
        }

        if (room.players.size < 2) {
            room.players.set(socket.id, { id: socket.id, username, score: 0 });
            socket.join(roomId);
            clientRooms.set(socket.id, roomId);

            socket.emit('roomJoined', { roomId, roomName: room.name });
            io.to(roomId).emit('playerList', Array.from(room.players.values()));

            if (room.players.size === 2 && !room.gameStarted) {
                room.gameStarted = true;
                room.currentPlayer = Array.from(room.players.keys())[0];
                io.to(roomId).emit('gameStarted', { firstPlayerId: room.currentPlayer, grid: room.grid });
            } else {
                socket.emit('updateGrid', room.grid);
            }

            // After updating the room, emit the updated room list
            io.emit('roomList', getRoomList());
        } else {
            socket.emit('roomError', 'Room is full');
        }
    });

    socket.on('submitWord', ({ roomId, word, score, removedLetters }) => {
        const room = rooms.get(roomId);
        if (room && room.currentPlayer === socket.id) {
            const player = room.players.get(socket.id);
            player.score += score;

            removedLetters.forEach(({ row, col }) => {
                room.grid[row][col] = '';
            });

            io.to(roomId).emit('wordSubmitted', { word, score, playerId: socket.id, removedLetters });
            io.to(roomId).emit('playerList', Array.from(room.players.values()));
            io.to(roomId).emit('updateGrid', room.grid);

            switchTurn(roomId);
        }
    });

    socket.on('endTurn', ({ roomId }) => {
        switchTurn(roomId);
    });

    socket.on('disconnect', () => {
        console.log('Client disconnected');
        const roomId = clientRooms.get(socket.id);
        if (roomId) {
            const room = rooms.get(roomId);
            if (room) {
                room.players.delete(socket.id);
                if (room.players.size === 0) {
                    rooms.delete(roomId);
                } else {
                    io.to(roomId).emit('playerList', Array.from(room.players.values()));
                    if (room.currentPlayer === socket.id) {
                        switchTurn(roomId);
                    }
                }
            }
            clientRooms.delete(socket.id);
        }
    });

    socket.on('createRoom', ({ roomName, username }) => {
        const roomId = generateRoomId();
        const room = {
            id: roomId,
            name: roomName,
            players: new Map(),
            currentPlayer: null,
            gameStarted: false,
            grid: generateGrid(16)
        };
        rooms.set(roomId, room);

        // Join the room
        socket.join(roomId);
        room.players.set(socket.id, { id: socket.id, username, score: 0 });
        clientRooms.set(socket.id, roomId);

        // Notify the client that the room was created
        socket.emit('roomCreated', { roomId });

        // Update the room list for all clients
        io.emit('roomList', getRoomList());
    });

    socket.on('getRoomList', () => {
        socket.emit('roomList', getRoomList());
    });
});

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => console.log(`Server running on port ${PORT}`));
