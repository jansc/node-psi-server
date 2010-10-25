// node-psi-server, version 0.0.1
// http://github.com/jansc/node-psi-server
// Copyright (c) 2010 Jan Schreiber <jans@ravn.no>
// Licensed under the MIT-License.

/*jslint browser: true, devel: true, onevar: true, undef: true,
  nomen: false, eqeqeq: true, plusplus: true, bitwise: true, regexp: true,
    newcap: true, immed: true, indent: 4 */
/*global exports, require, startTimestamp*/

var util = require('util'),
    tmjs = require('../vendor/tm'),
    fs = require('fs'),
    defaultNameType = null,
    exporttmid = 0, // id of the exported json topic map
    configPrefix = 'http://psi.semanticheadache.com/node-psi-server/',
    configLocators = {
        CONFIGURATION_VALUE: configPrefix + 'configuration-value',
        LOGFILE: configPrefix + 'logfile',
        PORT: configPrefix + 'port',
        ROLE_TYPE: configPrefix + 'type',
        TYPE_IS_PUBLISHED: configPrefix + 'type-is-published',
        PUBLISHER_FALLBACK: configPrefix + 'publisher-fallback',
        PSI_STATUS_FALLBACK: configPrefix + 'psi-status',
        CREATED_FALLBACK: configPrefix + 'created-fallback',
        DEBUG_LEVEL: configPrefix + 'debug-level'
    };

exports.getTopicMap = function (iri) {
    var factory, tmsys, tmid;
    // Create a topic map and import the topic map file.
    factory = tmjs.TM.TopicMapSystemFactory.newInstance();
    factory.setProperty('com.semanticheadache.tmjs.backend', 'memory');
    tmsys = factory.newTopicMapSystem();
    tmid = tmsys.createLocator(iri);
    return tmsys.createTopicMap(tmid);
};


// Copies an source_occ to target_topic. If types or scoping topics
// don't exist in taret_topic's topic map, stubs for there topics are
// copied as well.
exports.copyOccurrence = function (sourceOcc, targetTopic) {
    var targetOcc,
        targetType;
    targetType = exports.createTopicStub(sourceOcc.getType());
    // Should we use createLocator if value is a locator?
    targetOcc = targetTopic.createOccurrence(targetType, sourceOcc.getValue(),
                                            sourceOcc.getDatatype());
    exports.copyScope(sourceOcc, targetOcc);
    exports.copyReifier(sourceOcc, targetOcc);
};

exports.copyAssociation = function (sourceAssoc, targetTM) {
    var i, targetAssoc,
        targetType,
        sourceScope, targetScope = [],
        sourceRoles, targetRole;
    targetType = exports.createTopicStub(sourceAssoc.getType(), targetTM);
    sourceScope = sourceAssoc.getScope();
    for (i = 0; i < sourceScope.length; i += 1) {
        targetScope.push(exports.createTopicStub(sourceScope[i], targetTM));
    }
    targetAssoc = targetTM.createAssociation(targetType);
    exports.copyScope(sourceAssoc, targetAssoc);
    exports.copyReifier(sourceAssoc, targetAssoc);

    sourceRoles = sourceAssoc.getRoles();
    for (i = 0; i < sourceRoles.length; i += 1) {
        targetAssoc.createRole(
            exports.createTopicStub(sourceRoles[i].getType(), targetTM),
            exports.createTopicStub(sourceRoles[i].getPlayer(), targetTM)
        );
        exports.copyReifier(sourceRoles[i], targetRole);
    }
    return targetAssoc;
};

exports.copyScope = function (source, target) {
    var i, sourceScope;
    sourceScope = source.getScope();
    for (i = 0; i < sourceScope.length; i += 1) {
        target.addTheme(exports.createTopicStub(sourceScope[i], target.getTopicMap()));
    }
};

exports.copyReifier = function (source, target) {
    // TODO: Implement
};

