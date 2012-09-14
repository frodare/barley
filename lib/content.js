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

	function processEntry(filename, file, catalog) {
	
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
		var entry = compileHeaders(file);
		var authorName = entry.author;
		if(!entry.category){
			entry.category = 'article';
		}

		/*
		 * set the author data
		 */
		entry.author = catalog.authorIndex[authorName];
		entry.related = catalog.entriesByAuthor[authorName];
		
		/*
		 * push this article onto the articles array
		 */
		entry.name = name;
		catalog.entryIndex[name] = entry;
		catalog.entries.push(entry);

		catalog.entriesByAuthor[authorName].push(entry);

		if(!catalog.entriesByCategory[entry.category]){
			catalog.entriesByCategory[entry.category] = [];
		}
		catalog.entriesByCategory[entry.category].push(entry);

		return entry;
	}

	function processAuthor(filename, file, catalog) {
	
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
		var author = compileHeaders(file);
		
		/*
		 * push this article onto the articles array
		 */
		author.name = name;
		catalog.authorIndex[name] = author;
		catalog.entriesByAuthor[name] = [];
		catalog.authors.push(author);

		return author;
	}

	function readAuthors(catalog) {
		var dfd = jq.Deferred();
		catalog.authors = [];
		catalog.authorIndex = {};
		catalog.entriesByAuthor = {};

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
				 * load the author file
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

	function readEntries(catalog) {
		var dfd = jq.Deferred();

		catalog.entries = [];
		catalog.entryIndex = {};
		catalog.entriesByCategory = {};
		
		/*
		 * read and process all entry files
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
				 * load the entry
				 */
				var entryDfd = readFile(root + '/articles/' + filename);

				/*
				 * process
				 */
				entryDfd.done(function (file) {
					processEntry(filename, file, catalog);
				});


				aDfd.push(entryDfd);
			});

			/*
			 * wait for all entries to process
			 */
			jq.when.apply(null, aDfd).done(function() {
				dfd.resolve();
			}).fail(function() {
				dfd.reject();
			});
		});

		/*
		 * Sort Entries:
		 */
		dfd.done(function() {
			catalog.entries.sort(function dateSorter(a, b) {
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
		return jq.when(readFile('description.markdown'),readAuthors(catalog)).pipe(function (description) {
			catalog.description = description;
			/*
			 * then build the entries
			 */
			return readEntries(catalog);
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