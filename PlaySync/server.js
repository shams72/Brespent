const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');

const app = express();
app.use(cors());
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: '*' } });

const GRID = { cols: 30, rows: 20 };

let players = {};
let apples = {}; 
let roomState = {}
let poisonApplePowerUpSpawn = {};
let poisonApplePowerUpActiveByPlayer = {};
let mapPoisionAppleByPlayer = {}

function randomApple(roomId, roomPlayers) {
    while(true) {   
        const x = Math.floor(Math.random() * GRID.cols);
        const y = Math.floor(Math.random() * GRID.rows);

        const collidesWithSnake = Object.values(roomPlayers).some(p => p.snake.some(s => s.x === x && s.y === y));
        const collidesWithApple = apples[roomId].some(a => a.x === x && a.y === y);
        if (!collidesWithSnake && !collidesWithApple) return { x, y };
    }
}

function spawnInitialApples(count = 8, roomId, roomPlayers) {

  if (!apples[roomId]) apples[roomId] = []; 
  for (let i = 0; i < count; i++) apples[roomId].push(randomApple(roomId, roomPlayers));
}

function spawnPoisionApplePowerUp(roomId, playerId, roomPlayers) {
    const clients = io.sockets.adapter.rooms.get(roomId);
    let maxCount = 8;

    for (const clientId of clients) {
        if(players[clientId].snake.length > maxCount) {
            maxCount = players[clientId].snake.length
        }
    }  

    if(maxCount === 8) return [];

    const maxApples = Math.min(2, Math.floor(maxCount/2)); 
    const poisonApplePowerUpCount = Math.floor(Math.random() * (maxApples + 1));

    if(!poisonApplePowerUpSpawn[roomId]) poisonApplePowerUpSpawn[roomId] = [];

    while(poisonApplePowerUpSpawn[roomId].length < poisonApplePowerUpCount) {   
        const x = Math.floor(Math.random() * GRID.cols);
        const y = Math.floor(Math.random() * GRID.rows);

        const collidesWithSnake = Object.values(roomPlayers).some(p => p.snake.some(s => s.x === x && s.y === y));
        const collidesWithApple = apples[roomId].some(a => a.x === x && a.y === y);
        if (!collidesWithSnake && !collidesWithApple) {
           
            if (poisonApplePowerUpSpawn[roomId].some(p => p.x === x && p.y === y)) {
                continue;
            }
            poisonApplePowerUpSpawn[roomId].push({ x, y });
        } 
    }

    return poisonApplePowerUpSpawn[roomId];
}

