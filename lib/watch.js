var fs = require('fs');
var path = require('path');
var exists = fs.exists || path.exists;

module.exports = function (self, w, opts) { 
    if (!w.watches) w.watches = [];
    w.register(reg.bind(null, self, w, opts));
};

function reg (self, w, opts, body, file) {
    // if already being watched
    if (w.watches[file]) return body;
    
    var type = w.files[file] ? 'files' : 'entries';
    
    var watch = function () {
        if (w.files[file] && w.files[file].synthetic) return;
        
        if (typeof opts === 'object') {
            w.watches[file] = fs.watch(file, opts, watcher);
        }
        else {
            w.watches[file] = fs.watch(file, watcher);
        }
    };
    var pending = null;
    
    var watcher = function (event, filename) {
        exists(file, function (ex) {
            if (!ex) {
                // deleted
                if (w.files[file]) {
                    delete w.files[file];
                }
                else if (w.entries[file] !== undefined) {
                    w.appends.splice(w.entries[file], 1);
                }
                
                w._cache = null;
            }
            else if (event === 'change') {
                if (pending) return;
                pending = setTimeout(function () {
                    pending = null;
                    // modified
                    try {
                        if (w[type][file]) {
                            w.reload(file);
                        }
                        else if (type === 'entries') {
                            w.addEntry(file);
                        }
                        else if (type === 'files') {
                            w.require(file);
                        }
                        
                        w._cache = null;
                        self.emit('bundle');
                    }
                    catch (e) {
                        self.emit('syntaxError', e);
                        if (self.listeners('syntaxError').length === 0) {
                            console.error(e && e.stack || e);
                        }
                    }
                }, 100);
            }
            else if (event === 'rename') {
                w.watches[file].close();
                process.nextTick(watch);
            }
        });
    };
    
    w.watches[file] = true;
    process.nextTick(watch);
    
    return body;
}