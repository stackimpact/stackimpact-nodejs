'use strict';

module.exports = function(grunt) {
  grunt.initConfig({
    pkg: grunt.file.readJSON('package.json'),
    jshint: {
      files: ['Gruntfile.js', 'lib/**/*.js'],
      options: {
        node: true,
        esversion: 6,
        globalstrict: true,
        '-W069': true,
        '-W082': true
      }
    }
  });

  grunt.loadNpmTasks('grunt-contrib-jshint');

  grunt.registerTask('default', [
      'jshint'
    ]);
};

