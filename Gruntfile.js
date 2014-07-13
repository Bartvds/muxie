module.exports = function (grunt) {
	'use strict';

	require('source-map-support').install();

	grunt.loadNpmTasks('grunt-mocha-test');
	grunt.loadNpmTasks('grunt-contrib-jshint');
	grunt.loadNpmTasks('grunt-contrib-clean');

	grunt.initConfig({
		pkg: grunt.file.readJSON('package.json'),
		jshint: {
			options: grunt.util._.extend(grunt.file.readJSON('.jshintrc'), {
				reporter: './node_modules/jshint-path-reporter'
			}),
			support: {
				src: ['Gruntfile.js']
			},
			src: {
				src: ['lib/**/*.js']
			},
			test: {
				src: ['test/**/*.js']
			}
		},
		clean: {
			cruft: [
				'tscommand-*.tmp.txt',
				'dist/.baseDir*',
				'test/tmp/.baseDir*',
				'test/src/.baseDir*'
			],
			test: [
				'test/tmp/**/*'
			]
		},
		mochaTest: {
			options: {
				reporter: 'mocha-unfunk-reporter',
				timeout: 8000
			},
			all: {
				src: 'test/*.test.js'
			}
		}
	});

	grunt.registerTask('prep', [
		'clean',
		'jshint:support',
		'jshint:src',
	]);

	grunt.registerTask('build', [
		'prep'
	]);

	grunt.registerTask('test', [
		'build',
		'mochaTest:all'
	]);

	grunt.registerTask('prepublish', [
		'build',
		'clean:test'
	]);

	grunt.registerTask('default', ['build']);
};
