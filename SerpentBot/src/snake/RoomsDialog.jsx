import { useState } from 'react';

const RoomDialog = ({showDialog,setShowDialog ,setRoomID, roomID, socket}) => {

  const generateRoomId= () => {
    setRoomID(Math.random().toString(36).substring(2, 8))
  }

  const sendRoomToWebsocket = () => { 
    if (!roomID) return;
    console.log("Attempting to send Room ID:", roomID);
    if (socket) {
      socket.current.emit("joinRoom", { roomId: roomID });
      console.log("Room ID sent to server:", roomID);
    }
  }
    
  return (
    <div
      style={{
        position: 'fixed',
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -46.5%)',
        backgroundColor: '#121212',
        color: '#fff',
        border: '2px solid #00ff88',
        borderRadius: '16px',
        padding: '1.5rem',
        maxWidth: '420px',
        width: '90%',
        boxShadow: '0 0 20px rgba(0, 255, 136, 0.3)',
        zIndex: 999,
        fontSize: '16px',
        lineHeight: '1.6',
        textAlign: 'left',
      }}
    >
        <button
            onClick={() => setShowDialog(!showDialog)}
            aria-label="Close Rules"
            style={{
            position: 'absolute',
            top: '10px',
            right: '12px',
            background: 'transparent',
            border: 'none',
            color: '#fff',
            fontSize: '20px',
            cursor: 'pointer',
            fontWeight: 'bold',
            lineHeight: 1,
            }}
        >
            ✖️
        </button>

      <h2 style={{ textAlign: 'center', marginBottom: '1rem' }}>Enter Room ID:</h2>
      <p style={{ marginBottom: '1rem' }}>
        To join a multiplayer game, generate a unique Room ID. Share this ID with friends to play together!
      </p>
       <input
          type="text"
          onInput={(e) => setRoomID(e.target.value)}
          value={roomID || ""}
          placeholder="Enter Room ID"
          style={{
            padding: "10px",
            borderRadius: "8px",
            border: "1px solid #ccc",
            fontSize: "14px",
            fontFamily: "'Orbitron', sans-serif",
            marginRight: "10px",
            width: "180px",
          }}
        />
        <button
          onClick={() => sendRoomToWebsocket()}
          style={{
            padding: "10px 20px",
            background: "linear-gradient(135deg, #42a5f5, #1e88e5)",
            border: "none",
            borderRadius: "8px",
            color: "white",
            fontWeight: "bold",
            cursor: "pointer",
            marginRight: "10px",
          }}
        >
          Join
        </button>

        <button
          onClick={() => generateRoomId()}
          style={{
          
            padding: "10px 20px",
            background: "linear-gradient(135deg, #66bb6a, #388e3c)",
            border: "none",
            borderRadius: "8px",
            color: "white",
            fontWeight: "bold",
            cursor: "pointer",
          }}
        >
          Create Room
        </button>
      
    </div>
  );
};

export default RoomDialog;
