import io from 'socket.io-client';

let socket = null;
let connectionAttempts = 0;
const MAX_RECONNECTION_ATTEMPTS = 5;

export const initSocket = (callback) => {
    if (!socket) {
        console.log('Initializing socket connection...');
        socket = io('http://localhost:3001', {
            transports: ['websocket'],
            reconnectionAttempts: MAX_RECONNECTION_ATTEMPTS,
        });

        socket.on('connect', () => {
            console.log('Socket connected successfully');
            connectionAttempts = 0;
            if (callback) callback(true);
        });

        socket.on('connect_error', (error) => {
            console.error('Socket connection error:', error);
            connectionAttempts++;
            if (connectionAttempts >= MAX_RECONNECTION_ATTEMPTS) {
                if (callback) callback(false, 'Max reconnection attempts reached');
            }
        });

        socket.on('disconnect', (reason) => {
            console.log('Socket disconnected:', reason);
            if (reason === 'io server disconnect') {
                // the disconnection was initiated by the server, you need to reconnect manually
                socket.connect();
            }
        });
    } else if (socket.connected) {
        if (callback) callback(true);
    }

    return socket;
};

export const getSocket = () => {
    if (!socket) {
        throw new Error('Socket not initialized. Call initSocket() first.');
    }
    return socket;
};