// Checks if a topic with one of the identifiers of sourceTopic
// exists in targetTM. If not, a new topic is created, and all identifiers
// are being copied.
// Returns the existing or created topic in targetTM
exports.createTopicStub = function (sourceTopic, targetTM) {
    var i, topic = null, psis, iis;
    // Copy PSIs
    psis = sourceTopic.getSubjectIdentifiers();
    for (i = 0; i < psis.length; i += 1) {
        if ((topic = targetTM.getTopicBySubjectIdentifier(
            targetTM.createLocator(psis[i].getReference())))) {
            break;
        }
    }
    // Did not find topic by subject identifier
    // Try subject locators
    if (!topic) {
        psis = sourceTopic.getSubjectIdentifiers();
        for (i = 0; i < psis.length; i += 1) {
            if ((topic = targetTM.getTopicBySubjectIdentifier(
                targetTM.createLocator(psis[i].getReference())))) {
                break;
            }
        }
    }
    // Still no topic... so we have to create a new topic
    if (!topic) {
        iis = sourceTopic.getSubjectIdentifiers();
        if (iis.length > 0) {
            topic = targetTM.createTopicBySubjectIdentifier(
                targetTM.createLocator(iis[0].getReference()));
        } else {
            iis = sourceTopic.getSubjectLocators();
            if (iis.length > 0) {
                return iis[0].getReference();
            } else {
                topic = targetTM.createTopic();
            }
        }
    }
    return topic;
};


// Creates a new empty topic map and copies all relevant information
// about topic to the new topic map. The new topic map is returned.
// TODO: Should be part of tmjs' CopyUtils.
exports.exportTopic = function (tm, topic, exportTypes) {
    var exporttm, i, j, psis, names, t, occs, roles, type;
    exporttmid += 1;
    exporttm = exports.getTopicMap('http://semanticheadache.com/node-psi-server/export/' + exporttmid);
    psis = topic.getSubjectIdentifiers();
    t = exporttm.createTopicBySubjectIdentifier(exporttm.createLocator(psis[0].getReference()));
    // Copy all other PSIs
    for (i = 1; i < psis.length; i += 1) {
        t.addSubjectIdentifier(exporttm.createLocator(psis[i].getReference())); 
    }

    for (type in exportTypes) {
        if (exportTypes.hasOwnProperty(type)) {
            occs = topic.getOccurrences(exportTypes[type]);
            for (j = 0; j < occs.length; j += 1) {
                // TODO: Could be TM.CopyHelper.copyOccurrence();
                exports.copyOccurrence(occs[j], t);
            }
        }
    }

    // Not the most performant way. Refactor!
    for (type in exportTypes) {
        if (exportTypes.hasOwnProperty(type)) {
            roles = topic.getRolesPlayed();
            for (j = 0; j < roles.length; j += 1) {
                if (roles[j].getParent().getType().equals(exportTypes[type])) {
                    exports.copyAssociation(roles[j].getParent(), exporttm);
                }
            }
        }
    }

    // TODO: Copy subject locators
    names = topic.getNames();
    for (i = 0; i < names.length; i += 1) {
        t.createName(names[i].getValue()); // TODO: Copy scope and scoping topics
    }

    return exporttm;
};

// Takes a topic object as parameter and returns a textual label
// that represents that topic. If anchor is set, a HTML-link
// is returned. The URL is a 
// options can contain one of the following:
// * anchor (boolean). If true, getTopicLabel tries to wrap the the label
//   in an HTML link
// * servername (String). Servername of the local server. Use this in combination
//   with the anchor. If a URL has the same domain name as servername, a relative
//   URL is generated
exports.getTopicLabel = function (topic, options) {
    var label = null, foundDefaultName = false, minScopeLen = 1000,
        isName = false, names, i, tm, url;
    options = options || {};
    tm = topic.getParent();
    if (!defaultNameType) {
        defaultNameType = tm.getTopicBySubjectIdentifier(
            tm.createLocator(tmjs.TM.TMDM.TOPIC_NAME));
    }

    if ((names = topic.getNames()) && names.length > 0) {
        for (i = 0; i < names.length; i += 1) {
            if (defaultNameType && names[i].getType().equals(defaultNameType)) {
                // If several default names are available,
                // pick the one with fewest scoping topics
                if (label && foundDefaultName &&
                    names[i].getScope().length >= minScopeLen) {
                    continue;
                }
                label = names[i];
                foundDefaultName = true;
                minScopeLen = names[i].getScope().length;
            } else {
                if (!label) {
                    // Better than nothing
                    label = names[i];
                }
            }
        }
        label = label.getValue();
        isName = true;
    } else if (topic.getSubjectIdentifiers().length > 0) {
        label = topic.getSubjectIdentifiers()[0].getReference();
    } else if (topic.getItemIdentifiers().length > 0) {
        label = topic.getItemIdentifiers()[0].getReference();
    }
    if (options.anchor) {
        url = exports.getTopicURL(topic);
        if (url) {
            // TODO check if URL belongs to servername!
            label = '<a href="' + url + '">' + label + '</a>';
        }
    }

    return {label: label, isName: isName};
};

