import React, { useEffect, useState, useRef } from 'react';
import './Snake.css';
import { io } from 'socket.io-client';
import RoomsDialog from './RoomsDialog';

const CELL = 20; 
const SERVER_URL = process.env.REACT_APP_SERVER_URL || 'http://localhost:4000';

const Snake = () => {
  const playArea = useRef(null);
  const snakeRef = useRef([]); 
  const applesRef = useRef([]);
  const poisonApplesSpawnUpRef = useRef([]);
  const socketRef = useRef(null);
  const [players, setPlayers] = useState({}); 
  const [socketId, setSocketId] = useState(null);
  const [roomID, setRoomID] = useState(null);
  const [showRoomDialog, setRoomDialog] = useState(false);
  const [_, setRenderTick] = useState(0);
  const gridRef = useRef( useRef({ cols: 30, rows: 20 }));
  const enemyPoisonApplesRef = useRef(0);
  const myPoisonApplesRef = useRef(0);

  useEffect(()=>{
   const updateGridDimensions = () => {
      if (playArea.current) {
        const width = playArea.current.clientWidth;
        const height = playArea.current.clientHeight;
        const cols = Math.floor(width / CELL);
        const rows = Math.floor(height / CELL);
        gridRef.current = {cols,rows};
        
      }
    };

    updateGridDimensions();
    window.addEventListener('resize', updateGridDimensions);
    return () => window.removeEventListener('resize', updateGridDimensions);
  },[])

  const syncApplesFromServer = (serverApples, poisonousApple) => {

    applesRef.current.forEach(a => {
      try { a.element.remove(); } catch (e) {}
    });
    applesRef.current = [];
    serverApples.forEach((a) => {
      const isPoison = Array.isArray(poisonousApple) 
          ? poisonousApple.some(p => p.x === a.x && p.y === a.y)
          : false;

          createApple(a.x, a.y, isPoison ? "evil" : "normal");
    });

  }

  const syncPoisonApplesFromServer = (serverPoisonApples) => {

    poisonApplesSpawnUpRef.current.forEach(a => {
      try { a.element.remove(); } catch (e) {}
    }); 

    poisonApplesSpawnUpRef.current = [];
    serverPoisonApples.forEach((a, index) => createPoisonousAppleSpawnUp(a.x, a.y, "Poisonous"))
  }


  useEffect(() => {

    if (socketRef.current) return;

    socketRef.current = io(SERVER_URL, { transports: ['websocket'] });

    socketRef.current.on('connect', () => {
      setSocketId(socketRef.current.id);
      console.log('connected to server', socketRef.current.id);
    });

    socketRef.current.on("partnerDisconnected", ({ message }) => {
      alert(message); 
       window.location.reload();
    });

    socketRef.current.on('gameState', (state) => {
      const { players, apples, poisonApplesPowerUps, poisonousApple} = state;
      setPlayers(players);
      
      console.log(poisonousApple);

      let poisonApple = [];

      if(poisonousApple) {
        poisonApple = poisonousApple[socketRef.current.id]
      } 


      syncApplesFromServer(apples, poisonApple);

      if(poisonApplesPowerUps) {syncPoisonApplesFromServer(poisonApplesPowerUps);}
      
      if (socketRef.current && players[socketRef.current.id]) {
        snakeRef.current = players[socketRef.current.id].snake;
        setRenderTick(t => t + 1);      
      }     
    })
    
    socketRef.current.on('appleState', (state) => {
      const { apples} = state;   
      console.log('Received apple state from server:', apples);
      syncApplesFromServer(apples);
    })

    socketRef.current.on('poisonState', ({safeId, poisonApples, originalApples}) => {

      applesRef.current.forEach(a => {
          try { a.element.remove(); } catch (e) {}
      });
      applesRef.current = [];
      
      if(safeId !== socketRef.current.id) {
        
        const allApples = [...originalApples, ...poisonApples];
        allApples.forEach((a, index) => createApple(a.x, a.y, "warning"));

      }else {

        originalApples.forEach((a, index) => createApple(a.x, a.y, "normal"));
        poisonApples.forEach((a, index) => createApple(a.x, a.y, "evil"));

      }

    });

    socketRef.current.on('poisonCapabilityInfo', (state) => {
      const { num } = state; 

      enemyPoisonApplesRef.current = num

      console.log('Received poison apple capability info from server:', num);
      //setRenderTick(t => t + 1);      
    })

  },[])

  const handleKeyPress = (e) => {

    const snake = snakeRef.current;
    const head = snake[0];
    const direction = getDirection(e.key);
    if(!direction) return;
        
    const newHead = {x: head.x + direction.x , y: head.y + direction.y};
    if (snakeRef.current.some(segment => segment.x === newHead.x && segment.y === newHead.y)) return; 

    const { cols, rows } = gridRef.current;
    if ( newHead.x < 0 || newHead.x >= cols ||  newHead.y < 0 || newHead.y >= rows) return;

    let ateApple = false;

    /*applesRef.current = applesRef.current.filter((apple) => {
      const hit = apple.x === newHead.x && apple.y === newHead.y;
      if (hit) {
        ateApple = true;
        apple.element.parentNode.removeChild(apple.element);
        return false; 
      }
        
      return true;
    });*/
    
    const hit = poisonApplesSpawnUpRef.current.some((poisonousSpawnUp) => {
      return poisonousSpawnUp.x === newHead.x && poisonousSpawnUp.y === newHead.y;
    });

    if (hit) {
      myPoisonApplesRef.current += 1;
      socketRef.current.emit('poisonCapabilityEmit');
    }

    
    /*if (ateApple) {
      snakeRef.current = [newHead, ...snake];
    } else {
      snakeRef.current = [newHead, ...snake.slice(0, -1)];
    }*/
    
    setRenderTick((t) => t + 1);
    if (socketRef.current ) {
      socketRef.current.emit('snakeUpdate', newHead);
    }

  };

  const getDirection = (key) => {
    switch (key) {
      case 'ArrowUp':
        return { x: 0, y: -1 };
      case 'ArrowDown':
        return { x: 0, y: 1 };
      case 'ArrowLeft':
        return { x: -1, y: 0 };
      case 'ArrowRight':
        return { x: 1, y: 0 };
      case  'p' || 'P':
        return generatePoisonousApple();      
      default:
        return null;
    }
  }

  const createApple = (x, y, type = "normal") => {
    const div = document.createElement('div');
    div.style.position = 'absolute';
    div.style.top = `${y * CELL}px`;
    div.style.left = `${x * CELL}px`;
    div.style.width = '20px';
    div.style.height = '20px';
    div.style.borderRadius = '50%';
    div.style.transition = 'transform 0.2s ease';
    div.style.zIndex = '1';

    if (type === "evil") {
      div.style.background = '#4B0033';
      div.style.boxShadow = '0 0 10px rgba(75,0,51,0.6), inset -3px -3px 6px rgba(255,255,255,0.04)';
      div.style.border = '1px solid rgba(0,0,0,0.5)';
    }
    else if (type === "warning") {
    
      div.style.background = 'radial-gradient(circle at 30% 30%, #FFD700, #FFA500)'; // gold to orange
      div.style.boxShadow = '0 0 12px #FFA500, inset 0 0 4px #FFD700';
      div.style.border = '1px solid #FFCC00';
    } 
    else {
      div.style.background = 'radial-gradient(circle at 30% 30%, #ff4d4d, #b30000)';
      div.style.boxShadow = '0 0 10px #ff4d4d, inset 0 0 4px #ff9999';
      div.style.border = '1px solid #ffcccc';
    }

    playArea.current.appendChild(div);
    applesRef.current.push({ x, y, element: div });
  };


  const createPoisonousAppleSpawnUp = (x, y, id) => {
   
    const div = document.createElement('div');
    div.id = `poison-spawnup-${id}`;
    div.style.position = 'absolute';
    div.style.top = `${y * CELL}px`;
    div.style.left = `${x * CELL}px`;
    div.style.width = '20px';
    div.style.height = '20px';
    div.style.borderRadius = '50%';
    div.style.background = 'radial-gradient(circle at 30% 30%, #800080, #4b004b)'; // purple
    div.style.boxShadow = '0 0 12px #ff00ff, inset 0 0 5px #d600d6';
    div.style.border = '1px solid #ff66ff';
    div.style.transition = 'transform 0.2s ease';
    div.style.zIndex = '2';

    playArea.current.appendChild(div);
    poisonApplesSpawnUpRef.current.push({ x, y, element: div });  
  };



  const generateMultipleApples = (count = 10) => {
    const { cols, rows } = gridRef.current;
    let generated = 0;
    if (applesRef.current.length >= 120) return;
    
    while (generated < count) {
      const x = Math.floor(Math.random() * cols);
      const y = Math.floor(Math.random() * rows);

      if (applesRef.current.some(apple => apple.x === x && apple.y === y) || snakeRef.current.some(segment => segment.x === x && segment.y === y)) {
        continue;
      }

      createApple(x,y);
      if (socketRef.current) {
        socketRef.current.emit('appleState', ({x,y}));
      }
      generated++;
     
    }

    setRenderTick(t => t + 1);
   
  };

  const generatePoisonousApple = () => {
      socketRef.current.emit('generatePoisonousApple');
  };



  const preventDefaultScroll = (e) => {
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) {
      e.preventDefault();
    }

    if (e.key.toLowerCase() === "p" || e.key.toLowerCase() === "P") {
      //generatePoisonousApple();
       e.preventDefault();
    }
  };

  useEffect(() => {

    window.addEventListener('keydown', preventDefaultScroll);
    window.addEventListener('keydown', handleKeyPress);
    window.addEventListener('wheel', (e) => { e.preventDefault();}, { passive: false });
    
    return () => {
      window.removeEventListener('keydown', preventDefaultScroll);
      window.removeEventListener('keydown', handleKeyPress);
      window.addEventListener('wheel', (e) => { e.preventDefault();}, { passive: false });
    };
  }, []);

  return (
    <>
    <div
      style={{
        position: 'fixed',
        top: '4%',
        left: '50%',
        transform: 'translateX(-50%)',
        display: 'flex',          
        width:"80%",
        gap: '20px',
        zIndex: 1000,
        flexDirection: 'row',      
        alignItems: 'center',      
        justifyContent: 'center',  
      }}
    >

      {/* 🔴 Add 10 Prey */}
      <button
        onClick={() => generateMultipleApples(10)}
        style={{
          padding: '14px 30px',
          background: 'linear-gradient(135deg, #ff416c, #ff4b2b)',
          border: "none",
          color: 'white',
          fontSize: '16px',
          fontWeight: 'bold',
          fontFamily: "'Orbitron', sans-serif",
          borderRadius: '30px',
          cursor: 'pointer',
          boxShadow: '0 8px 15px rgba(255, 75, 43, 0.4)',
          transition: 'all 0.3s ease',
        }}
        onMouseOver={e => {
          e.currentTarget.style.background = 'linear-gradient(135deg, #ff4b2b, #ff416c)';
          e.currentTarget.style.boxShadow = '0 12px 20px rgba(255, 75, 43, 0.6)';
          e.currentTarget.style.transform = 'scale(1.05)';
        }}
        onMouseOut={e => {
          e.currentTarget.style.background = 'linear-gradient(135deg, #ff416c, #ff4b2b)';
          e.currentTarget.style.boxShadow = '0 8px 15px rgba(255, 75, 43, 0.4)';
          e.currentTarget.style.transform = 'scale(1)';
        }}
      >
        {enemyPoisonApplesRef.current}
      </button>
      <button
        onClick={() => generateMultipleApples(10)}
        style={{
          padding: '14px 30px',
          background: 'linear-gradient(135deg, #ff416c, #ff4b2b)',
          border: "none",
          color: 'white',
          fontSize: '16px',
          fontWeight: 'bold',
          fontFamily: "'Orbitron', sans-serif",
          borderRadius: '30px',
          cursor: 'pointer',
          boxShadow: '0 8px 15px rgba(255, 75, 43, 0.4)',
          transition: 'all 0.3s ease',
        }}
        onMouseOver={e => {
          e.currentTarget.style.background = 'linear-gradient(135deg, #ff4b2b, #ff416c)';
          e.currentTarget.style.boxShadow = '0 12px 20px rgba(255, 75, 43, 0.6)';
          e.currentTarget.style.transform = 'scale(1.05)';
        }}
        onMouseOut={e => {
          e.currentTarget.style.background = 'linear-gradient(135deg, #ff416c, #ff4b2b)';
          e.currentTarget.style.boxShadow = '0 8px 15px rgba(255, 75, 43, 0.4)';
          e.currentTarget.style.transform = 'scale(1)';
        }}
      >
        {myPoisonApplesRef.current}
      </button>
      <button
        onClick={() =>setRoomDialog(true)}
        style={{
          padding: '14px 30px',
          background: 'linear-gradient(135deg, #415effff, #ff4b2b)',
          border: "none",
          color: 'white',
          fontSize: '16px',
          fontWeight: 'bold',
          fontFamily: "'Orbitron', sans-serif",
          borderRadius: '30px',
          cursor: 'pointer',
          boxShadow: '0 8px 15px rgba(255, 75, 43, 0.4)',
          transition: 'all 0.3s ease',
        }}
        onMouseOver={e => {
          e.currentTarget.style.background = 'linear-gradient(135deg, #2b4bffff, #ff416c)';
          e.currentTarget.style.boxShadow = '0 12px 20px rgba(103, 255, 43, 0.6)';
          e.currentTarget.style.transform = 'scale(1.05)';
        }}
        onMouseOut={e => {
          e.currentTarget.style.background = 'linear-gradient(135deg, #416dffff, #ff4b2b)';
          e.currentTarget.style.boxShadow = '0 8px 15px rgba(43, 255, 167, 0.4)';
          e.currentTarget.style.transform = 'scale(1)';
        }}
      >
        Generate Room
      </button>

      <a
        href="https://github.com/shams72/SerpentBot.git"
        target="_blank"
        rel="noopener noreferrer"
        style={{
          padding: "14px 30px",
          background: "linear-gradient(145deg, #6f42c1, #8a63d2)",
          color: "#fff",
          borderRadius: "30px",
          fontWeight: "bold",
          fontFamily: "'Orbitron', sans-serif",
          fontSize: "16px",
          textDecoration: "none",
          textAlign: "center",
          lineHeight: "22px",
          boxShadow: "0 0 12px rgba(208, 179, 255, 0.5)",
          transition: "all 0.3s ease-in-out",
        }}
        onMouseOver={e => {
          e.currentTarget.style.boxShadow = "0 0 20px #d0b3ff";
          e.currentTarget.style.transform = "scale(1.05)";
        }}
        onMouseOut={e => {
          e.currentTarget.style.boxShadow = "0 0 12px rgba(208, 179, 255, 0.5)";
          e.currentTarget.style.transform = "scale(1)";
        }}
      >
        📦 GitHub Repo
      </a>
    </div>

    <div ref={playArea} className={"play-area"} >   
     {showRoomDialog && <RoomsDialog showDialog={showRoomDialog} setShowDialog={setRoomDialog} setRoomID={setRoomID} roomID={roomID} socket={socketRef}/>}
      <div className="game-area">
       <div className="game-area">
      {Object.entries(players).map(([id, player]) => 
        player.snake.map((segment, index) => (
          <div
            key={`${id}-${index}`}
            className="snake-body"
            style={{
              left: `${segment.x * CELL}px`,
              top: `${segment.y * CELL}px`,
              width: '20px',
              height: '20px',
              position: 'absolute',
              backgroundColor: player.color, // use their color
              borderRadius: '4px',
              border: '1px solid #111',
              boxShadow: index === 0
                ? `0 0 12px ${player.color}, inset 0 0 4px ${player.color}`
                : '0 0 6px #00000044',
              zIndex: index === 0 ? 2 : 1,
            }}
                />
              ))
            )}
      </div>

      </div>
    </div>
    <p style={{
      position: "fixed",
      top: "93.5%",
      left: "45%",
      color: "white",
      fontFamily: "sans-serif",
      borderBottomRightRadius: "12px",
      fontSize: "15px", 
      zIndex: 1000
    }}>
      Built with ❤️ using React.js
    </p>
  
    </>
  );
};

export default Snake;