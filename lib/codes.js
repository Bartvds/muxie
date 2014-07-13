'use strict';

/* jshint -W098 */
/* jshint -W003 */

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

module.exports = {
	STREAM_CREATE: getCode('STREAM_CREATE'),
	STREAM_FINISH: getCode('STREAM_FINISH'),
	STREAM_ERROR: getCode('STREAM_ERROR'),
	STREAM_FIRST: codes.length,
	MAX_STREAMS: Math.pow(2, 8),
	getName: getCodeName
};
