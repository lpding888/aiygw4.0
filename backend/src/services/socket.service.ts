import { Server as HttpServer } from 'http';
import { Server, Socket } from 'socket.io';
import logger from '../utils/logger.js';
// import { verifyToken } from '../middleware/auth.middleware.js'; // Assuming auth middleware exists

class SocketService {
    private io: Server | null = null;

    init(httpServer: HttpServer) {
        this.io = new Server(httpServer, {
            cors: {
                origin: '*', // Customize based on security needs
                methods: ['GET', 'POST']
            }
        });

        this.io.on('connection', (socket: Socket) => {
            logger.info(`[Socket] Client connected: ${socket.id}`);

            // Optional: Authentication logic
            // const token = socket.handshake.auth.token;
            // ... verify token ...

            socket.on('join_execution', (executionId: string) => {
                logger.info(`[Socket] Client ${socket.id} joined execution: ${executionId}`);
                socket.join(`execution:${executionId}`);
            });

            socket.on('leave_execution', (executionId: string) => {
                logger.info(`[Socket] Client ${socket.id} left execution: ${executionId}`);
                socket.leave(`execution:${executionId}`);
            });

            socket.on('disconnect', () => {
                logger.info(`[Socket] Client disconnected: ${socket.id}`);
            });
        });

        logger.info('[Socket] Socket.IO initialized');
    }

    emitExecutionEvent(executionId: string, event: string, data: any) {
        if (!this.io) {
            // Warning mainly for test env where socket might not start
            // logger.warn('[Socket] Socket.IO not initialized'); 
            return;
        }

        this.io.to(`execution:${executionId}`).emit(event, data);
    }
}

export const socketService = new SocketService();
export default socketService;
