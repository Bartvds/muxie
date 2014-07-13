'use strict';

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

describe('basics', function () {

	var sources = {
		bacon: fs.readFileSync('test/fixtures/bacon.txt'),
		hipster: fs.readFileSync('test/fixtures/hipster.txt'),
		lorem: fs.readFileSync('test/fixtures/lorem.txt')
	};

	it('creates named substream', function (done) {
		var left = mplex.sender();
		var right = mplex.receiver(function (stream, name) {
			assert.isObject(stream, 'lorem');
			assert.strictEqual(name, 'lorem');
			done();
		});
		//left.pipe(log('lr')).pipe(right);
		left.pipe(chunky(2)).pipe(right);
		left.create('lorem');
	});

	it('streams single stream', function (done) {
		var left = mplex.sender();

		var right = mplex.receiver(function (stream, id) {
			assert.isObject(stream, 'lorem');
			assert.strictEqual(id, 'lorem');

			streamToBuffer(stream, function (err, buffer) {
				assert.isNotObject(err);
				assert.deepEqual(String(buffer), String(sources.lorem));
				done();
			});
		});

		var lorem = left.create('lorem');

		left.pipe(chunky(64)).pipe(right);

		fs.createReadStream('test/fixtures/lorem.txt').pipe(chunky(20)).pipe(lorem);
	});

	it('streams single fat stream', function (done) {
		var left = mplex.sender();

		var size = 10 * 1024 * 1024;
		var amount = 10;

		var right = mplex.receiver(function (stream, id) {
			assert.isObject(stream, 'blocks');
			assert.strictEqual(id, 'blocks');

			streamToBuffer(stream, function (err, buffer) {
				assert.isNotObject(err);
				assert.lengthOf(buffer, size * amount);
				done();
			});
		});

		var sink = left.create('blocks');

		left.pipe(chunky(size / 20)).pipe(right);

		blockgen(size, amount).pipe(sink);
	});

	it('streams multiple streams', function (done) {
		var left = mplex.sender();

		var right = mplex.receiver(function (stream, id) {
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
			lorem: left.create('lorem'),
			bacon: left.create('bacon'),
			hipster: left.create('hipster')
		};

		left.pipe(chunky(64)).pipe(right);

		fs.createReadStream('test/fixtures/lorem.txt').pipe(test.lorem);
		fs.createReadStream('test/fixtures/bacon.txt').pipe(test.bacon);
		fs.createReadStream('test/fixtures/hipster.txt').pipe(test.hipster);
	});

	it('streams multiple mixed streams', function (done) {
		var left = mplex.sender();

		var right = mplex.receiver(function (stream, id) {
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
			lorem: left.create('lorem'),
			bacon: left.create('bacon'),
			hipster: left.create('hipster')
		};

		left.pipe(chunky(64)).pipe(right);

		fs.createReadStream('test/fixtures/lorem.txt').pipe(chunky(4, 10)).pipe(test.lorem);
		setTimeout(function () {
			fs.createReadStream('test/fixtures/bacon.txt').pipe(chunky(5, 15)).pipe(test.bacon);
		}, 5)
		setTimeout(function () {
			fs.createReadStream('test/fixtures/hipster.txt').pipe(chunky(4, 5)).pipe(test.hipster);
		}, 10)
	});
});
