import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { getSocket } from './socket';
import './Lobby.css'; // Add this import

function Lobby() {
    const [rooms, setRooms] = useState([]);
    const [newRoomName, setNewRoomName] = useState('');
    const [username, setUsername] = useState('');
    const navigate = useNavigate();
    const socket = getSocket();

    useEffect(() => {
        socket.on('roomList', (roomList) => {
            setRooms(roomList);
        });

        socket.on('roomCreated', ({ roomId }) => {
            navigate(`/room/${roomId}`);
        });

        socket.on('roomJoined', ({ roomId }) => {
            navigate(`/room/${roomId}`);
        });

        socket.on('roomError', (errorMessage) => {
            alert(errorMessage);
        });

        // Request the initial room list
        socket.emit('getRoomList');

        return () => {
            socket.off('roomList');
            socket.off('roomCreated');
            socket.off('roomJoined');
            socket.off('roomError');
        };
    }, [socket, navigate]);

    const createRoom = () => {
        if (newRoomName && username) {
            localStorage.setItem('username', username);
            socket.emit('createRoom', { roomName: newRoomName, username });
        } else {
            alert('Please enter both a username and a room name');
        }
    };

    const joinRoom = (roomId) => {
        if (username) {
            localStorage.setItem('username', username);
            socket.emit('joinRoom', { roomId, username });
        } else {
            alert('Please enter a username');
        }
    };

    return (
        <div className="lobby-container">
            <h1 className="lobby-title">Letter Match Lobby</h1>
            <div className="input-container">
                <input
                    type="text"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder="Enter your username"
                    className="input-field"
                />
            </div>
            <div className="input-container">
                <input
                    type="text"
                    value={newRoomName}
                    onChange={(e) => setNewRoomName(e.target.value)}
                    placeholder="New room name"
                    className="input-field"
                />
                <button onClick={createRoom} className="button button-primary">Create Room</button>
            </div>
            <h2 className="rooms-title">Available Rooms:</h2>
            {rooms.length > 0 ? (
                <ul className="room-list">
                    {rooms.map((room) => (
                        <li key={room.id} className="room-item">
                            {room.name} ({room.players}/2)
                            <button
                                onClick={() => joinRoom(room.id)}
                                className="button button-secondary"
                                disabled={room.players >= 2}
                            >
                                {room.players >= 2 ? 'Full' : 'Join'}
                            </button>
                        </li>
                    ))}
                </ul>
            ) : (
                <p className="no-rooms-message">No rooms available. Create one to start playing!</p>
            )}
        </div>
    );
}

export default Lobby;
