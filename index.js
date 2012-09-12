/*
Copyright (c) 2012 Charles Howard <frodare@gmail.com>

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
*/



var url = require('url');
var renderers = require('./lib/renderers');
var content = require('./lib/content');
var routes = [];
var Git = require('git-fs');


module.exports = function(root, options) {
	'use strict';


	console.log('launching Barley! ROOT[' + root + ']');

	content(root);

	function addRoute(regex, renderer) {
		routes.push({
			regex: regex,
			renderer: renderer
		});
	}

	function handleRoute(req, res, next, rendererName, match) {
		console.log('render name: ' + rendererName);
		var dfd = renderers[rendererName]();

		dfd.done(function(err, data) {
			if (err) {
				console.log('renderer ' + rendererName + ' error: ' + err);
				return err.errno === process.ENOENT ? next() : next(err);
			}
			res.writeHead(200, data.headers);
			res.end(data.buffer);
		});
	}

	function determineRoute(req) {
		var u = url.parse(req.url);
		var l = routes.length;
		var i;

		for (i = 0; i < l; i++) {
			var route = routes[i];
			var match = u.pathname.match(route.regex);

			if (match) {
				match = Array.prototype.slice.call(match, 1);
				match.unshift('fs');
				return {
					match: match,
					name: route.renderer
				};
			}
		}
	}


	/*
	 * init work
	 */
	var foo = new Git(root);

	/*
	 * setup routes
	 */
	addRoute(/^\/$/, 'index');
	addRoute(/^\/feed.xml$/, 'feed');
	addRoute(/^\/([a-z0-9_\-]+)$/, 'article');
	addRoute(/^\/category\/([\%\.a-z0-9_\-]+)$/, 'categoryIndex');

	/*
	 * return the middleware handle function
	 */
	return function(req, res, next) {
		var routeData = determineRoute(req);
		if (routeData) {
			return handleRoute(req, res, next, routeData.name, routeData.match);
		} else {
			next();
		}
	};

};