io.on('connection', (socket) => {
    console.log('a usdder connected:', socket.id);

    socket.on('snakeUpdate', (snakeData) => {

        const roomId = players[socket.id]?.room;
        
        if (!roomId) {return}

        const roomSockets = io.sockets.adapter.rooms.get(roomId) || new Set();
        const roomPlayers = Object.fromEntries(
            Object.entries(players).filter(([id]) => roomSockets.has(id))
        )
        const roomPlayersIds = Object.keys(roomPlayers);

        const head = snakeData;
       

        const enemyKeys = Object.keys(roomPlayers).filter(
            (key) => key !== socket.id
        );

        
        if(!mapPoisionAppleByPlayer[enemyKeys[0]]) {
            mapPoisionAppleByPlayer[enemyKeys[0]] = []
        }

        if(!mapPoisionAppleByPlayer[socket.id]) {
            mapPoisionAppleByPlayer[socket.id] = []
        }

        const dangerousApples = mapPoisionAppleByPlayer[enemyKeys[0]]
        const myPosionousApple =  mapPoisionAppleByPlayer[socket.id]

        if (dangerousApples.length > 0 ) {
            const dangerousApplesIndex = dangerousApples.findIndex(a => a.x === head.x && a.y === head.y);
            if(dangerousApplesIndex !== -1) {
                const appleIndex = apples[roomId].findIndex(a => a.x === head.x && a.y === head.y);
                mapPoisionAppleByPlayer[enemyKeys[0]].splice(dangerousApplesIndex, 1)
                apples[roomId].splice(appleIndex, 1);
                console.log("heelo from sec")
                if ( roomPlayers[socket.id].snake.length > 14) {
                    roomPlayers[socket.id].snake.unshift(snakeData);            
                    const removalLength = Math.floor(roomPlayers[socket.id].snake.length * 0.35);
                    for (let i = 0; i < 5; i++) {
                        roomPlayers[socket.id].snake.pop();
                    }
                }
            }
        }

        if (myPosionousApple.length > 0) {
            const myPosionousAppleIndex = myPosionousApple.findIndex(a => a.x === head.x && a.y === head.y);
            if(myPosionousAppleIndex !== -1) {
                console.log("heelo from sec")
                const appleIndex = apples[roomId].findIndex(a => a.x === head.x && a.y === head.y);
                mapPoisionAppleByPlayer[socket.id].splice(myPosionousAppleIndex, 1)
                apples[roomId].splice(appleIndex, 1);
                
                if ( roomPlayers[socket.id].snake.length > 14) {
                    roomPlayers[socket.id].snake.unshift(snakeData);   
                    const removalLength = Math.floor(roomPlayers[socket.id].snake.length * 0.25);         
                    for (let i = 0; i < 1; i++) {
                        roomPlayers[socket.id].snake.pop();
                    }
                }


            }
        }


        const appleIndex = apples[roomId].findIndex(a => a.x === head.x && a.y === head.y);

        if (appleIndex !== -1) {
            apples[roomId].splice(appleIndex, 1);
            apples[roomId].push(randomApple(roomId, roomPlayers));
            roomPlayers[socket.id].snake.unshift(snakeData);
                        
        } else {
            roomPlayers[socket.id].snake.unshift(snakeData);
            roomPlayers[socket.id].snake.pop(); 
        }

        let poisonApplesPowerUps = [];

        const now = Date.now();
        /*if (now >= roomState[roomId].poisonSpawnTime) {
            poisonApplesPowerUps = spawnPoisionApplePowerUp(socket.id, roomPlayers);
        }*/

        poisonApplesPowerUps  = spawnPoisionApplePowerUp(roomId, socket.id, roomPlayers);
        
        const poisonApplesPowerUpsIndex = poisonApplesPowerUps.findIndex(a => a.x === head.x && a.y === head.y);
        if (poisonApplesPowerUpsIndex !== -1) {
            poisonApplesPowerUps.splice(poisonApplesPowerUpsIndex, 1);
        }



        const poisonousApple = roomPlayersIds.reduce((acc, id) => {
        if (!mapPoisionAppleByPlayer[id]) {
            mapPoisionAppleByPlayer[id] = [];  
        }
        acc[id] = mapPoisionAppleByPlayer[id];
        return acc;
        }, {});




        console.log('Spawning poison apples/power-ups for player', poisonApplesPowerUps);        
        io.to(roomId).emit('gameState', { players: roomPlayers, apples: apples[roomId], grid: GRID, poisonApplesPowerUps, poisonousApple});
    });

    socket.on('poisonCapabilityEmit', () => {

        const roomId = players[socket.id]?.room;

        if(!poisonApplePowerUpActiveByPlayer[socket.id]) poisonApplePowerUpActiveByPlayer[socket.id] = [];
        
        poisonApplePowerUpActiveByPlayer[socket.id].push(true);
        socket.to(roomId).emit('poisonCapabilityInfo', { 
            num: poisonApplePowerUpActiveByPlayer[socket.id].length 
        });

    });

    socket.on('appleState', ({x,y}) => {
        apples.push({x,y});        
        io.emit('appleState', { apples});
    });

    socket.on('generatePoisonousApple', () => { 
        
        console.log("i am called");

        const roomId = players[socket.id]?.room;        
        
        if (!roomId) {return}

        const roomSockets = io.sockets.adapter.rooms.get(roomId) || new Set();
        const roomPlayers = Object.fromEntries(
            Object.entries(players).filter(([id]) => roomSockets.has(id))
        );

        let i = 0;

        while(i != 2) {   
            const x = Math.floor(Math.random() * GRID.cols);
            const y = Math.floor(Math.random() * GRID.rows);

            if(!mapPoisionAppleByPlayer[socket.id]) mapPoisionAppleByPlayer[socket.id] = [];


            if(!poisonApplePowerUpSpawn[roomId]) { break};
            
            const collidesWithSnake = Object.values(roomPlayers).some(p => p.snake.some(s => s.x === x && s.y === y));
            const collidesWithApple = apples[roomId].some(a => a.x === x && a.y === y);
            const collideWithApplePowerUpSpawn = poisonApplePowerUpSpawn[roomId].some(p => p.x === x && p.y === y) || false;
            
            
            if (!collidesWithSnake && !collidesWithApple && !collideWithApplePowerUpSpawn) {
                apples[roomId].push({x, y})
                mapPoisionAppleByPlayer[socket.id].push({x, y})
                i++;
            }      
            
        }

        io.to(roomId).emit('poisonState', {safeId: socket.id, poisonApples:  mapPoisionAppleByPlayer[socket.id], originalApples: apples[roomId] });

    }) 

    socket.on('disconnect', () => {       
        const roomId = players[socket.id]?.room;
        if(!roomId) { 
            delete players[socket.id];
            return;
        }
        const clients = io.sockets.adapter.rooms.get(roomId);

        delete  players[socket.id];

        if (clients) {
            for (const clientId of clients) {
                delete players[clientId];
               
                const clientSocket = io.sockets.sockets.get(clientId);
                if (clientSocket) {

                    socket.to(roomId).emit("partnerDisconnected", {
                        message: "Your partner left the game. Press OK reload."
                    });

                    apples[roomId] = [];
                        
                    io.to(roomId).emit('gameState', { players:{}, apples: apples[roomId], grid: GRID });
                    clientSocket.leave(roomId);  
                }
            }
        }
    });

    socket.on("joinRoom", ({ roomId }) => {

        const clients = io.sockets.adapter.rooms.get(roomId);
        const centerY = Math.floor(GRID.rows / 2);
        let snake;
        
        if (clients && clients.size >= 2) {
            socket.emit("roomFull", { roomId }); 
            return;
        }
        
        if (socket.rooms.has(roomId)) {
            return;
        }

        if (players[socket.id] && players[socket.id].room) {
            socket.emit("alreadyInRoom", { roomId: players[socket.id].room });
            return;
        }

        socket.join(roomId);            

        const roomSockets = io.sockets.adapter.rooms.get(roomId) || new Set();
      
        players[socket.id] = { id: socket.id, room: roomId }; 

        roomState[roomId] = {
            startTime: Date.now(),
            poisonSpawned: false,
            poisonSpawnTime: Date.now() + (30 + Math.random() * 10) * 1000 // 30–40s
        };
        
        let roomPlayers = Object.fromEntries(
            Object.entries(players).filter(([id]) => roomSockets.has(id))
        );

        const existingCount = Object.keys(roomPlayers).length;

        if (existingCount % 2 === 0) {
            snake = [{ x: 3, y: centerY }, { x: 2, y: centerY }, { x: 1, y: centerY }];
        } else {
            snake = [{ x: GRID.cols - 4, y: centerY }, { x: GRID.cols - 3, y: centerY }, { x: GRID.cols - 2, y: centerY }];
        }
      

        roomPlayers[socket.id].color = existingCount % 2 === 0 ? 'cyan' : 'orange';
        players[socket.id].color = existingCount % 2 === 0 ? 'cyan' : 'orange';

        roomPlayers[socket.id].snake = snake;
        players[socket.id].snake = snake;

        spawnInitialApples(8, roomId, roomPlayers)

        io.to(roomId).emit("playerJoined", { playerId: socket.id });
        io.to(roomId).emit('gameState', { players: roomPlayers , apples: apples[roomId], grid: GRID });
        
    });
    
})

const PORT = 4000;
server.listen(PORT, () => console.log(`Server listening on http://localhost:${PORT}`));