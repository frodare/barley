var Git = require('git-fs'),
	Data = require('./wheat/data'),
	Tools = require('./wheat/tools'),
	Buffer = require('buffer').Buffer,
	Prettify = require('./wheat/prettify'),
	Crypto = require('crypto'),
	ChildProcess = require('child_process'),
	getMime = require('simple-mime')('application/octet-string'),
	Step = require('step'),
	jq = require("jquery-deferred"),
	Haml = require('haml');



// Execute a child process, feed it a buffer and get a new buffer filtered.

function execPipe(command, args, data, callback) {
	var child = ChildProcess.spawn(command, args);
	var stdout = [],
		stderr = [],
		size = 0;
	child.stdout.on('data', function onStdout(buffer) {
		size += buffer.length;
		stdout[stdout.length] = buffer;
	});
	child.stderr.on('data', function onStderr(buffer) {
		stderr[stderr.length] = buffer;
	});
	child.on('error', function onExit(err) {
		callback(err);
	});
	var exitCode;
	child.on('exit', function onExit(code) {
		exitCode = code;
	});
	child.on('close', function() {
		if (exitCode > 0) {
			callback(new Error(stderr.join("")));
		} else {
			var buffer = new Buffer(size);
			var start = 0;
			for (var i = 0, l = stdout.length; i < l; i++) {
				var chunk = stdout[i];
				chunk.copy(buffer, start);
				start += chunk.length;
			}
			callback(null, buffer);
		}
	});
	if (typeof data === 'string') {
		child.stdin.write(data, "binary");
	} else {
		child.stdin.write(data);
	}
	child.stdin.end();
}

// This writes proper headers for caching and conditional gets
// Also gzips content if it's text based and stable.

function postProcess(headers, buffer) {
	'use strict';

	if (!headers["Content-Type"]) {
		headers["Content-Type"] = "text/html; charset=utf-8";
	}

	var date = new Date().toUTCString();
	headers.Date = date;
	headers.Server = "barley, mmmm beer (node.js)";

	/*
	if (version === 'fs') {
		delete headers["Cache-Control"];
	} else {
		var hash = Crypto.createHash('md5');
		hash.update(version + ":" + path + ":" + date);
		headers.ETag = hash.digest('hex');
	}
	 */

	/*
	if (/html/.test(headers["Content-Type"])) {
		buffer = Tools.stringToBuffer((buffer + "").replace(/<pre><code>[^<]+<\/code><\/pre>/g, function applyHighlight(code) {
			code = code.match(/<code>([\s\S]+)<\/code>/)[1];
			code = Prettify.prettyPrintOne(code);
			return "<pre><code>" + code + "</code></pre>";
		}));
	}
	*/
	 

	headers["Content-Length"] = buffer.length;

	return {
		headers: headers,
		buffer: buffer
	};

}

function insertSnippets(markdown, snippets, callback) {
	Step(

	function() {
		Tools.compileTemplate('snippet', this);
	}, function(err, snippetTemplate) {
		if (err) {
			callback(err);
			return;
		}
		snippets.forEach(function(snippet) {
			var html = snippetTemplate({
				snippet: snippet
			});
			markdown = markdown.replace(snippet.original, html);
		});
		return markdown;
	}, callback)
}



/*

// Loads a haml template and caches in memory.
function loadTemplate (name) {
	'use strict';
	var dfd = jq.Deferred();

	Git.safe(function () {
		Git.readFile('fs', "skin/" + name + ".haml", function (err, haml) {
			if (err) {
				dfd.reject(err);
			}else{
				dfd.resolve(Haml(haml + "", (/\.xml$/).test(name));
			}
		});
	});

	return dfd;
}






function render(name, data) {
	'use strict';
	 loadTemplate(version, name, this.parallel());
	 if (!partial) {
		loadTemplate(version, "layout", this.parallel());
	 }
	}, function renderTemplates(err, template, layout) {
	 if (err) {
		callback(err);
		return;
	 }
	 data.__proto__ = Helpers;
	 var content = template(data);
	 if (partial) {
		return stringToBuffer(content);
	 }
	 data = {
		content: content,
		title: data.title || ""
	 };
	 data.__proto__ = Helpers;
	 return stringToBuffer(layout(data));
	}, callback)
}

 */

