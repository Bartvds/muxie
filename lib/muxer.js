'use strict';

var stream = require('stream');

var codes = require('./codes');

function muxer() {
	var buffer = [];

	var idMap = Object.create(null);
	var streamMap = Object.create(null);

	var freeIds = [];
	for (var i = codes.STREAM_FIRST; i < codes.MAX_STREAMS; i++) {
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
			if (sent > size) {
				break;
			}
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
		head.writeUInt8(codes.STREAM_CREATE, 0);
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
			sendCodeTo(id, codes.STREAM_FINISH);
			cleanupStream(name);
		});
		writable.on('error', function (err) {
			console.log('plexedWritable error %s %s', name, id);
			console.log(err);
			sendCodeTo(id, codes.STREAM_ERROR);
			cleanupStream(name);
		});
		return writable;
	}

	return readable;
}

module.exports = muxer;
