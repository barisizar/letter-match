import React, { useEffect, useState } from 'react';
import { BrowserRouter as Router, Route, Routes } from 'react-router-dom';
import Lobby from './Lobby';
import LetterMatch from './LetterMatch';
import { initSocket } from './socket';

function App() {
  const [socketStatus, setSocketStatus] = useState('Connecting to server...');

  useEffect(() => {
    initSocket((connected, error) => {
      if (connected) {
        setSocketStatus('Connected');
      } else {
        setSocketStatus(`Connection failed: ${error || 'Unknown error'}`);
      }
    });
  }, []);

  if (socketStatus !== 'Connected') {
    return <div>{socketStatus}</div>;
  }

  return (
    <Router>
      <div className="App">
        <Routes>
          <Route path="/" element={<Lobby />} />
          <Route path="/room/:roomId" element={<LetterMatch />} />
        </Routes>
      </div>
    </Router>
  );
}

export default App;
