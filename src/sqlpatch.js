/* jshint node: true */

module.exports = sqlpatch;

var fs = require('fs');
var path = require('path');
var pkg = require('../package');
var toposort = require('toposort');
var extend = require('extend');
var Mustache = require('mustache');
var crypto = require('crypto');

function sqlpatch(fileList, writer, options) {

    options = extend({
        dialect: 'mssql',
        schema: 'sqlpatch',
        table: 'batch_000',
    }, options);

    var template = fs.readFileSync(__dirname + '/' + options.dialect + '.sql').toString();
    var model = {
        pkg: pkg,
        options: options,
    };

    var fileInfoList = fileList.map(readFileInfo).map(function(item) {
        if ('name' in item.properties && item.properties.name.length >= 1) item.name = item.properties.name[0];
        else item.name = path.basename(item.file, '.sql');
        return item;
    });
    var fileInfoMap = fileInfoList.reduce(function(map, item) {
        if (item.name in map) throw new Error("duplicate name '" + item.name + "'");
        map[item.name] = item;
        return map;
    }, {});

    fileInfoList.forEach(function(fileInfoItem) {
        if (fileInfoItem.properties.require) {
            fileInfoItem.dependencies = fileInfoItem.properties.require.map(function(name) {
                if (name in fileInfoMap) return fileInfoMap[name];
                else return {
                    name: name,
                    checksum: null,
                };
            });
        }
    });

    var nameList = Object.keys(fileInfoMap);
    var nameEdgeList = nameList.reduce(function(list, name) {
        var fileInfoItem = fileInfoMap[name];
        if ('require' in fileInfoItem.properties) {
            fileInfoItem.properties.require.
            filter(function(dependencyName) {
                return ~nameList.indexOf(dependencyName);
            }).
            forEach(function(dependencyName) {
                list.push([name, dependencyName]);
            });
        }
        return list;
    }, []);

    var dependencyList = toposort.array(nameList, nameEdgeList);

    dependencyList.reverse();

    model.patches = dependencyList.map(function(name, index) {
        var fileInfoItem = fileInfoMap[name];

        return fileInfoItem;
    }).
    filter(function(item) {
        return item;
    }).
    map(function(item, index) {
        var number = index + 1;

        item.number = number;

        return item;
    });

    writer.write(Mustache.render(template, model));
}

function readFileInfo(file) {
    var checksum = crypto.createHash('sha1');
    var content = fs.readFileSync(file).toString().replace(/(^\s+|\s+$|)/g, "");
    checksum.update(content.replace(/(\-\-.*$|\/\*[.\n]*?\*\/|[\n\s]*)*/gm, ''));

    var properties = readProperties(content);
    var parts = breakContentOnGo(content);
    return {
        file: file,
        content: content,
        parts: parts,
        properties: properties,
        checksum: checksum.digest('hex'),
    };
}

function breakContentOnGo(content) {
    var result = [];
    var match;
    var re = /([\s\S]*?)(GO|go)$/gm;
    while ((match = re.exec(content))) {
        result.push({part: match[1].replace(/'/g, "''")});
    }
    return result;
}

function readProperties(content) {
    var result = {};
    var match;
    var re = /^\s*\-\-\s*@(.+?)\s+(.+?)\s*$/gm;
    while ((match = re.exec(content))) {
        if (match[1] in result) result[match[1]].push(match[2]);
        else result[match[1]] = [match[2]];
    }
    return result;
}