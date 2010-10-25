node-psi-server README
======================

This document provides a short description of
[node-psi-server](http://github.com/jansc/node-psi-server/).
`node-psi-server` is a Topic Maps application.

Dependencies
------------

Make sure that you've installed these two applications on your machine:
 - [node.js](http://nodejs.org) - The NodeJS engine
 - [Connect](http://github.com/senchalabs/connect) -  Middleware for NodeJS.

The following external libraries have been included in the node-psi-server
package:
 - [tmjs](http://github.com/jansc/tmjs) - an Open Source Topic Maps engine.
 - [Mu](http://github.com/raycmorgan/Mu) - an asynchroneous template engine
   based on mustache.js.
 - [opts.js](http://bitbucket.org/mazzarell/js-opts/opts.js) - a command
   line options parser.


Examples
--------

You can use the Opera topic map from the examples catalog for testing.
To see which PSIs are included, run the following command:

  node server.js --list examples/opera.jtm psi.ontopia.net


To start the web server run

  node server.js --config ./config-sample.jtm examples/opera.jtm psi.ontopia.net 
 
 * config-sample.jtm is the configuration file,
 * examples/opera.jtm is the topic map that you want to serve PSIs for
 * psi.ontopia.net is the server name

Now you should be able to open e.g. http://localhost:8000/person or 
"http://localhost:8000/city/380-firenze" in your web browser.


Limitations
-----------

Besides all bugs, node-psi-server has two main limitations:

1. No support of PSIs with anchor.
2. Only topic maps in JTM format are supported. 

Detailed explanations:

'#' in PSIs is not supported. This is because the anchor part is not sent to
the server. If you e.g. enter 

  http://psi.example.com/foo#bar

the requested URL on the server is

  http://psi.example.com/foo

The is could be solved by creating a special index for all PSIs containing
a # symbol, but currently this feature is not implemented.

Due to a limitation in tmjs, only JTM topic maps can be imported. However,
you can use [mappify.org](http://ws.mappify.org) to convert any topic map
to JTM. [Maiana](http://maiana.topicmaplab.de) and
[Ontopia](http://ontopia.net) also support export of topic maps in JTM.

