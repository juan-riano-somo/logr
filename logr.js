/*!
 * Logr
 * http://github.com/eclifford/logr
 *
 * Author: Eric Clifford
 * Email: ericgclifford@gmail.com
 * Date: 10.13.2014
 *
 */
(function(root, factory) {
  if (typeof define === 'function' && define.amd) {
    define([], function() {
      return (root.Logr = factory(root));
    });
  } else if (typeof exports !== 'undefined') {
    module.exports = factory(root);
  } else {
    root.Logr = factory(root);
  }
}(this, function(root) {
  // 'use strict';

  var Logr = {
    version: '0.2.2',

    logs: {},

    defaults: {},

    currentLevel: 1,

    levels: {
      LOG: 1,
      INFO: 2,
      WARN: 3,
      ERROR: 4,
      NONE: 9
    },
    /**
     * Set internal logging level for all logs
     *
     * @example
     *     Logr.setLevel(Logr.levels.DEBUG)
     *
     * @param {Number} level the level to set the log to
     * @api public
     */
    setLevel: function(level) {
      if (isNaN(level)) {
        throw new Error("Logr.setLevel(): expects parameter level of type Number");
      }

      Logr.currentLevel = level;

      for (var log in Logr.logs) {
        Logr.logs[log].setLevel(level);
      }
    },
    /**
     * Get or create a contextual log instance
     *
     * @example
     *     Logr.log('foo')
     *
     * @param {String} logname the name of the contextual log
     * @param {Object} options the instance options
     * @api public
     */
    log: function(logname, options) {
      if (typeof logname !== "string") {
        throw new Error("Logr.log(): expects parameter logname of type String");
      }
      // create a new log
      if (!Logr.logs[logname]) {
        Logr.logs[logname] = new Log(logname, options || {});
      }
      // return an existing log
      return Logr.logs[logname];
    }
  };
  /**
   * Log object constructor
   *
   * @example
   *    var log = new Log('foo')
   *
   * @param {String} logname the name of the log instance
   * @param {Object} options the instance options
   */
  var Log = function(logname, options) {
    if (typeof logname !== 'string') {
      throw new Error("Logr.Log: expects parameter logname of type String");
    }
    this.logname = logname;
    extend(this, Logr.defaults, options || {});

    // setup the console logging
    this.init();
  };
  /**
  * Initialize Logr
  */
  Log.prototype.init = function() {
    var logs = [
      "log",
      "info",
      "warn",
      "error"
    ],
    noop = function() {};

    // proxy all console calls to real methods
    for (var i = 0; i < logs.length; i++) {
      if (console && console[logs[i]] && this.getLevel() <= Logr.levels[logs[i].toUpperCase()]) {
        this[logs[i]] = Function.prototype.bind.call(console[logs[i]], console, "[" + this.logname + "]");
      } else {
        this[logs[i]] = noop;
      }
    }

    // backwards compatibility
    this.debug = this.log;
  };
  /**
   * Set the logging level for this instance
   *
   * @example
   *    var log = Logr.log('foo');
   *    log.setLevel(Logr.levels.DEBUG);
   *
   * @param {Number} level the level to set the instance to
   */
  Log.prototype.setLevel = function(level) {
    try{
      if (root.sessionStorage) {
        root.sessionStorage.setItem("logr:" + this.logname + ":level", level);
      }
    }catch(e){
      console.log('Session storage is blocked')
    }
    this.level = level;
    this.init();
  };
  /**
   * Get the logging level for this instance
   *
   * @example
   *    var log = Logr.log('foo');
   *    log.getLevel();
   *
   * @return {Number} the level to set the instance to
   */
  Log.prototype.getLevel = function() {
    let defaultLevel = this.level || Logr.currentLevel;
    try{
      if (root.sessionStorage) {
        sessionLevel = root.sessionStorage.getItem("logr:" + this.logname + ":level");
      }
      return sessionLevel || defaultLevel;
    }catch(e){
      console.log('Session storage is blocked')
    }
    return defaultLevel;
  };
  /**
   * Attach logging instance to object
   *
   * @example
   *    var log = Logr.log('foo');
   *    log.attach({})
   *
   * @param {Object} obj the object to attach
   */
  Log.prototype.attach = function(obj) {
    var self = this,
        prop, fn, value;

    // enumerate all properties on object proxing all functions except the constructor
    for (prop in obj) {
      if (prop !== null && typeof obj[prop] === 'object') {
        self.attach(obj[prop]);
        continue;
      }
      // wrap functions that aren't by convention Constructors
      if (obj[prop] && typeof obj[prop] === 'function' && !(/^[A-Z]/g.test(prop))) {
        self.wrap(obj, prop);
      }
    }
  };
  /**
   * Process exception and return formatted output
   *
   * @param {Exception} e the exception to format
  */
  Log.prototype.getExceptionLineNumber = function(e) {
    var result = [];

    // safari
    if (e.stack && e.sourceURL) {
      result = e.stack.match(/@.*/g);
      return result ? result[1] : "";
    }

    // firefox
    if (e.stack && e.fileName) {
      result = e.stack.match(/@.*/g);
      return result ? result[1] : "";
    }

    // ie
    if (e.stack && e.number) {
      result = e.stack.match(/@.*/g);
      return result ? result[1] : "";
    }

    // chrome
    if (e.stack) {
      result = e.stack.match(/\(.*\)/g);
      return result ? result[1] : "";
    }

    return "";
  };
  /**
   * Wrap original function with custom logging logic
   *
   * @example
   *    var log = Logr.log('foo');
   *    log.attach({})
   *
   * @param {Object} obj the object to attach
   */
  Log.prototype.wrap = function(obj, prop) {
    var self = this,
        func;

    func = obj[prop];

    obj[prop] = function logr() {
      var stackMessage = "";

      if (self.getLevel() <= Logr.levels.LOG) {

        // force an exception to get original calling location
        try {
          this.undef();
        } catch (e) {
          stackMessage = self.getExceptionLineNumber(e);
        }

        // grouping supported?
        if (console.group) {
          // attempt to call original method bubbling up any errors
          try {
            console.groupCollapsed("[" + self.logname + "] " + obj.constructor.name + "." + prop + "()" + " " + stackMessage);
            console.log("arguments: ", [].slice.call(arguments));
            value = func.apply(this, arguments);
          }
          // any error we find we break out of our console.group and
          // provide full stack trace
          catch(e) {
            var count = 15;
            while(count--) console.groupEnd();
            console.error(e.stack);
            return;
          }

          if (value) console.log("return: ", value);
          console.groupEnd();
        } else {
          console.log("[" + self.logname + "] " + obj.constructor.name + "." + prop + "()" + " " + stackMessage);
          value = func.apply(this, arguments);
        }

        return value;
      } else {
        return func.apply(this, arguments);
      }
    };
  };
  /**
   * Extend obj with n-number of source objects
   *
   * @example
   *    var log = Logr.extend({}, {});
   *
   * @param {Object} obj the object extend
   */
  function extend(obj) {
    var source, prop;
    for (var i = 1, length = arguments.length; i < length; i++) {
      source = arguments[i];
      for (prop in source) {
        if (hasOwnProperty.call(source, prop)) {
            obj[prop] = source[prop];
        }
      }
    }
    return obj;
  }

  return Logr;
}));
