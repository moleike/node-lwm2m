/*
 * Copyright 2017 Alexandre Moreno <alex_moreno@tutk.com>
 *
 * This file is part of lwm2m-node-lib
 *
 * lwm2m-node-lib is free software: you can redistribute it and/or
 * modify it under the terms of the GNU Affero General Public License as
 * published by the Free Software Foundation, either version 3 of the License,
 * or (at your option) any later version.
 *
 * lwm2m-node-lib is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.
 * See the GNU Affero General Public License for more details.
 *
 * You should have received a copy of the GNU Affero General Public
 * License along with lwm2m-node-lib.
 * If not, seehttp://www.gnu.org/licenses/.
 *
 * For those usages not covered by the GNU Affero General Public License
 * please contact with::[contacto@tid.es]
 */

'use strict';

var coapRouter = require('../coapRouter'),
    bootstrap = require('../server/bootstrap'),
    async = require('async'),
    coapUtils = require('../server/coapUtils'),
    logger = require('logops'),
    context = {
        op: 'LWM2MLib.BootstrapServer'
    },
    apply = async.apply,
    config,
    status = 'STOPPED';

function loadDefaultHandlers(serverInfo, config) {
    logger.info(context, 'Loading default handlers');

    serverInfo.handlers = {
        bootstrapRequest: {
            lib : bootstrap.handle,
            user: coapRouter.defaultHandler
        }
    };
}

function loadRoutes(serverInfo) {
    logger.info(context, 'Loading routes');

    serverInfo.routes = [
        ['POST', /\/bs$/, 'bootstrapRequest']
    ];
}

function start(serverConfig, startCallback) {
    function loadDefaults(serverInfo, callback) {
        loadRoutes(serverInfo);
        loadDefaultHandlers(serverInfo, config);
        callback(null, serverInfo);
    }

    config = serverConfig;
    if (config.logLevel) {
        logger.setLevel(config.logLevel);
    }

    logger.info(context, 'Starting Lightweight M2M Bootstrap Server');

    bootstrap.init(config);
    coapUtils.init(config);

    async.waterfall([
        apply(coapRouter.start, config),
        loadDefaults
    ], function (error, results) {
        if (error) {
            status = 'ERROR';
        } else {
            status = 'RUNNING';
        }

        startCallback(error, results);
    });
}

function stop(serverInfo, callback) {
    status = 'STOPPED';

    async.series([
        apply(coapRouter.stop, serverInfo)
    ], callback);
}

function isRunning() {
    return status === 'RUNNING';
}

function setHandler(serverInfo, type, handler) {
    coapRouter.setHandler(serverInfo, type, handler);
}

exports.start = start;
exports.setHandler = setHandler;
exports.stop = stop;
exports.isRunning = isRunning;
exports.write = bootstrap.write;
exports.remove = bootstrap.remove;
exports.finish = bootstrap.finish;
