# mplex

[![Build Status](https://secure.travis-ci.org/Bartvds/mplex.svg?branch=master)](http://travis-ci.org/Bartvds/mplex) [![NPM version](https://badge.fury.io/js/mplex.svg)](http://badge.fury.io/js/mplex) [![Dependency Status](https://david-dm.org/Bartvds/mplex.svg)](https://david-dm.org/Bartvds/mplex) [![devDependency Status](https://david-dm.org/Bartvds/mplex/dev-status.svg)](https://david-dm.org/Bartvds/mplex#info=devDependencies)

> Multiplex multiple binary streams over a single carrier.

Simple uni-directional stream multiplexer: send streams over a stream. Handy for inter-process streams.

:warning: Early release, handle with care :sunglasses:

## Note

- Currently there is an upper limit of 255 active streams
- To send objects use JSON streams for simple objects, [Buffo](https://github.com/Bartvds/buffo) to stream all native JavaScript types, or any other object encoder of your choice.


## Alternatives

I've used [multiplex](https://www.npmjs.org/package/multiplex) for some time, but had some weird decoding issues. Then the recursive decoding broke my stack when streaming large amounts of very small chunks. I could't find how to fix this in the more complex logic and it's dependencies. I created mplex to mirror the same API but with a simpler (naïve?) implementation.


## Todo

- Check more edge-cases
- Figure-out backpressure


## Install

````bash
$ npm install mplex
````

## Usage

````js
var mplex = require('mplex');

// create a demuxer that will receive new streams
var demux = mplex.demuxer(function (stream, name) {
	stream.on('data', function(err) {
		//
	});
});

// create muxer
var mux = mplex.muxer();

// create a named stream
var stream = mux.create('myName');

// pipe data to the stream,
fs.createReadStream('test/fixtures/lorem.txt').pipe(stream);

````

## Build

Install development dependencies in your git checkout:

````bash
$ npm install
````

Build and run tests using [grunt](http://gruntjs.com):

````bash
$ grunt test
````

See the `Gruntfile.js` for additional commands.


## Contributions

They are welcome but please discuss in [the issues](https://github.com/Bartvds/mplex/issues) before you commit to large changes. If you send a PR make sure you code is idiomatic and linted.


## History

- 0.0.x - Dev releases.


## License

Copyright (c) 2014 Bart van der Schoor @ [Bartvds](https://github.com/Bartvds)

Licensed under the MIT license.
