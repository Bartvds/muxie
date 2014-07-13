'use strict';

/* jshint -W098 */
/* jshint -W089 */

var fs = require('fs');
var path = require('path');
var stream = require('stream');
var through2 = require('through2');
var streamToBuffer = require('stream-to-buffer');

var mplex = require('../lib/index');

var chai = require('chai');
var assert = chai.assert;

function log(label) {
	return through2(function (chunk, enc, done) {
		console.log('| %s - %s', label, chunk.length, chunk);
		this.push(chunk);
		done();
	});
}

function chunky(size, delay) {
	delay = delay || 0;
	return through2(function (chunk, enc, done) {
		var self = this;
		var from = 0;
		var send = function () {
			var to = from + size;
			self.push(chunk.slice(from, to));
			if (to < chunk.length) {
				from = to;
				step();
			}
			else {
				done();
			}
		};
		var step = delay === 0 ? function () {
			setTimeout(send, delay);
		} : function () {
			process.nextTick(send);
		};
		step();
	});
}

function blockgen(size, amount) {
	amount = amount || 1;
	var readable = new stream.Readable();
	readable._read = function () {
		this.push(new Buffer(size));
		amount--;
		if (amount <= 0) {
			this.push(null);
		}
	};
	return readable;
}

function errorAfter(message, amount) {
	return through2(function (chunk, enc, done) {
		this.push(chunk);
		amount -= chunk.length;
		/*if (amount <= 0) {
			console.log('push error');
			this.emit('error', new Error(message));
		}*/
		done();
	});
}

describe('basics', function () {

	var sources = {
		bacon: fs.readFileSync('test/fixtures/bacon.txt'),
		hipster: fs.readFileSync('test/fixtures/hipster.txt'),
		lorem: fs.readFileSync('test/fixtures/lorem.txt')
	};

	it('creates named substream', function (done) {
		var mux = mplex.muxer();
		var demux = mplex.demuxer(function (stream, name) {
			assert.isObject(stream, 'lorem');
			assert.strictEqual(name, 'lorem');
			done();
		});
		//mux.pipe(log('lr')).pipe(demux);
		mux.pipe(chunky(2)).pipe(demux);
		mux.create('lorem');
	});

	it('streams single stream', function (done) {
		var mux = mplex.muxer();

		var demux = mplex.demuxer(function (stream, id) {
			assert.isObject(stream, 'lorem');
			assert.strictEqual(id, 'lorem');

			streamToBuffer(stream, function (err, buffer) {
				assert.isNotObject(err);
				assert.deepEqual(String(buffer), String(sources.lorem));
				done();
			});
		});

		var lorem = mux.create('lorem');

		mux.pipe(chunky(64)).pipe(demux);

		fs.createReadStream('test/fixtures/lorem.txt').pipe(chunky(20)).pipe(lorem);
	});

	it('streams single fat stream', function (done) {
		var mux = mplex.muxer();

		var size = 10 * 1024 * 1024;
		var amount = 10;

		var demux = mplex.demuxer(function (stream, id) {
			assert.isObject(stream, 'blocks');
			assert.strictEqual(id, 'blocks');

			streamToBuffer(stream, function (err, buffer) {
				assert.isNotObject(err);
				assert.lengthOf(buffer, size * amount);
				done();
			});
		});

		var sink = mux.create('blocks');

		mux.pipe(chunky(size / 20)).pipe(demux);

		blockgen(size, amount).pipe(sink);
	});

	it('streams multiple streams', function (done) {
		var mux = mplex.muxer();

		var demux = mplex.demuxer(function (stream, id) {
			assert.isObject(stream, id);

			streamToBuffer(stream, function (err, buffer) {
				assert.isNotObject(err);
				assert.deepEqual(String(buffer), String(sources[id]));

				delete test[id];
				for (var n in test) {
					return;
				}
				done();
			});
		});

		var test = {
			lorem: mux.create('lorem'),
			bacon: mux.create('bacon'),
			hipster: mux.create('hipster')
		};

		mux.pipe(chunky(64)).pipe(demux);

		fs.createReadStream('test/fixtures/lorem.txt').pipe(test.lorem);
		fs.createReadStream('test/fixtures/bacon.txt').pipe(test.bacon);
		fs.createReadStream('test/fixtures/hipster.txt').pipe(test.hipster);
	});

	it('streams multiple mixed streams', function (done) {
		var mux = mplex.muxer();

		var demux = mplex.demuxer(function (stream, id) {
			assert.isObject(stream, id);

			streamToBuffer(stream, function (err, buffer) {
				assert.isNotObject(err);
				assert.deepEqual(String(buffer), String(sources[id]));

				delete test[id];
				for (var n in test) {
					return;
				}
				done();
			});
		});

		var test = {
			lorem: mux.create('lorem'),
			bacon: mux.create('bacon'),
			hipster: mux.create('hipster')
		};

		mux.pipe(chunky(64)).pipe(demux);

		fs.createReadStream('test/fixtures/lorem.txt').pipe(chunky(4, 10)).pipe(test.lorem);
		setTimeout(function () {
			fs.createReadStream('test/fixtures/bacon.txt').pipe(chunky(5, 15)).pipe(test.bacon);
		}, 5);
		setTimeout(function () {
			fs.createReadStream('test/fixtures/hipster.txt').pipe(chunky(4, 5)).pipe(test.hipster);
		}, 10);
	});

	it.skip('notifies on error', function (done) {
		var mux = mplex.muxer();

		var demux = mplex.demuxer(function (stream, id) {
			assert.isObject(stream, id);

			stream.on('error', function(err) {
				assert.isObject(err);
			});
			stream.on('data', function(err) {
				//
			});
		});

		var sink = mux.create('blocks');

		mux.pipe(chunky(30)).pipe(demux);

		blockgen(64, 10).pipe(errorAfter(100)).pipe(sink);
	});
});
