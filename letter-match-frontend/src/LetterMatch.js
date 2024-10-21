import React, { useState, useEffect, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import { getSocket } from './socket';
import './LetterMatch.css';
import englishWords from 'an-array-of-english-words';

const GRID_SIZE = 16; // Changed from 16 to 8 for a more manageable size
const MIN_WORD_LENGTH = 3;
const ROUND_TIME = 30;

function LetterMatch() {
    const { roomId } = useParams();
    const [grid, setGrid] = useState([]);
    const [selectedLetters, setSelectedLetters] = useState([]);
    const [score, setScore] = useState(0);
    const [message, setMessage] = useState('');
    const [players, setPlayers] = useState([]);
    const [currentPlayer, setCurrentPlayer] = useState(null);
    const [timeLeft, setTimeLeft] = useState(ROUND_TIME);
    const [gameStarted, setGameStarted] = useState(false);
    const [previousWords, setPreviousWords] = useState([]);
    const [disappearedLetters, setDisappearedLetters] = useState([]);

    const socket = getSocket();

    useEffect(() => {
        socket.emit('joinRoom', { roomId, username: localStorage.getItem('username') });

        socket.on('playerList', (playerList) => {
            setPlayers(playerList);
        });

        socket.on('gameStarted', ({ firstPlayerId, grid }) => {
            console.log('Game started, first player:', firstPlayerId);
            setGameStarted(true);
            setCurrentPlayer(firstPlayerId);
            setTimeLeft(ROUND_TIME);
            setGrid(grid);
        });

        socket.on('updateGrid', (newGrid) => {
            setGrid(newGrid);
        });

        socket.on('wordSubmitted', ({ word, score, playerId, removedLetters }) => {
            setMessage(`Player submitted "${word}" for ${score} points!`);
            setPlayers(prevPlayers =>
                prevPlayers.map(player =>
                    player.id === playerId ? { ...player, score: player.score + score } : player
                )
            );
            setPreviousWords(prev => [...prev, { text: word, score }]);
            setDisappearedLetters(prev => [...prev, ...removedLetters]);
            setSelectedLetters([]);
        });

        socket.on('currentPlayer', (playerId) => {
            setCurrentPlayer(playerId);
            setTimeLeft(ROUND_TIME);
        });

        return () => {
            socket.off('playerList');
            socket.off('gameStarted');
            socket.off('updateGrid');
            socket.off('wordSubmitted');
            socket.off('currentPlayer');
        };
    }, [roomId, socket]);

    const getRandomLetter = () => {
        const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
        return alphabet[Math.floor(Math.random() * alphabet.length)];
    };

    const initializeGrid = useCallback(() => {
        const newGrid = [];
        for (let i = 0; i < GRID_SIZE; i++) {
            const row = [];
            for (let j = 0; j < GRID_SIZE; j++) {
                row.push(getRandomLetter());
            }
            newGrid.push(row);
        }
        setGrid(newGrid);
    }, []);

    const isValidWord = useCallback((word) => {
        return englishWords.includes(word.toLowerCase());
    }, []);

    const calculateScore = useCallback((word) => {
        return word.length * 10;
    }, []);

    const removeSelectedLetters = useCallback(() => {
        setGrid(prevGrid => {
            const newGrid = prevGrid.map(row => [...row]);
            selectedLetters.forEach(({ row, col }) => {
                newGrid[row][col] = ''; // Remove the letter instead of replacing it
            });
            return newGrid;
        });
    }, [selectedLetters]);

    const isAdjacent = (row1, col1, row2, col2) => {
        return Math.abs(row1 - row2) <= 1 && Math.abs(col1 - col2) <= 1;
    };

    const handleLetterClick = (row, col) => {
        if (disappearedLetters.some(letter => letter.row === row && letter.col === col)) {
            return; // Don't allow clicking on disappeared letters
        }

        const lastSelected = selectedLetters[selectedLetters.length - 1];
        if (selectedLetters.length === 0 || isAdjacent(lastSelected.row, lastSelected.col, row, col)) {
            const existingIndex = selectedLetters.findIndex(item => item.row === row && item.col === col);
            if (existingIndex !== -1 && existingIndex === selectedLetters.length - 1) {
                setSelectedLetters(selectedLetters.slice(0, -1));
            } else if (existingIndex === -1) {
                const letter = grid[row][col];
                setSelectedLetters([...selectedLetters, { letter, row, col }]);
            }
        }
    };

    const endTurn = useCallback(() => {
        const socket = getSocket();
        socket.emit('endTurn', { roomId });
    }, [roomId]);

    useEffect(() => {
        if (currentPlayer === socket.id && timeLeft > 0) {
            const timer = setTimeout(() => {
                setTimeLeft(prev => prev - 1);
            }, 1000);
            return () => clearTimeout(timer);
        } else if (timeLeft === 0) {
            endTurn();
        }
    }, [currentPlayer, timeLeft, endTurn]);

    const handleSubmit = useCallback(() => {
        const word = selectedLetters.map(item => item.letter).join('');
        if (word.length >= MIN_WORD_LENGTH && englishWords.includes(word.toLowerCase())) {
            const wordScore = word.length * 10;
            socket.emit('submitWord', { roomId, word, score: wordScore, removedLetters: selectedLetters });
            setSelectedLetters([]);
        } else {
            setMessage(`"${word}" is not a valid word. Try again!`);
        }
    }, [selectedLetters, roomId, socket]);

    return (
        <div className="letter-match-container">
            <h1 className="game-title">LetterMatch - Room: {roomId}</h1>

            <div className="game-status">
                <div className="current-player">Current Player: {currentPlayer === socket.id ? 'Your Turn' : 'Opponent\'s Turn'}</div>
                <div className="timer">Time Left: {timeLeft}s</div>
            </div>

            <div className="game-content">
                <div className="previous-words">
                    <h3>Previous Words</h3>
                    <ul>
                        {previousWords.map((word, index) => (
                            <li key={index}>{word.text}: {word.score}</li>
                        ))}
                    </ul>
                </div>

                <div className="grid-container">
                    {grid.map((row, rowIndex) => (
                        row.map((letter, colIndex) => (
                            <button
                                key={`${rowIndex}-${colIndex}`}
                                className={`grid-button 
                                    ${selectedLetters.some(item => item.row === rowIndex && item.col === colIndex) ? 'selected' : ''}
                                    ${disappearedLetters.some(item => item.row === rowIndex && item.col === colIndex) ? 'disappeared' : ''}
                                `}
                                onClick={() => handleLetterClick(rowIndex, colIndex)}
                                disabled={currentPlayer !== socket.id || disappearedLetters.some(item => item.row === rowIndex && item.col === colIndex)}
                            >
                                {letter}
                            </button>
                        ))
                    ))}
                </div>

                <div className="player-scores">
                    <h3>Scores</h3>
                    {players.map(player => (
                        <div key={player.id} className="player-score">
                            {player.username}: {player.score}
                        </div>
                    ))}
                </div>
            </div>

            <div className="game-controls">
                <div className="selected-word">
                    {selectedLetters.map(item => item.letter).join('')}
                </div>
                <button
                    className="button button-primary"
                    onClick={handleSubmit}
                    disabled={currentPlayer !== socket.id || selectedLetters.length < MIN_WORD_LENGTH}
                >
                    Submit Word
                </button>
            </div>

            {message && <div className="message">{message}</div>}
        </div>
    );
}

export default LetterMatch;
