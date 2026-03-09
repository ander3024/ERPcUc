import { Server } from 'socket.io';
import { Server as HttpServer } from 'http';

let io: Server;

export function initSocket(httpServer: HttpServer) {
  io = new Server(httpServer, {
    cors: {
      origin: process.env.CORS_ORIGIN?.split(',') || ['http://localhost:5173'],
      credentials: true,
    },
  });

  io.on('connection', (socket) => {
    socket.on('join-room', (room: string) => socket.join(room));
    socket.on('leave-room', (room: string) => socket.leave(room));
  });

  return io;
}

export function getIO(): Server {
  if (!io) throw new Error('Socket.io no inicializado');
  return io;
}