var Renderers = module.exports = {


	/*
	 * blog index
	 */
	index: function(catalog) {
		'use strict';
		var dfd = jq.Deferred();

		Tools.render("index", {
			entries: catalog.entries,
			articles: catalog.entriesByCategory.article,
			recipes: catalog.entriesByCategory.recipe,
			categories: [],
			description: catalog.description
		}, function(err, buffer) {
			if (err) {
				dfd.reject(err);
			} else {
				var page = postProcess({
					"Cache-Control": "public, max-age=3600"
				}, buffer);

				dfd.resolve(page);
			}

		});

		return dfd;
	},

	
	/*
	 * entry page
	 */
	entry: function(catalog, name) {
		'use strict';
		var dfd = jq.Deferred();

		var entry = catalog.entryIndex[name];

		Tools.render("entry", {
			title: entry.title,
			entry: entry,
			author: entry.author,
			description: catalog.description
		}, function(err, buffer) {
			if (err) {
				dfd.reject(err);
			} else {
				var page = postProcess({
					"Cache-Control": "public, max-age=3600"
				}, buffer);

				dfd.resolve(page);
			}

		});

		return dfd;
	},





	feed: Git.safe(function feed(version, callback) {
		var articles;
		Step(

		function loadData() {
			Data.fullArticles(version, this);
		}, function(err, data) {
			if (err) {
				callback(err);
				return;
			}
			articles = data;
			var group = this.group();
			articles.forEach(function(article) {
				insertSnippets(article.markdown, article.snippets, group());
			});
		}, function applyTemplate(err, markdowns) {
			if (err) {
				callback(err);
				return;
			}
			markdowns.forEach(function(markdown, i) {
				articles[i].markdown = markdown;
			});
			Tools.render("feed.xml", {
				articles: articles
			}, this, true);
		}, function finish(err, buffer) {
			if (err) {
				callback(err);
				return;
			}
			postProcess({
				"Content-Type": "application/rss+xml",
				"Cache-Control": "public, max-age=3600"
			}, buffer, version, "feed.xml", this);
		}, callback);
	}),




	categoryIndex: Git.safe(function index(version, category, callback) {
		Step(

		function getHead() {
			Git.getHead(this);
		}, function loadData(err, head) {
			if (err) {
				callback(err);
				return;
			}
			Data.articles(version, this.parallel());
			Git.readFile(head, "description.markdown", this.parallel());
			Data.categories(version, this.parallel());
		}, function applyTemplate(err, articles, description, categories) {
			if (err) {
				callback(err);
				return;
			}

			var articlesForCategory = articles.reduce(function(start, element) {
				return element.categories && element.categories.indexOf(category) >= 0 ? start.concat(element) : start;
			}, []);

			Tools.render("index", {
				articles: articlesForCategory,
				description: description,
				categories: categories
			}, this);
		}, function callPostProcess(err, buffer) {
			if (err) {
				callback(err);
				return;
			}
			postProcess({
				"Cache-Control": "public, max-age=3600"
			}, buffer, version, "index", this);
		}, callback);
	}),

	staticFile: Git.safe(function staticFile(version, path, callback) {
		Step(

		function loadPublicFiles() {
			Git.readFile(version, "skin/public/" + path, this);
		}, function loadArticleFiles(err, data) {
			if (err) {
				Git.readFile(version, "articles/" + path, this);
			}
			return data;
		}, function processFile(err, data) {
			if (err) {
				callback(err);
				return;
			}
			var headers = {
				"Content-Type": getMime(path),
				"Cache-Control": "public, max-age=32000000"
			};
			postProcess(headers, data, version, path, this);
		}, callback);
	}),

	dotFile: Git.safe(function dotFile(version, path, callback) {
		Step(

		function loadPublicFiles() {
			Git.readFile(version, "skin/public/" + path, this);
		}, function loadArticleFiles(err, data) {
			if (err) {
				Git.readFile(version, "articles/" + path, this);
			}
			return data;
		}, function processFile(err, data) {
			if (err) {
				callback(err);
				return;
			}
			execPipe("dot", ["-Tpng"], data, this);
		}, function finish(err, buffer) {
			if (err) {
				callback(err);
				return;
			}
			postProcess({
				"Content-Type": "image/png",
				"Cache-Control": "public, max-age=32000000"
			}, buffer, version, path, this);
		}, callback);
	})
}