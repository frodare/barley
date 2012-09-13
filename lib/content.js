/*
 * Filesytem Based Barley Content
 */

var fs = require('fs');
var jq = require("jquery-deferred");


module.exports = function(root) {
	'use strict';

	function fsDfd(command) {
		var dfd = jq.Deferred();
		var i;
		var args = [];

		for (i = 1; i < arguments.length; i++) {
			args.push(arguments[i]);
		}

		/*
		 * add callback argument
		 */
		args.push(function(err, data) {
			if (err) {
				dfd.reject(err);
			} else {
				dfd.resolve(data);
			}
		});


		fs[command].apply(fs, args);

		return dfd;
	}

	function readFile(filename) {
		return fsDfd('readFile', filename);
	}

	function readdir(dirname) {
		return fsDfd('readdir', dirname);
	}

	function compileHeaders(file){
		var data = {};

		while (true) {
			var match = file.match(/^([a-z]+):\s*(.*)\s*\n/i);
			if (!match) {
				break;
			}
			data[match[1].toLowerCase()] = match[2];
			file = file.substr(match[0].length);
		}

		data.content = file;
		return data;
	}

	function processArticle(filename, file, catalog) {
	
		/*
		 * convert buffer to string
		 */
		if (typeof file !== 'string') {
			file = file.toString();
		}

		/*
		 * compute the name
		 */
		var name = filename.replace(/\.markdown$/, '');
		var article = compileHeaders(file);
		var authorName = article.author;

		/*
		 * set the author data
		 */
		article.author = catalog.authorIndex[authorName];
		article.related = catalog.articlesByAuthor[authorName];
		
		/*
		 * push this article onto the articles array
		 */
		article.name = name;
		catalog.articleIndex[name] = article;
		catalog.articles.push(article);
		catalog.articlesByAuthor[authorName].push(article);

		return article;
	}

	function processAuthor(filename, file, catalog) {
	
		/*
		 * convert buffer to string
		 */
		if (typeof file !== 'string') {
			file = file.toString();
		}

		console.log('process author file: ' + filename);

		/*
		 * compute the name
		 */
		var name = filename.replace(/\.markdown$/, '');
		var author = compileHeaders(file);
		
		/*
		 * push this article onto the articles array
		 */
		author.name = name;
		catalog.authorIndex[name] = author;
		catalog.articlesByAuthor[name] = [];
		catalog.authors.push(author);

		return author;
	}

	function readAuthors(catalog) {
		var dfd = jq.Deferred();
		catalog.authors = [];
		catalog.authorIndex = {};
		catalog.articlesByAuthor = {};

		readdir(root + '/authors').done(function(files) {
			var aDfd = [];

			files.forEach(function(filename) {
				/*
				 * ignore non markdown files
				 */
				if (!(/\.markdown$/.test(filename))) {
					return;
				}

				/*
				 * load the article
				 */
				var authorDfd = readFile(root + '/authors/' + filename);

				/*
				 * process
				 */
				authorDfd.done(function (file) {
					processAuthor(filename, file, catalog);
				});

				aDfd.push(authorDfd);
			});

			jq.when.apply(null, aDfd).done(function() {
				dfd.resolve();
			}).fail(function() {
				dfd.reject();
			});
		});

		return dfd.resolve();
	}

	function readArticles(catalog) {
		var dfd = jq.Deferred();

		catalog.articles = [];
		catalog.articleIndex = {};
		

		/*
		 * read and process all article files
		 */
		readdir(root + '/articles').done(function(files) {
			var aDfd = [];

			files.forEach(function(filename) {
				/*
				 * ignore non markdown files
				 */
				if (!(/\.markdown$/.test(filename))) {
					return;
				}

				/*
				 * load the article
				 */
				var articleDfd = readFile(root + '/articles/' + filename);

				/*
				 * process
				 */
				articleDfd.done(function (file) {
					processArticle(filename, file, catalog);
				});


				aDfd.push(articleDfd);
			});

			/*
			 * wait for all articles to process
			 */
			jq.when.apply(null, aDfd).done(function() {
				dfd.resolve();
			}).fail(function() {
				dfd.reject();
			});
		});

		/*
		 * Sort Articles:
		 * build the articleOrder array
		 */
		dfd.done(function() {
			catalog.articles.sort(function dateSorter(a, b) {
				return (Date.parse(b.date)) - (Date.parse(a.date));
			});
		});


		return dfd;
	}


	/*
	 * update the catalog
	 */
	var read = function() {
		var catalog = {};

		/*
		 * first build the authors
		 */
		return readAuthors(catalog).pipe(function () {
			/*
			 * then build the articles
			 */
			return readArticles(catalog);
		}).pipe(function () {
			/*
			 * finally return the completed catalog
			 */
			return catalog;
		});
	};

	var readCache;
	function get () {
		if(readCache){
			return readCache;
		}
		readCache = read();
		return readCache;
	}

	get();

	return {
		get: get
	};

};