exports.getTopicURL = function (topic) {
    var iis;
    iis = topic.getSubjectIdentifiers();
    if (iis.length > 0) {
        return iis[0].getReference();
    }
    iis = topic.getSubjectLocators();
    if (iis.length > 0) {
        return iis[0].getReference();
    }
    return null;
};


// Parses the configuration topic map
exports.parseConfigTM = function (configTM, opts, config) {
    var filename = opts.get('c'), values, getConfigValue, data,
        reader, tmData, typeIsPublished, type, index, i, j,
        associations, roles, topic, identifiers = [], tmp;
    // If the user specified a configuration file, read and parse it
    if (opts.get('c')) {
        getConfigValue = function (loc_str) {
            var tmp, valueType;
            valueType = configTM.getTopicBySubjectIdentifier(configTM.createLocator(
                configLocators.CONFIGURATION_VALUE));

            if (valueType) {        
                tmp = configTM.getTopicBySubjectIdentifier(configTM.createLocator(
                    loc_str));
                if (tmp) {
                    values = tmp.getOccurrences(valueType);
                    if (values.length) {
                        return values[0].getValue();
                    }
                }
            } else {
                util.log("Could not find " + configLocators.CONFIGURATION_VALUE);
            }
            return null;
        };
        util.log("Reading configuration file '" + filename + "'.");
        data = fs.readFileSync(filename);
        tmData = JSON.parse(data);
        reader = new tmjs.TM.JTM.Reader(configTM);
        reader.fromObject(tmData);

        config.port = getConfigValue(configLocators.PORT);
        config.publisherFallback = getConfigValue(configLocators.PUBLISHER_FALLBACK);
        config.psiStatusFallback = getConfigValue(configLocators.PSI_STATUS_FALLBACK);
        config.createdFallback = getConfigValue(configLocators.CREATED_FALLBACK);
        config.debugLevel = getConfigValue(configLocators.DEBUG_LEVEL);
        config.logFile = getConfigValue(configLocators.LOGFILE);

        // get types to be published
        typeIsPublished = configTM.getTopicBySubjectIdentifier(
            configTM.createLocator(configLocators.TYPE_IS_PUBLISHED));
        type = configTM.getTopicBySubjectIdentifier(
            configTM.createLocator(configLocators.ROLE_TYPE));

        // make sure that both topics exists, if not we can drop that part
        if (!type || !typeIsPublished) {
            return;
        }    
        index = configTM.getIndex('TypeInstanceIndex');
        associations = index.getAssociations(typeIsPublished);
        for (i = 0; i < associations.length; i += 1) {
            roles = associations[i].getRoles();
            // assume unary associations
            if (roles.length !== 1) {
                continue;
            }
            // should we check the type of the role?
            topic = roles[0].getPlayer();
            tmp = topic.getSubjectIdentifiers();
            for (j = 0; j < tmp.length; j += 1) {
                identifiers.push(tmp[j].getReference());
            }
            tmp = topic.getSubjectLocators();
            for (j = 0; j < tmp.length; j += 1) {
                identifiers.push(tmp[j].getReference());
            }
        }
    }
    return identifiers;
};

// Prefetches all topic types we'd like to export
exports.prefetchExportTypes = function (tm, exportIdentifiers) {
    var topic, exportTypes = {}, i;
    if (exportIdentifiers.length > 0) {
        util.log('Occurrence types and association types to include on PSI pages:');
        for (i = 0; i < exportIdentifiers.length; i += 1) {
            util.log(' * ' + exportIdentifiers[i]);
        }
        util.log('Prefetching export types:');
        for (i = 0; i < exportIdentifiers.length; i += 1) {
            topic = tm.getTopicBySubjectIdentifier(tm.createLocator(exportIdentifiers[i]));
            if (topic) {
                util.log(' * found ' + exportIdentifiers[i]);
                exportTypes[exportIdentifiers[i]] = topic;
            }
        }
    }
    return exportTypes;
};

