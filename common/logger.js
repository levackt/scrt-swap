const winston = require('winston');
const consoleFormat = require('winston-console-format');

const logger = winston.createLogger({
    level: 'silly',
    format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.ms(),
        winston.format.errors({ stack: true }),
        winston.format.splat(),
        winston.format.json()
    ),
    defaultMeta: { service: 'Test' },
    transports: [
        new winston.transports.Console({
            format: winston.format.combine(
                winston.format.colorize({ all: true }),
                winston.format.padLevels(),
                consoleFormat.consoleFormat({
                    showMeta: true,
                    metaStrip: ['timestamp', 'service'],
                    inspectOptions: {
                        depth: Infinity,
                        colors: true,
                        maxArrayLength: Infinity,
                        breakLength: 120,
                        compact: Infinity
                    }
                })
            )
        }),
        new winston.transports.File({ filename: 'debug.log', level: 'debug' })
    ]
});

if (process.env.NODE_ENV !== 'prod') {
    logger.debug('Logging initialized at debug level');
}

module.exports = logger;
