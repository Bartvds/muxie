'use strict';

/* jshint -W098 */
/* jshint -W003 */

var util = require('util');
var stream = require('stream');

var BufferList = require('bl');

var codes = [];

function getCode(name) {
	var code = codes.length;
	codes[code] = name;
	return code;
}

function getCodeName(code) {
	if (code < codes.length) {
		return codes[code];
	}
	return 'STREAM_' + code;
}

var STREAM_CREATE = getCode('STREAM_CREATE');
var STREAM_FINISH = getCode('STREAM_FINISH');
var STREAM_ERROR = getCode('STREAM_ERROR');
var STREAM_FIRST = codes.length;

var MAX_STREAMS = Math.pow(2, 8);

function senderPlex() {
	var buffer = [];

	var idMap = Object.create(null);
	var streamMap = Object.create(null);

	var freeIds = [];
	for (var i = STREAM_FIRST; i < MAX_STREAMS; i++) {
		freeIds.push(i);
	}

	var readable = new stream.Readable({
		objectMode: false
	});
	readable._read = function (size) {
		// console.log('readable._read %s', buffer.length);
		var sent = 0;
		while (buffer.length > 0) {
			var chunk = buffer.shift();
			sent += chunk.length;
			readable.push(chunk);
			/*if (sent > size) {
			 break;
			 }*/
		}
	};
	readable.create = function (name) {
		if (name.length >= 255) {
			throw new Error('stream name cannot be longer then 255 chars: ' + name);
		}
		if (name in idMap) {
			throw new Error('stream name exists: ' + name);
		}
		if (freeIds.length === 0) {
			throw new Error('stream id overflow, no free streams for ' + name);
		}
		var id = freeIds.shift();
		idMap[name] = id;

		var head = new Buffer(3);
		var body = new Buffer(name, 'utf8');
		head.writeUInt8(STREAM_CREATE, 0);
		head.writeUInt8(id, 1);
		head.writeUInt8(body.length, 2);
		buffer.push(head);
		buffer.push(body);
		//trigger
		readable.push(buffer.shift());

		var write = plexedWritable(id, name);
		streamMap[name] = write;
		return write;
	};

	function cleanupStream(name) {
		var id = idMap[name];
		var stream = streamMap[name];
		delete idMap[name];
		delete streamMap[name];
		freeIds.push(id);
		stream.removeAllListeners();
	}

	function sendCodeTo(id, code) {
		var head = new Buffer(2);
		head.writeUInt8(code, 0);
		head.writeUInt8(id, 1);
		buffer.push(head);
		readable.push(buffer.shift());
	}

	function plexedWritable(id, name) {
		var writable = new stream.Writable({
			objectMode: false
		});
		writable._write = function (chunk, encoding, done) {
			// console.log('plexedWritable _write %s %s %s', name, id, chunk.length);
			var head = new Buffer(5);
			head.writeUInt8(id, 0);
			head.writeUInt32LE(chunk.length, 1);
			buffer.push(head);
			buffer.push(chunk);
			readable.push(buffer.shift());
			done();
		};
		writable.on('finish', function () {
			// console.log('plexedWritable finish %s %s', name, id);
			sendCodeTo(id, STREAM_FINISH);
			cleanupStream(name);
		});
		writable.on('error', function (err) {
			console.log('plexedWritable error %s %s', name, id);
			console.log(err);
			sendCodeTo(id, STREAM_ERROR);
			cleanupStream(name);
		});
		return writable;
	}

	return readable;
}

function receiverPlex(handler) {
	var buffer = new BufferList();

	var writable = new stream.Writable({
		objectMode: false
	});

	var activeId = 0;
	var activeNeed = 0;
	var activeConsumed = 0;
	var waitNext = 1;

	var streams = [null];
	var names = [null];

	function createStream(id, name) {
		var stream = plexedReadable(id, name);
		streams[id] = stream;
		names[id] = name;
		handler(stream, name);
	}

	function closeStream(id) {
		var name = names[id];
		var stream = streams[id];
		stream.push(null);
		names[id] = null;
		stream[id] = null;
	}

	var reader = readHeader;

	function readHeader() {
		var code = buffer.readUInt8(0);
		buffer.consume(1);
		// console.log(getCodeName(code));
		if (code < STREAM_FIRST) {
			switch (code) {
				case STREAM_CREATE:
					reader = readCreateStreamHead;
					waitNext = 2;
					return;
				case STREAM_FINISH:
					reader = readFinishStream;
					waitNext = 1;
					return;
				case STREAM_ERROR:
					reader = readErrorStream;
					waitNext = 2;
					return;
				default:
					throw new Error('unhandled code ' + code);
			}
		}
		activeId = code;
		reader = readChunkLength;
		waitNext = 4;
	}

	function readCreateStreamHead() {
		activeId = buffer.readUInt8(0);
		waitNext = buffer.readUInt8(1);
		buffer.consume(2);
		reader = readCreateStreamName;
	}

	function readCreateStreamName() {
		var name = buffer.toString('utf8', 0, waitNext);
		buffer.consume(waitNext);

		createStream(activeId, name);

		reader = readHeader;
		waitNext = 1;
	}

	function readFinishStream() {
		var id = buffer.readUInt8(0);
		buffer.consume(1);
		closeStream(id);
		reader = readHeader;
		waitNext = 1;
	}

	function readErrorStream() {
		var id = buffer.readUInt8(0);
		var length = buffer.readUInt8(0);
		buffer.consume(2);
		// TODO message
		streams[id].emit('error', length);
		closeStream(id);
		reader = readHeader;
		waitNext = 1;
	}

	function readChunkLength() {
		activeNeed = buffer.readUInt32LE(0);
		buffer.consume(4);
		reader = readChunk;
		waitNext = 1;
	}

	function readChunk() {
		var take = Math.min(activeNeed, buffer.length);
		var chunk = buffer.slice(0, take);
		buffer.consume(take);
		activeNeed -= take;

		if (activeNeed === 0) {
			reader = readHeader;
			waitNext = 1;
		}
		streams[activeId].append(chunk);
	}

	writable._write = function (chunk, encoding, done) {
		buffer.append(chunk);
		while (buffer.length >= waitNext) {
			// console.log('=> %s %s %s', reader.name, waitNext, buffer.length);
			reader();
		}
		// console.log(' : %s %s %s', reader.name, waitNext, buffer.length);
		done();
	};

	function plexedReadable(id, name) {
		var buffer = [];
		var readable = new stream.Readable({
			objectMode: false
		});
		readable._read = function (size) {
			/*console.log('plexedReadable _read %s %s', name, buffer.length);
			 while (buffer.length > 0) {
			 if (!readable.push(buffer.shift())) {
			 break;
			 }
			 }*/
		};
		readable.append = function (chunk) {
			/*console.log('plexedReadable append %s %s', name, chunk.length);
			 buffer.push(chunk);
			 // trigger
			 readable.push('');*/
			readable.push(chunk);
		};
		readable.on('end', function () {
			// vconsole.log('plexedReadable end %s', name);
		});
		readable.on('close', function () {
			// console.log('plexedReadable close %s', name);
		});
		readable.on('error', function (err) {
			console.log('plexedReadable error %s', name);
			console.log(err);
		});
		return readable;
	}

	return writable;
}

module.exports = {
	sender: senderPlex,
	receiver: receiverPlex
};

