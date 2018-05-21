#!/bin/bash

set -e

grunt

mocha --recursive

npm publish
