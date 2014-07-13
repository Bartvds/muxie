'use strict';

/* jshint -W003 */

var stream = require('stream');
var BufferList = require('bl');

var codes = require('./codes');

function demuxer(handler) {
	var buffer = new BufferList();

	var writable = new stream.Writable({
		objectMode: false
	});

	var activeId = 0;
	var activeNeed = 0;
	var waitNext = 1;

	// using new Array to keep array dense
	var streams = new Array(codes.STREAM_FIRST);
	var names = new Array(codes.STREAM_FIRST);

	function createStream(id, name) {
		var stream = plexedReadable(id, name);
		streams[id] = stream;
		names[id] = name;
		handler(stream, name);
	}

	function closeStream(id) {
		var stream = streams[id];
		stream.push(null);
		names[id] = null;
		stream[id] = null;
	}

	var reader = readHeader;

	function readHeader() {
		var code = buffer.readUInt8(0);
		buffer.consume(1);
		// console.log(codes.getName(code));

		if (code < codes.STREAM_FIRST) {
			switch (code) {
				case codes.STREAM_CREATE:
					reader = readCreateStreamHead;
					waitNext = 2;
					return;
				case codes.STREAM_FINISH:
					reader = readFinishStream;
					waitNext = 1;
					return;
				case codes.STREAM_ERROR:
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
		streams[activeId].push(chunk);
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
		var readable = new stream.Readable({
			objectMode: false
		});
		readable._read = function () {
			// dummy
		};
		readable.on('end', function () {
			// console.log('plexedReadable end %s', name);
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

module.exports = demuxer;
