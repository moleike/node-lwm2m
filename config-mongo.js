var config = {};

// Configuration of the LWTM2M Server
//--------------------------------------------------
config.server = {
    port: 5683,                         // Port where the server will be listening
    lifetimeCheckInterval: 1000,        // Minimum interval between lifetime checks in ms
    udpWindow: 100,
    defaultType: 'Device',
    ipProtocol: 'udp4',
    serverProtocol: 'udp4',
    deviceRegistry: {
        type: 'mongodb',
        host: 'localhost',
        port: '27017',
        db: 'lwtm2m'
    }
};

// Configuration of the LWTM2M Client
//--------------------------------------------------
config.client = {
    lifetime: '85671',
    version: '1.0',
    observe: {
        period: 3000
    },
    ipProtocol: 'udp4',
    serverProtocol: 'udp4'
};

module.exports = config;
