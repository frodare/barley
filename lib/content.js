/*
 * Filesytem Based Barley Content
 */

var fs = require('fs');
var Deferred = require("JQDeferred");

module.exports = function(root) {
	'use strict';

	console.log('starting upt content on: ' + root);


	/*
	 * the blog catalog, a complete itemized list of articles
	 * and meta information
	 */
	var catalog = {
		/*
		 * map of all the articles
		 */
		articles: {},
		/*
		 * sorted array of all article names
		 */
		articleOrder: []
	};

	/*
	 * filesystem calls wrapped in Deferreds
	 */
	/*
	function stat(path) {
		var dfd = new Deferred();
		fs.stat(path, function(err, stats) {
			if (err) {
				dfd.reject(err);
			} else {
				dfd.resolve(stats);
			}
		});
		return dfd;
	}


	function readdir(path) {
		var dfd = new Deferred();
		fs.readdir(path, function(err, files) {
			if (err) {
				dfd.reject(err);
			} else {
				dfd.resolve(files);
			}
		});
		return dfd;
	}


	function readFile(path) {
		var dfd = new Deferred();
		fs.readFile(path, function(err, files) {
			if (err) {
				dfd.reject(err);
			} else {
				dfd.resolve(files);
			}
		});
		return dfd;
	}
	 */

	function fsDfd(command) {
		var dfd = new Deferred();
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



	/*
	 * set the root
	 */
	var init = function(root) {
		//console.log('content read');
	};


	/*
	 * read the meta data (key/value headers) from the top of the article file
	 */

	function processMetaData(file) {
		var meta = {};
		while (true) {
			var match = file.match(/^([a-z]+):\s*(.*)\s*\n/i);
			if(!match){
				break;
			}
			meta[match[1].toLowerCase()] =  match[2];
			file = file.substr(match[0].length);
		}
		return meta;
	}


	function processArticle(filename) {

		console.log('loading : ' + filename);



		return fsDfd('readFile', root + '/articles/' + filename).pipe(function(file) {
			
			/*
			 * convert buffer to string
			 */
			if (typeof file !== 'string') {
				file = file.toString();
			}

			var article = {};


			article.name = filename.replace(/\.markdown$/, '');
			article.meta = processMetaData(file);
			catalog.articles[article.name] = article;

			console.log(article.name + 'complete');

			//console.log(catalog);

			//return article;

		});


	}

	/*
	 * update the catalog
	 */
	var read = function() {

		var aDfd = [];

		/*
		 * read article files
		 */
		aDfd.push(fsDfd('readdir', root + '/articles').done(function(files) {
			var i;
			var l = files.length;


			for (i = 0; i < l; i++) {

				if (/\.markdown$/.test(files[i])) {
					aDfd.push(processArticle(files[i]));
				}

			}

			console.log(aDfd);
		}));

		/*
		 * read author files
		 */

		console.log(aDfd);

		Deferred.when.apply(null, aDfd).done(function () {
			console.log('Content Read Complete');
			console.log(catalog);
		});
	};



	read();

	return catalog;

};