// node-psi-server, version 0.0.1
// http://github.com/jansc/node-psi-server
// Copyright (c) 2010 Jan Schreiber <jans@ravn.no>
// Licensed under the MIT-License.
//
// Permission is hereby granted, free of charge, to any person
// obtaining a copy of this software and associated documentation
// files (the "Software"), to deal in the Software without
// restriction, including without limitation the rights to use,
// copy, modify, merge, publish, distribute, sublicense, and/or sell
// copies of the Software, and to permit persons to whom the
// Software is furnished to do so, subject to the following
// conditions:
//
// The above copyright notice and this permission notice shall be
// included in all copies or substantial portions of the Software.
//
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND,
// EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES
// OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND
// NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT
// HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY,
// WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING
// FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR
// OTHER DEALINGS IN THE SOFTWARE.

/*jslint browser: true, devel: true, onevar: true, undef: true,
  nomen: false, eqeqeq: true, plusplus: true, bitwise: true, regexp: true,
    newcap: true, immed: true, indent: 4 */
/*global require, __dirname*/

(function () {
    var util = require('util'),
        tmjs = require('./vendor/tm'),
        fs = require('fs'),
        opts = require('./vendor/opts'),
        Connect = require('connect'),
        Mu = require('./vendor/mu'),
        url = require('url'),
        tools = require('./lib/tools'),
        exportIdentifiers,
        tm, // The main topic map object
        options,
        cmdArguments,
        debug, // debug command line option, boolean
        tmFile, // Topic map file command line argument
        //logFile, // Log file command line option
        logStream, // Log file stream
        servername, // default host value
        showList, // boolean. true if command line option for listing all PSIs is set
        showJTM, // function that exports information about the referred topic to
        showHTML, // function that exports information about the referred topic to
        startTimestamp = new Date(), // Date/time when the server started. Used for benchmarking.
        configTM, // The configuration topic map    
        config = {}, // Object containing configuration
        server, // Connect server object
        data, // Temporary variable to hold the topic map
        tmData,
        reader,
        i,
        j,
        topics,
        psis,
        sis,
        parsedIri,
        exportTypes;

    options = [
        { short       : 'c',
            long        : 'config',
            description : 'Filename of the configuration file.',
            value       : true
        },
        { short       : 'l',
            long        : 'logfile',
            description : 'Path and filename to a log file. Must be writable by this process. Defaults to stdout.'
        },
        { short       : 'd',
            long        : 'debug',
            description : 'Sets a debug level. Valid values are \'info\', \'debug\'.',
            value       : true
        },
        { short       : 'p',
            long        : 'port',
            description : 'The port for the web server. The default is 8000'
        },
        { long        : 'list',
            description : 'Lists all PSIs that belong to "servername" and exits',
            value       : false
        },
        {
            long        : 'dc-created',
            description : 'Default create date for PSIs in ISO format (YYYY-MM-DD)',
            value       : true
        },
        {
            long        : 'dc-publisher',
            description : 'Default publisher name for all PSIs',
            value       : true
        },
        {
            long        : 'psi-status',
            description : 'Default publishing status for all PSIs',
            value       : true
        }
    ];

    cmdArguments = [ { name: 'tm', required: true },
        { name: 'servername', required: true } ];
    opts.parse(options, cmdArguments, true);

    servername = config.servername || opts.arg('servername');
    debug = opts.get('d') || 'info';  // default debug value
    tmFile = opts.arg('tm');
    showList = opts.get('list') || false;
    Mu.templateRoot = './templates';

    // Exports a topic as a JTM topic map
    showJTM = function (res, iri, topic, options) {
        var exporttm, writer;
        exporttm = tools.exportTopic(topic.getParent(), topic, options.exportTypes); 
        writer = new tmjs.TM.JTM.Writer(exporttm);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.write(JSON.stringify(writer.toObject(exporttm)));
        res.end();
        exporttm.remove();
    };

    showHTML = function (res, iri, topic, options) {
        var ctx, type, occs, roles, rolesPlayed, roleTextArr, i,
            j, assoc;
        // TODO: Right now creation-date, publisher and status are hard-coded.
        // They can be set with command line parameters for topic maps
        // that don't have corresponding occurrences, but we're missing
        // some code that tries to fetch these occurrences.

        // Also: showJTM creates a topic map with all occurrences and
        // associations from the configuration topic map. We have to do the
        // same here.

        ctx = {
            psi: iri,
            pathname: options.parsedIri.pathname,
            fields: [
                {label: 'Created', value: config.createdFallback},
                {label: 'Status', value: config.psiStatusFallback}
            ],
            timestamp: function () {
                return (((new Date() - startTimestamp) / 1000) + "secs");
            }
        };
        if (config.publisherFallback) {
            ctx.fields.push({label: 'Publisher', value: opts.get('dc-publisher')});
        }

        // Go through all occurrence and association types that we want to export
        if (options.exportTypes) {
            for (type in options.exportTypes) {
                if (options.exportTypes.hasOwnProperty(type)) {
                    occs = topic.getOccurrences(options.exportTypes[type]);
                    for (j = 0; j < occs.length; j += 1) {
                        ctx.fields.push({label: tools.getTopicLabel(type).label,
                                        value: occs[j].getValue()});
                    }
                }
            }

            // Not the most performant way. Refactor!
            for (type in options.exportTypes) {
                if (options.exportTypes.hasOwnProperty(type)) {
                    rolesPlayed = topic.getRolesPlayed();
                    for (i = 0; i < rolesPlayed.length; i += 1) {
                        assoc = rolesPlayed[i].getParent();
                        if (assoc.getType().equals(options.exportTypes[type])) {
                            roles = assoc.getRoles();
                            // Textual representation of all roles exept the one that topic plays
                            roleTextArr = []; 
                            for (j = 0; j < roles.length; j += 1) {
                                if (!roles[j].equals(rolesPlayed[i])) {
                                    roleTextArr.push(
                                        tools.getTopicLabel(roles[j].getPlayer(),
                                                            {anchor: true}).label + ' (' +
                                        tools.getTopicLabel(roles[j].getType(),
                                                            {anchor: true}).label + ')');
                                }
                            }
                            if (roleTextArr.length > 0) {
                                ctx.fields.push({label: tools.getTopicLabel(assoc.getType(),
                                                                            {anchor: true}).label,
                                                value: roleTextArr.join(', ')});
                            }
                        }
                    }
                }
            }
        }
        ctx.name = tools.getTopicLabel(topic).label;
        res.writeHead(200, { 'Content-Type': 'text/html' });
        Mu.render('psi.html', ctx, {}, function (err, output) {
            if (err) {
                throw err;
            }
            output.addListener('data', function (c) {
                res.write(c);
            }).addListener('end', function () { res.end();
                                            });
        });
    };


    tm = tools.getTopicMap('http://semanticheadache.com/node-psi-server');
    configTM = tools.getTopicMap('http://semanticheadache.com/node-psi-server-config');
    exportIdentifiers = tools.parseConfigTM(configTM, opts, options);
    config.port = config.port || opts.get('p') || '8000';
    config.logFile = config.logFile || opts.get('l') || null;
    config.publisherFallback = config.publisherFallback || opts.get('dc-publisher');
    config.psiStatusFallback = config.psiStatusFallback || opts.get('psi-status') || 'Experimental';
    config.createdFallback = config.createdFallback || opts.get('dc-created') || new Date().toUTCString();
    config.debugLevel = config.debugLevel || opts.get('d') || 'info';
    logStream = null;
    //logStream = fs.open(config.logFile);

    // TODO: stat to check if tmFile exists
    // Use stat's date as default creation date
    data = fs.readFileSync(tmFile);
    tmData = JSON.parse(data);

    reader = new tmjs.TM.JTM.Reader(tm);
    reader.fromObject(tmData);

    util.log("Imported tm in " + ((new Date() - startTimestamp) / 1000) +
             "secs");

    exportTypes = tools.prefetchExportTypes(tm, exportIdentifiers);

    if (showList) {
        // Shows a list of all PSIs that match servername
        // TODO: move this to a function in tools.js
        topics = tm.getTopics();
        util.puts('Servername in showList: ' + servername);
        psis = [];
        util.puts('List of PSIs:');
        for (i = 0; i < topics.length; i += 1) {
            sis = topics[i].getSubjectIdentifiers();
            for (j = 0; j < sis.length; j += 1) {
                parsedIri = url.parse(sis[j].getReference(), true);
                if (parsedIri.host === servername) {
                    psis.push(sis[j].getReference());
                }
            }
        }
        psis.sort();
        for (i = 0; i < psis.length; i += 1) {
            util.puts(' * ' + psis[i]);
        }
        return;
    }

    server = Connect.createServer(
        Connect.logger({stream: logStream}),
        Connect.errorHandler({ showStack: true, dumpExceptions: true }),
        Connect.router(function (app) {
            app.get('/*.css', Connect.staticProvider(__dirname + '/static'));
            app.get('/favicon.ico', Connect.staticProvider(__dirname + '/static'));
        }),
        function (req, res) {
            // Incoming request. Check if a topic with the
            // given PSI exists or serve an error page
            var iri, parsedIri, loc, topic, format;
            parsedIri = url.parse(req.url, true);
            iri = 'http://' + servername + parsedIri.pathname;
            startTimestamp = new Date();
            loc = tm.createLocator(iri);
            topic = tm.getTopicBySubjectIdentifier(loc);

            format = 'xhtml';
            if (parsedIri.query && parsedIri.query.format) {
                if (parsedIri.query.format.match(/^(jtm|xhtml)$/)) {
                    format = parsedIri.query.format;
                }
            }

            if (topic) {
                // TODO:
                // * Find supertype(s) and superclass(es)
                // * Find occurrences from the list of occurrences we want to list
                if (format === 'jtm') {
                    showJTM(res, iri, topic, {exportTypes: exportTypes});
                } else {
                    showHTML(res, iri, topic, {parsedIri: parsedIri,
                             exportTypes: exportTypes});
                }
            } else {
                res.writeHead(404, { 'Content-Type': 'text/html' });
                Mu.render('404.html', {psi: iri,
                          timestamp: function () {
                              return (((new Date() - startTimestamp) / 1000) + "secs");
                          }
                }, {}, function (err, output) {
                    if (err) {
                        throw err;
                    }
                    output.addListener('data', function (c) {
                        res.write(c);
                    }).addListener('end', function () { res.end();
                                                    });
                });
                //throw new Error('oh noes!');
            } 
        }
    ).listen(config.port);
    util.log('Server running at http://127.0.0.1:' + config.port + '/');
}());
