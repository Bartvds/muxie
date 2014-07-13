# muxie

[![Build Status](https://secure.travis-ci.org/Bartvds/muxie.svg?branch=master)](http://travis-ci.org/Bartvds/muxie) [![NPM version](https://badge.fury.io/js/muxie.svg)](http://badge.fury.io/js/muxie) [![Dependency Status](https://david-dm.org/Bartvds/muxie.svg)](https://david-dm.org/Bartvds/muxie) [![devDependency Status](https://david-dm.org/Bartvds/muxie/dev-status.svg)](https://david-dm.org/Bartvds/muxie#info=devDependencies)

> Simple directional stream multiplexer: send multiple streams over a single carrier.

Setup the muxer and pipe it to the demuxer.

Then get multiple named writable streams from the muxer, pipe data into them and the demuxer receives the named readable streams that will emit the data.

:warning: Early release, handle with care :sunglasses:

## Note

- Currently there is an upper limit of 255 active streams.
- To send objects use JSON streams for simple objects, [Buffo](https://github.com/Bartvds/buffo) to stream all native JavaScript types, or any other object encoder of your choice.


## Alternatives

I've used [multiplex](https://www.npmjs.org/package/multiplex) for some time, but had some weird decoding issues. Besides some null bytes errors the recursive decoding broke my stack when streaming large amounts of very small chunks. I couldn't find how to fix this in the more complex logic and it's dependencies.

Since I don't need duplex functionality I created muxie to mirror the same API but with a simpler (naïve?) implementation.


## Todo

- Check more edge-cases
- Figure-out backpressure


## Install

````bash
$ npm install muxie
````

## Usage

````js
var muxie = require('muxie');

// create a demuxer that will receive new streams
var demux = muxie.demuxer(function (stream, name) {
	// received a new readable stream
	// ..
});

// create muxer
var mux = muxie.muxer();

// create a named writable stream
var stream = mux.create('myStream');

// pipe data to the stream
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

They are welcome but please discuss in [the issues](https://github.com/Bartvds/muxie/issues) before you commit to large changes. If you send a PR make sure you code is idiomatic and linted.


## History

- 0.0.x - Dev releases.


## License

Copyright (c) 2014 Bart van der Schoor @ [Bartvds](https://github.com/Bartvds)

Licensed under the MIT license.
