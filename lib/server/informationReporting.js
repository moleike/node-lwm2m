/*
 * Copyright 2014 Telefonica Investigación y Desarrollo, S.A.U
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

var async = require('async');
var apply = async.apply;
var debug = require('debug')('lwm2m');
var objectValues = require('object.values');

/**
 * Generates an observer ID from its parts. The ID has the following pattern:
 *
 *   <deviceId>:/<objectType>/<objectId>/<resourceId>
 *
 * @param {Number} deviceId         ID of the device, provided by the LWM2M server.
 * @param {Number} objectType       ID of the object type.
 * @param {Number} objectId         ID of the object instance.
 * @param {Number} resourceId       Observed resource of the object.
 * @returns {string}                The generated ID.
 */
function buildId(deviceId, objectType, objectId, resourceId) {
    return deviceId + ':/' + objectType + '/' + objectId + '/' + resourceId;
}

/**
 * Parse an observer ID, returning its parts encapsulated in an object.
 *
 * @param {String} idString         Observer ID.
 * @returns {{deviceId: string, objectType: string, objectId: string, resourceId: string}}
 */
function parseId(idString) {
    var fieldList = idString.substring(idString.indexOf(':') + 2).split('/');

    return {
        deviceId: idString.substring(0, idString.indexOf(':')),
        objectType: fieldList[0],
        objectId: fieldList[1],
        resourceId: fieldList[2]
    };
}

/**
 * Constructs an object representing the subscription for the changes in the value of a particular resource of a
 * device.
 *
 * @param {Number} deviceId             Internal ID of the device of the subscription (not the endpoint ID).
 * @param {Number} objectType           Number identifying the object type.
 * @param {Number} objectId             Number identifying the object instance.
 * @param {Number} resourceId           Resource of the object to be subscribed to.
 * @param {Object} observeStream        Stream object for writing into.
 * @param {Function} handler            Handler to be called each time a new piece of data arrives.
 * @returns {{id: string, resource: string, deviceId: *, stream: *, dataHandler: Function, finishHandler: Function}}
 * @constructor
 */
function ResourceListener(deviceId, objectType, objectId, resourceId, observeStream, handler) {
    return {
        id: buildId(deviceId, objectType, objectId, resourceId),
        resource: '/' + objectType + '/' + objectId + '/' + resourceId,
        deviceId: deviceId,
        stream: observeStream,

        dataHandler: function (chunk) {
            debug('New data on resource /%s/%s/%s in device [%d]',
                objectType, objectId, resourceId, deviceId);

            handler(chunk.toString('utf8'), objectType, objectId, resourceId, deviceId);
        },

        finishHandler: function(chunk) {
            debug('Finished observing value of resource /%s/%s/%s in device [%d]',
                objectType, objectId, resourceId, deviceId);

            delete this.subscriptions[this.id];
        }
    };
}

/**
 * Creates the subscription object and establish the handlers for the incoming data. The first piece of data has a
 * special treatment, as it has to be returned with the callback.
 *
 * @param {Number} deviceId             Internal ID of the device of the subscription (not the endpoint ID).
 * @param {Number} objectType           Number identifying the object type.
 * @param {Number} objectId             Number identifying the object instance.
 * @param {Number} resourceId           Resource of the object to be subscribed to.
 * @param {Function} handler            Handler to be called each time a new piece of data arrives.
 * @param {Object} observeStream        Stream object for writing into.
 */
function processStream(deviceId, objectType, objectId, resourceId, handler, observeStream, callback) {
    var subscriptionId = buildId(deviceId, objectType, objectId, resourceId);

    observeStream.pause();

    this.subscriptions[subscriptionId] =
        new ResourceListener(deviceId, objectType, objectId, resourceId, observeStream, handler);

    observeStream.on('data', function (chunk) {
        debug('Got first piece of data on resource /%s/%s/%s in device [%d]',
            objectType, objectId, resourceId, deviceId);

        observeStream.removeAllListeners('data');
        observeStream.on('data', this.subscriptions[subscriptionId].dataHandler);
        callback(null, chunk.toString('utf8'));
    });

    observeStream.on('finish', this.subscriptions[subscriptionId].finishHandler);
    observeStream.resume();
}

/**
 * Creates a subscription to a resource in a device, executing the given handler each time new data arrives to the
 * server. As part of the the subscription process, the first piece of data will be automatically resolved in the
 * same way as a Read action (returning the current resource data in the callback). Subsquent data will be processed
 * by the handler.
 *
 * @param {Number} deviceId             Internal ID of the device of the subscription (not the endpoint ID).
 * @param {Number} objectType           Number identifying the object type.
 * @param {Number} objectId             Number identifying the object instance.
 * @param {Number} resourceId           Resource of the object to be subscribed to.
 * @param {Function} handler            Handler to be called each time a new piece of data arrives.
 */
function observe(deviceId, objectType, objectId, resourceId, handler, callback) {
    function createObserveRequest(obj, callback) {
        var request = {
            host: obj.address,
            port: obj.port,
            method: 'GET',
            pathname: '/' + objectType + '/' + objectId + '/' + resourceId,
            observe: true
        };

        callback(null, request);
    }

    debug('Observing value from resource /%s/%s/%s in device [%d]',
        objectType, objectId, resourceId, deviceId);

    var registry = this.getRegistry();

    async.waterfall([
        apply(registry.get, deviceId),
        createObserveRequest,
        this.send.bind(this),
        processStream.bind(this, deviceId, objectType, objectId, resourceId, handler)
    ], callback);
}

/**
 * Gets a list of all the this.subscriptions to client resources actually in use.
 *
 */
function list(callback) {
    callback(null, objectValues(this.subscriptions));
}

/**
 * Remove all the observations the server is currently performing.
 *
 * TODO: completely close the streams instead of simply removing them.
 */
function clean(callback) {
    var subscriptionKeys = Object.keys(this.subscriptions);

    for (var i in subscriptionKeys) {
        this.subscriptions[subscriptionKeys[i]].stream.close();
        delete this.subscriptions[i];
    }

    this.subscriptions = {};

    if (this._registry){
        this._registry.stopLifetimeCheck();
    }

    callback();
}

/**
 * Cancel an observation for the specified resource in a particular device.
 *
 * @param {Number} deviceId
 * @param {Number} objectType
 * @param {Number} objectId
 * @param {Number} resourceId
 */
function cancel(deviceId, objectType, objectId, resourceId, callback) {
    var subscriptionId = buildId(deviceId, objectType, objectId, resourceId);

    this.subscriptions[subscriptionId].stream.close();
    delete this.subscriptions[subscriptionId];

    callback();
}

exports.buildId = buildId;
exports.parseId = parseId;
exports.observe = observe;
exports.list = list;
exports.clean = clean;
exports.cancel = cancel;
