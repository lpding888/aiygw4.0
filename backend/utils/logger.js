import winston from 'winston';
const level = process.env.LOG_LEVEL ?? 'info';
const logger = winston.createLogger({
    level,
    format: winston.format.combine(winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }), winston.format.errors({ stack: true }), winston.format.json()),
    defaultMeta: { service: 'ai-photo-api' },
    transports: [
        new winston.transports.File({
            filename: 'logs/error.log',
            level: 'error',
            maxsize: 5 * 1024 * 1024,
            maxFiles: 5
        }),
        new winston.transports.File({
            filename: 'logs/combined.log',
            maxsize: 5 * 1024 * 1024,
            maxFiles: 5
        })
    ]
});
if (process.env.NODE_ENV !== 'production') {
    logger.add(new winston.transports.Console({
        format: winston.format.combine(winston.format.colorize(), winston.format.simple())
    }));
}
export const loggerStream = {
    write: (message) => {
        logger.info(message.trim());
    }
};
// 兼容旧代码直接访问 logger.stream
logger.stream = loggerStream;
export default logger;
