// vim:ts=4:sts=4:sw=4:
/*!
 *
 * Copyright 2009-2012 Kris Kowal under the terms of the MIT
 * license found at http://github.com/kriskowal/q/raw/master/LICENSE
 *
 * With parts by Tyler Close
 * Copyright 2007-2009 Tyler Close under the terms of the MIT X license found
 * at http://www.opensource.org/licenses/mit-license.html
 * Forked at ref_send.js version: 2009-05-11
 *
 * With parts by Mark Miller
 * Copyright (C) 2011 Google Inc.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 *
 */

(function (definition) {
    // Turn off strict mode for this function so we can assign to global.Q
    /* jshint strict: false */

    // This file will function properly as a <script> tag, or a module
    // using CommonJS and NodeJS or RequireJS module formats.  In
    // Common/Node/RequireJS, the module exports the Q API and when
    // executed as a simple <script>, it creates a Q global instead.

    // Montage Require
    if (typeof bootstrap === "function") {
        bootstrap("promise", definition);

    // CommonJS
    } else if (typeof exports === "object") {
        module.exports = definition();

    // RequireJS
    } else if (typeof define === "function" && define.amd) {
        define(definition);

    // SES (Secure EcmaScript)
    } else if (typeof ses !== "undefined") {
        if (!ses.ok()) {
            return;
        } else {
            ses.makeQ = definition;
        }

    // <script>
    } else {
        Q = definition();
    }

})(function () {
"use strict";

var hasStacks = false;
try {
    throw new Error();
} catch (e) {
    hasStacks = !!e.stack;
}

// All code after this point will be filtered from stack traces reported
// by Q.
var qStartingLine = captureLine();
var qFileName;

// shims

// used for fallback in "allResolved"
var noop = function () {};

// Use the fastest possible means to execute a task in a future turn
// of the event loop.
var nextTick =(function () {
    // linked list of tasks (single, with head node)
    var head = {task: void 0, next: null};
    var tail = head;
    var flushing = false;
    var requestTick = void 0;
    var isNodeJS = false;

    function flush() {
        /* jshint loopfunc: true */

        while (head.next) {
            head = head.next;
            var task = head.task;
            head.task = void 0;
            var domain = head.domain;

            if (domain) {
                head.domain = void 0;
                domain.enter();
            }

            try {
                task();

            } catch (e) {
                if (isNodeJS) {
                    // In node, uncaught exceptions are considered fatal errors.
                    // Re-throw them synchronously to interrupt flushing!

                    // Ensure continuation if the uncaught exception is suppressed
                    // listening "uncaughtException" events (as domains does).
                    // Continue in next event to avoid tick recursion.
                    if (domain) {
                        domain.exit();
                    }
                    setTimeout(flush, 0);
                    if (domain) {
                        domain.enter();
                    }

                    throw e;

                } else {
                    // In browsers, uncaught exceptions are not fatal.
                    // Re-throw them asynchronously to avoid slow-downs.
                    setTimeout(function() {
                       throw e;
                    }, 0);
                }
            }

            if (domain) {
                domain.exit();
            }
        }

        flushing = false;
    }

    nextTick = function (task) {
        tail = tail.next = {
            task: task,
            domain: isNodeJS && process.domain,
            next: null
        };

        if (!flushing) {
            flushing = true;
            requestTick();
        }
    };

    if (typeof process !== "undefined" && process.nextTick) {
        // Node.js before 0.9. Note that some fake-Node environments, like the
        // Mocha test runner, introduce a `process` global without a `nextTick`.
        isNodeJS = true;

        requestTick = function () {
            process.nextTick(flush);
        };

    } else if (typeof setImmediate === "function") {
        // In IE10, Node.js 0.9+, or https://github.com/NobleJS/setImmediate
        if (typeof window !== "undefined") {
            requestTick = setImmediate.bind(window, flush);
        } else {
            requestTick = function () {
                setImmediate(flush);
            };
        }

    } else if (typeof MessageChannel !== "undefined") {
        // modern browsers
        // http://www.nonblocking.io/2011/06/windownexttick.html
        var channel = new MessageChannel();
        // At least Safari Version 6.0.5 (8536.30.1) intermittently cannot create
        // working message ports the first time a page loads.
        channel.port1.onmessage = function () {
            requestTick = requestPortTick;
            channel.port1.onmessage = flush;
            flush();
        };
        var requestPortTick = function () {
            // Opera requires us to provide a message payload, regardless of
            // whether we use it.
            channel.port2.postMessage(0);
        };
        requestTick = function () {
            setTimeout(flush, 0);
            requestPortTick();
        };

    } else {
        // old browsers
        requestTick = function () {
            setTimeout(flush, 0);
        };
    }

    return nextTick;
})();

// Attempt to make generics safe in the face of downstream
// modifications.
// There is no situation where this is necessary.
// If you need a security guarantee, these primordials need to be
// deeply frozen anyway, and if you don’t need a security guarantee,
// this is just plain paranoid.
// However, this **might** have the nice side-effect of reducing the size of
// the minified code by reducing x.call() to merely x()
// See Mark Miller’s explanation of what this does.
// http://wiki.ecmascript.org/doku.php?id=conventions:safe_meta_programming
var call = Function.call;
function uncurryThis(f) {
    return function () {
        return call.apply(f, arguments);
    };
}
// This is equivalent, but slower:
// uncurryThis = Function_bind.bind(Function_bind.call);
// http://jsperf.com/uncurrythis

var array_slice = uncurryThis(Array.prototype.slice);

var array_reduce = uncurryThis(
    Array.prototype.reduce || function (callback, basis) {
        var index = 0,
            length = this.length;
        // concerning the initial value, if one is not provided
        if (arguments.length === 1) {
            // seek to the first value in the array, accounting
            // for the possibility that is is a sparse array
            do {
                if (index in this) {
                    basis = this[index++];
                    break;
                }
                if (++index >= length) {
                    throw new TypeError();
                }
            } while (1);
        }
        // reduce
        for (; index < length; index++) {
            // account for the possibility that the array is sparse
            if (index in this) {
                basis = callback(basis, this[index], index);
            }
        }
        return basis;
    }
);

var array_indexOf = uncurryThis(
    Array.prototype.indexOf || function (value) {
        // not a very good shim, but good enough for our one use of it
        for (var i = 0; i < this.length; i++) {
            if (this[i] === value) {
                return i;
            }
        }
        return -1;
    }
);

var array_map = uncurryThis(
    Array.prototype.map || function (callback, thisp) {
        var self = this;
        var collect = [];
        array_reduce(self, function (undefined, value, index) {
            collect.push(callback.call(thisp, value, index, self));
        }, void 0);
        return collect;
    }
);

var object_create = Object.create || function (prototype) {
    function Type() { }
    Type.prototype = prototype;
    return new Type();
};

var object_hasOwnProperty = uncurryThis(Object.prototype.hasOwnProperty);

var object_keys = Object.keys || function (object) {
    var keys = [];
    for (var key in object) {
        if (object_hasOwnProperty(object, key)) {
            keys.push(key);
        }
    }
    return keys;
};

var object_toString = uncurryThis(Object.prototype.toString);

function isObject(value) {
    return value === Object(value);
}

// generator related shims

// FIXME: Remove this function once ES6 generators are in SpiderMonkey.
function isStopIteration(exception) {
    return (
        object_toString(exception) === "[object StopIteration]" ||
        exception instanceof QReturnValue
    );
}

// FIXME: Remove this helper and Q.return once ES6 generators are in
// SpiderMonkey.
var QReturnValue;
if (typeof ReturnValue !== "undefined") {
    QReturnValue = ReturnValue;
} else {
    QReturnValue = function (value) {
        this.value = value;
    };
}

// long stack traces

var STACK_JUMP_SEPARATOR = "From previous event:";

function makeStackTraceLong(error, promise) {
    // If possible, transform the error stack trace by removing Node and Q
    // cruft, then concatenating with the stack trace of `promise`. See #57.
    if (hasStacks &&
        promise.stack &&
        typeof error === "object" &&
        error !== null &&
        error.stack &&
        error.stack.indexOf(STACK_JUMP_SEPARATOR) === -1
    ) {
        var stacks = [];
        for (var p = promise; !!p; p = p.source) {
            if (p.stack) {
                stacks.unshift(p.stack);
            }
        }
        stacks.unshift(error.stack);

        var concatedStacks = stacks.join("\n" + STACK_JUMP_SEPARATOR + "\n");
        error.stack = filterStackString(concatedStacks);
    }
}

function filterStackString(stackString) {
    var lines = stackString.split("\n");
    var desiredLines = [];
    for (var i = 0; i < lines.length; ++i) {
        var line = lines[i];

        if (!isInternalFrame(line) && !isNodeFrame(line) && line) {
            desiredLines.push(line);
        }
    }
    return desiredLines.join("\n");
}

function isNodeFrame(stackLine) {
    return stackLine.indexOf("(module.js:") !== -1 ||
           stackLine.indexOf("(node.js:") !== -1;
}

function getFileNameAndLineNumber(stackLine) {
    // Named functions: "at functionName (filename:lineNumber:columnNumber)"
    // In IE10 function name can have spaces ("Anonymous function") O_o
    var attempt1 = /at .+ \((.+):(\d+):(?:\d+)\)$/.exec(stackLine);
    if (attempt1) {
        return [attempt1[1], Number(attempt1[2])];
    }

    // Anonymous functions: "at filename:lineNumber:columnNumber"
    var attempt2 = /at ([^ ]+):(\d+):(?:\d+)$/.exec(stackLine);
    if (attempt2) {
        return [attempt2[1], Number(attempt2[2])];
    }

    // Firefox style: "function@filename:lineNumber or @filename:lineNumber"
    var attempt3 = /.*@(.+):(\d+)$/.exec(stackLine);
    if (attempt3) {
        return [attempt3[1], Number(attempt3[2])];
    }
}

function isInternalFrame(stackLine) {
    var fileNameAndLineNumber = getFileNameAndLineNumber(stackLine);

    if (!fileNameAndLineNumber) {
        return false;
    }

    var fileName = fileNameAndLineNumber[0];
    var lineNumber = fileNameAndLineNumber[1];

    return fileName === qFileName &&
        lineNumber >= qStartingLine &&
        lineNumber <= qEndingLine;
}

// discover own file name and line number range for filtering stack
// traces
function captureLine() {
    if (!hasStacks) {
        return;
    }

    try {
        throw new Error();
    } catch (e) {
        var lines = e.stack.split("\n");
        var firstLine = lines[0].indexOf("@") > 0 ? lines[1] : lines[2];
        var fileNameAndLineNumber = getFileNameAndLineNumber(firstLine);
        if (!fileNameAndLineNumber) {
            return;
        }

        qFileName = fileNameAndLineNumber[0];
        return fileNameAndLineNumber[1];
    }
}

function deprecate(callback, name, alternative) {
    return function () {
        if (typeof console !== "undefined" &&
            typeof console.warn === "function") {
            console.warn(name + " is deprecated, use " + alternative +
                         " instead.", new Error("").stack);
        }
        return callback.apply(callback, arguments);
    };
}

// end of shims
// beginning of real work

/**
 * Constructs a promise for an immediate reference, passes promises through, or
 * coerces promises from different systems.
 * @param value immediate reference or promise
 */
function Q(value) {
    // If the object is already a Promise, return it directly.  This enables
    // the resolve function to both be used to created references from objects,
    // but to tolerably coerce non-promises to promises.
    if (isPromise(value)) {
        return value;
    }

    // assimilate thenables
    if (isPromiseAlike(value)) {
        return coerce(value);
    } else {
        return fulfill(value);
    }
}
Q.resolve = Q;

/**
 * Performs a task in a future turn of the event loop.
 * @param {Function} task
 */
Q.nextTick = nextTick;

/**
 * Controls whether or not long stack traces will be on
 */
Q.longStackSupport = false;

/**
 * Constructs a {promise, resolve, reject} object.
 *
 * `resolve` is a callback to invoke with a more resolved value for the
 * promise. To fulfill the promise, invoke `resolve` with any value that is
 * not a thenable. To reject the promise, invoke `resolve` with a rejected
 * thenable, or invoke `reject` with the reason directly. To resolve the
 * promise to another thenable, thus putting it in the same state, invoke
 * `resolve` with that other thenable.
 */
Q.defer = defer;
function defer() {
    // if "messages" is an "Array", that indicates that the promise has not yet
    // been resolved.  If it is "undefined", it has been resolved.  Each
    // element of the messages array is itself an array of complete arguments to
    // forward to the resolved promise.  We coerce the resolution value to a
    // promise using the `resolve` function because it handles both fully
    // non-thenable values and other thenables gracefully.
    var messages = [], progressListeners = [], resolvedPromise;

    var deferred = object_create(defer.prototype);
    var promise = object_create(Promise.prototype);

    promise.promiseDispatch = function (resolve, op, operands) {
        var args = array_slice(arguments);
        if (messages) {
            messages.push(args);
            if (op === "when" && operands[1]) { // progress operand
                progressListeners.push(operands[1]);
            }
        } else {
            nextTick(function () {
                resolvedPromise.promiseDispatch.apply(resolvedPromise, args);
            });
        }
    };

    // XXX deprecated
    promise.valueOf = function () {
        if (messages) {
            return promise;
        }
        var nearerValue = nearer(resolvedPromise);
        if (isPromise(nearerValue)) {
            resolvedPromise = nearerValue; // shorten chain
        }
        return nearerValue;
    };

    promise.inspect = function () {
        if (!resolvedPromise) {
            return { state: "pending" };
        }
        return resolvedPromise.inspect();
    };

    if (Q.longStackSupport && hasStacks) {
        try {
            throw new Error();
        } catch (e) {
            // NOTE: don't try to use `Error.captureStackTrace` or transfer the
            // accessor around; that causes memory leaks as per GH-111. Just
            // reify the stack trace as a string ASAP.
            //
            // At the same time, cut off the first line; it's always just
            // "[object Promise]\n", as per the `toString`.
            promise.stack = e.stack.substring(e.stack.indexOf("\n") + 1);
        }
    }

    // NOTE: we do the checks for `resolvedPromise` in each method, instead of
    // consolidating them into `become`, since otherwise we'd create new
    // promises with the lines `become(whatever(value))`. See e.g. GH-252.

    function become(newPromise) {
        resolvedPromise = newPromise;
        promise.source = newPromise;

        array_reduce(messages, function (undefined, message) {
            nextTick(function () {
                newPromise.promiseDispatch.apply(newPromise, message);
            });
        }, void 0);

        messages = void 0;
        progressListeners = void 0;
    }

    deferred.promise = promise;
    deferred.resolve = function (value) {
        if (resolvedPromise) {
            return;
        }

        become(Q(value));
    };

    deferred.fulfill = function (value) {
        if (resolvedPromise) {
            return;
        }

        become(fulfill(value));
    };
    deferred.reject = function (reason) {
        if (resolvedPromise) {
            return;
        }

        become(reject(reason));
    };
    deferred.notify = function (progress) {
        if (resolvedPromise) {
            return;
        }

        array_reduce(progressListeners, function (undefined, progressListener) {
            nextTick(function () {
                progressListener(progress);
            });
        }, void 0);
    };

    return deferred;
}

/**
 * Creates a Node-style callback that will resolve or reject the deferred
 * promise.
 * @returns a nodeback
 */
defer.prototype.makeNodeResolver = function () {
    var self = this;
    return function (error, value) {
        if (error) {
            self.reject(error);
        } else if (arguments.length > 2) {
            self.resolve(array_slice(arguments, 1));
        } else {
            self.resolve(value);
        }
    };
};

/**
 * @param resolver {Function} a function that returns nothing and accepts
 * the resolve, reject, and notify functions for a deferred.
 * @returns a promise that may be resolved with the given resolve and reject
 * functions, or rejected by a thrown exception in resolver
 */
Q.Promise = promise; // ES6
Q.promise = promise;
function promise(resolver) {
    if (typeof resolver !== "function") {
        throw new TypeError("resolver must be a function.");
    }
    var deferred = defer();
    try {
        resolver(deferred.resolve, deferred.reject, deferred.notify);
    } catch (reason) {
        deferred.reject(reason);
    }
    return deferred.promise;
}

promise.race = race; // ES6
promise.all = all; // ES6
promise.reject = reject; // ES6
promise.resolve = Q; // ES6

// XXX experimental.  This method is a way to denote that a local value is
// serializable and should be immediately dispatched to a remote upon request,
// instead of passing a reference.
Q.passByCopy = function (object) {
    //freeze(object);
    //passByCopies.set(object, true);
    return object;
};

Promise.prototype.passByCopy = function () {
    //freeze(object);
    //passByCopies.set(object, true);
    return this;
};

/**
 * If two promises eventually fulfill to the same value, promises that value,
 * but otherwise rejects.
 * @param x {Any*}
 * @param y {Any*}
 * @returns {Any*} a promise for x and y if they are the same, but a rejection
 * otherwise.
 *
 */
Q.join = function (x, y) {
    return Q(x).join(y);
};

Promise.prototype.join = function (that) {
    return Q([this, that]).spread(function (x, y) {
        if (x === y) {
            // TODO: "===" should be Object.is or equiv
            return x;
        } else {
            throw new Error("Can't join: not the same: " + x + " " + y);
        }
    });
};

/**
 * Returns a promise for the first of an array of promises to become fulfilled.
 * @param answers {Array[Any*]} promises to race
 * @returns {Any*} the first promise to be fulfilled
 */
Q.race = race;
function race(answerPs) {
    return promise(function(resolve, reject) {
        // Switch to this once we can assume at least ES5
        // answerPs.forEach(function(answerP) {
        //     Q(answerP).then(resolve, reject);
        // });
        // Use this in the meantime
        for (var i = 0, len = answerPs.length; i < len; i++) {
            Q(answerPs[i]).then(resolve, reject);
        }
    });
}

Promise.prototype.race = function () {
    return this.then(Q.race);
};

/**
 * Constructs a Promise with a promise descriptor object and optional fallback
 * function.  The descriptor contains methods like when(rejected), get(name),
 * set(name, value), post(name, args), and delete(name), which all
 * return either a value, a promise for a value, or a rejection.  The fallback
 * accepts the operation name, a resolver, and any further arguments that would
 * have been forwarded to the appropriate method above had a method been
 * provided with the proper name.  The API makes no guarantees about the nature
 * of the returned object, apart from that it is usable whereever promises are
 * bought and sold.
 */
Q.makePromise = Promise;
function Promise(descriptor, fallback, inspect) {
    if (fallback === void 0) {
        fallback = function (op) {
            return reject(new Error(
                "Promise does not support operation: " + op
            ));
        };
    }
    if (inspect === void 0) {
        inspect = function () {
            return {state: "unknown"};
        };
    }

    var promise = object_create(Promise.prototype);

    promise.promiseDispatch = function (resolve, op, args) {
        var result;
        try {
            if (descriptor[op]) {
                result = descriptor[op].apply(promise, args);
            } else {
                result = fallback.call(promise, op, args);
            }
        } catch (exception) {
            result = reject(exception);
        }
        if (resolve) {
            resolve(result);
        }
    };

    promise.inspect = inspect;

    // XXX deprecated `valueOf` and `exception` support
    if (inspect) {
        var inspected = inspect();
        if (inspected.state === "rejected") {
            promise.exception = inspected.reason;
        }

        promise.valueOf = function () {
            var inspected = inspect();
            if (inspected.state === "pending" ||
                inspected.state === "rejected") {
                return promise;
            }
            return inspected.value;
        };
    }

    return promise;
}

Promise.prototype.toString = function () {
    return "[object Promise]";
};

Promise.prototype.then = function (fulfilled, rejected, progressed) {
    var self = this;
    var deferred = defer();
    var done = false;   // ensure the untrusted promise makes at most a
                        // single call to one of the callbacks

    function _fulfilled(value) {
        try {
            return typeof fulfilled === "function" ? fulfilled(value) : value;
        } catch (exception) {
            return reject(exception);
        }
    }

    function _rejected(exception) {
        if (typeof rejected === "function") {
            makeStackTraceLong(exception, self);
            try {
                return rejected(exception);
            } catch (newException) {
                return reject(newException);
            }
        }
        return reject(exception);
    }

    function _progressed(value) {
        return typeof progressed === "function" ? progressed(value) : value;
    }

    nextTick(function () {
        self.promiseDispatch(function (value) {
            if (done) {
                return;
            }
            done = true;

            deferred.resolve(_fulfilled(value));
        }, "when", [function (exception) {
            if (done) {
                return;
            }
            done = true;

            deferred.resolve(_rejected(exception));
        }]);
    });

    // Progress propagator need to be attached in the current tick.
    self.promiseDispatch(void 0, "when", [void 0, function (value) {
        var newValue;
        var threw = false;
        try {
            newValue = _progressed(value);
        } catch (e) {
            threw = true;
            if (Q.onerror) {
                Q.onerror(e);
            } else {
                throw e;
            }
        }

        if (!threw) {
            deferred.notify(newValue);
        }
    }]);

    return deferred.promise;
};

/**
 * Registers an observer on a promise.
 *
 * Guarantees:
 *
 * 1. that fulfilled and rejected will be called only once.
 * 2. that either the fulfilled callback or the rejected callback will be
 *    called, but not both.
 * 3. that fulfilled and rejected will not be called in this turn.
 *
 * @param value      promise or immediate reference to observe
 * @param fulfilled  function to be called with the fulfilled value
 * @param rejected   function to be called with the rejection exception
 * @param progressed function to be called on any progress notifications
 * @return promise for the return value from the invoked callback
 */
Q.when = when;
function when(value, fulfilled, rejected, progressed) {
    return Q(value).then(fulfilled, rejected, progressed);
}

Promise.prototype.thenResolve = function (value) {
    return this.then(function () { return value; });
};

Q.thenResolve = function (promise, value) {
    return Q(promise).thenResolve(value);
};

Promise.prototype.thenReject = function (reason) {
    return this.then(function () { throw reason; });
};

Q.thenReject = function (promise, reason) {
    return Q(promise).thenReject(reason);
};

/**
 * If an object is not a promise, it is as "near" as possible.
 * If a promise is rejected, it is as "near" as possible too.
 * If it’s a fulfilled promise, the fulfillment value is nearer.
 * If it’s a deferred promise and the deferred has been resolved, the
 * resolution is "nearer".
 * @param object
 * @returns most resolved (nearest) form of the object
 */

// XXX should we re-do this?
Q.nearer = nearer;
function nearer(value) {
    if (isPromise(value)) {
        var inspected = value.inspect();
        if (inspected.state === "fulfilled") {
            return inspected.value;
        }
    }
    return value;
}

/**
 * @returns whether the given object is a promise.
 * Otherwise it is a fulfilled value.
 */
Q.isPromise = isPromise;
function isPromise(object) {
    return isObject(object) &&
        typeof object.promiseDispatch === "function" &&
        typeof object.inspect === "function";
}

Q.isPromiseAlike = isPromiseAlike;
function isPromiseAlike(object) {
    return isObject(object) && typeof object.then === "function";
}

/**
 * @returns whether the given object is a pending promise, meaning not
 * fulfilled or rejected.
 */
Q.isPending = isPending;
function isPending(object) {
    return isPromise(object) && object.inspect().state === "pending";
}

Promise.prototype.isPending = function () {
    return this.inspect().state === "pending";
};

/**
 * @returns whether the given object is a value or fulfilled
 * promise.
 */
Q.isFulfilled = isFulfilled;
function isFulfilled(object) {
    return !isPromise(object) || object.inspect().state === "fulfilled";
}

Promise.prototype.isFulfilled = function () {
    return this.inspect().state === "fulfilled";
};

/**
 * @returns whether the given object is a rejected promise.
 */
Q.isRejected = isRejected;
function isRejected(object) {
    return isPromise(object) && object.inspect().state === "rejected";
}

Promise.prototype.isRejected = function () {
    return this.inspect().state === "rejected";
};

//// BEGIN UNHANDLED REJECTION TRACKING

// This promise library consumes exceptions thrown in handlers so they can be
// handled by a subsequent promise.  The exceptions get added to this array when
// they are created, and removed when they are handled.  Note that in ES6 or
// shimmed environments, this would naturally be a `Set`.
var unhandledReasons = [];
var unhandledRejections = [];
var trackUnhandledRejections = true;

function resetUnhandledRejections() {
    unhandledReasons.length = 0;
    unhandledRejections.length = 0;

    if (!trackUnhandledRejections) {
        trackUnhandledRejections = true;
    }
}

function trackRejection(promise, reason) {
    if (!trackUnhandledRejections) {
        return;
    }

    unhandledRejections.push(promise);
    if (reason && typeof reason.stack !== "undefined") {
        unhandledReasons.push(reason.stack);
    } else {
        unhandledReasons.push("(no stack) " + reason);
    }
}

function untrackRejection(promise) {
    if (!trackUnhandledRejections) {
        return;
    }

    var at = array_indexOf(unhandledRejections, promise);
    if (at !== -1) {
        unhandledRejections.splice(at, 1);
        unhandledReasons.splice(at, 1);
    }
}

Q.resetUnhandledRejections = resetUnhandledRejections;

Q.getUnhandledReasons = function () {
    // Make a copy so that consumers can't interfere with our internal state.
    return unhandledReasons.slice();
};

Q.stopUnhandledRejectionTracking = function () {
    resetUnhandledRejections();
    trackUnhandledRejections = false;
};

resetUnhandledRejections();

//// END UNHANDLED REJECTION TRACKING

/**
 * Constructs a rejected promise.
 * @param reason value describing the failure
 */
Q.reject = reject;
function reject(reason) {
    var rejection = Promise({
        "when": function (rejected) {
            // note that the error has been handled
            if (rejected) {
                untrackRejection(this);
            }
            return rejected ? rejected(reason) : this;
        }
    }, function fallback() {
        return this;
    }, function inspect() {
        return { state: "rejected", reason: reason };
    });

    // Note that the reason has not been handled.
    trackRejection(rejection, reason);

    return rejection;
}

/**
 * Constructs a fulfilled promise for an immediate reference.
 * @param value immediate reference
 */
Q.fulfill = fulfill;
function fulfill(value) {
    return Promise({
        "when": function () {
            return value;
        },
        "get": function (name) {
            return value[name];
        },
        "set": function (name, rhs) {
            value[name] = rhs;
        },
        "delete": function (name) {
            delete value[name];
        },
        "post": function (name, args) {
            // Mark Miller proposes that post with no name should apply a
            // promised function.
            if (name === null || name === void 0) {
                return value.apply(void 0, args);
            } else {
                return value[name].apply(value, args);
            }
        },
        "apply": function (thisp, args) {
            return value.apply(thisp, args);
        },
        "keys": function () {
            return object_keys(value);
        }
    }, void 0, function inspect() {
        return { state: "fulfilled", value: value };
    });
}

/**
 * Converts thenables to Q promises.
 * @param promise thenable promise
 * @returns a Q promise
 */
function coerce(promise) {
    var deferred = defer();
    nextTick(function () {
        try {
            promise.then(deferred.resolve, deferred.reject, deferred.notify);
        } catch (exception) {
            deferred.reject(exception);
        }
    });
    return deferred.promise;
}

/**
 * Annotates an object such that it will never be
 * transferred away from this process over any promise
 * communication channel.
 * @param object
 * @returns promise a wrapping of that object that
 * additionally responds to the "isDef" message
 * without a rejection.
 */
Q.master = master;
function master(object) {
    return Promise({
        "isDef": function () {}
    }, function fallback(op, args) {
        return dispatch(object, op, args);
    }, function () {
        return Q(object).inspect();
    });
}

/**
 * Spreads the values of a promised array of arguments into the
 * fulfillment callback.
 * @param fulfilled callback that receives variadic arguments from the
 * promised array
 * @param rejected callback that receives the exception if the promise
 * is rejected.
 * @returns a promise for the return value or thrown exception of
 * either callback.
 */
Q.spread = spread;
function spread(value, fulfilled, rejected) {
    return Q(value).spread(fulfilled, rejected);
}

Promise.prototype.spread = function (fulfilled, rejected) {
    return this.all().then(function (array) {
        return fulfilled.apply(void 0, array);
    }, rejected);
};

/**
 * The async function is a decorator for generator functions, turning
 * them into asynchronous generators.  Although generators are only part
 * of the newest ECMAScript 6 drafts, this code does not cause syntax
 * errors in older engines.  This code should continue to work and will
 * in fact improve over time as the language improves.
 *
 * ES6 generators are currently part of V8 version 3.19 with the
 * --harmony-generators runtime flag enabled.  SpiderMonkey has had them
 * for longer, but under an older Python-inspired form.  This function
 * works on both kinds of generators.
 *
 * Decorates a generator function such that:
 *  - it may yield promises
 *  - execution will continue when that promise is fulfilled
 *  - the value of the yield expression will be the fulfilled value
 *  - it returns a promise for the return value (when the generator
 *    stops iterating)
 *  - the decorated function returns a promise for the return value
 *    of the generator or the first rejected promise among those
 *    yielded.
 *  - if an error is thrown in the generator, it propagates through
 *    every following yield until it is caught, or until it escapes
 *    the generator function altogether, and is translated into a
 *    rejection for the promise returned by the decorated generator.
 */
Q.async = async;
function async(makeGenerator) {
    return function () {
        // when verb is "send", arg is a value
        // when verb is "throw", arg is an exception
        function continuer(verb, arg) {
            var result;

            // Until V8 3.19 / Chromium 29 is released, SpiderMonkey is the only
            // engine that has a deployed base of browsers that support generators.
            // However, SM's generators use the Python-inspired semantics of
            // outdated ES6 drafts.  We would like to support ES6, but we'd also
            // like to make it possible to use generators in deployed browsers, so
            // we also support Python-style generators.  At some point we can remove
            // this block.

            if (typeof StopIteration === "undefined") {
                // ES6 Generators
                try {
                    result = generator[verb](arg);
                } catch (exception) {
                    return reject(exception);
                }
                if (result.done) {
                    return result.value;
                } else {
                    return when(result.value, callback, errback);
                }
            } else {
                // SpiderMonkey Generators
                // FIXME: Remove this case when SM does ES6 generators.
                try {
                    result = generator[verb](arg);
                } catch (exception) {
                    if (isStopIteration(exception)) {
                        return exception.value;
                    } else {
                        return reject(exception);
                    }
                }
                return when(result, callback, errback);
            }
        }
        var generator = makeGenerator.apply(this, arguments);
        var callback = continuer.bind(continuer, "next");
        var errback = continuer.bind(continuer, "throw");
        return callback();
    };
}

/**
 * The spawn function is a small wrapper around async that immediately
 * calls the generator and also ends the promise chain, so that any
 * unhandled errors are thrown instead of forwarded to the error
 * handler. This is useful because it's extremely common to run
 * generators at the top-level to work with libraries.
 */
Q.spawn = spawn;
function spawn(makeGenerator) {
    Q.done(Q.async(makeGenerator)());
}

// FIXME: Remove this interface once ES6 generators are in SpiderMonkey.
/**
 * Throws a ReturnValue exception to stop an asynchronous generator.
 *
 * This interface is a stop-gap measure to support generator return
 * values in older Firefox/SpiderMonkey.  In browsers that support ES6
 * generators like Chromium 29, just use "return" in your generator
 * functions.
 *
 * @param value the return value for the surrounding generator
 * @throws ReturnValue exception with the value.
 * @example
 * // ES6 style
 * Q.async(function* () {
 *      var foo = yield getFooPromise();
 *      var bar = yield getBarPromise();
 *      return foo + bar;
 * })
 * // Older SpiderMonkey style
 * Q.async(function () {
 *      var foo = yield getFooPromise();
 *      var bar = yield getBarPromise();
 *      Q.return(foo + bar);
 * })
 */
Q["return"] = _return;
function _return(value) {
    throw new QReturnValue(value);
}

/**
 * The promised function decorator ensures that any promise arguments
 * are settled and passed as values (`this` is also settled and passed
 * as a value).  It will also ensure that the result of a function is
 * always a promise.
 *
 * @example
 * var add = Q.promised(function (a, b) {
 *     return a + b;
 * });
 * add(Q(a), Q(B));
 *
 * @param {function} callback The function to decorate
 * @returns {function} a function that has been decorated.
 */
Q.promised = promised;
function promised(callback) {
    return function () {
        return spread([this, all(arguments)], function (self, args) {
            return callback.apply(self, args);
        });
    };
}

/**
 * sends a message to a value in a future turn
 * @param object* the recipient
 * @param op the name of the message operation, e.g., "when",
 * @param args further arguments to be forwarded to the operation
 * @returns result {Promise} a promise for the result of the operation
 */
Q.dispatch = dispatch;
function dispatch(object, op, args) {
    return Q(object).dispatch(op, args);
}

Promise.prototype.dispatch = function (op, args) {
    var self = this;
    var deferred = defer();
    nextTick(function () {
        self.promiseDispatch(deferred.resolve, op, args);
    });
    return deferred.promise;
};

/**
 * Gets the value of a property in a future turn.
 * @param object    promise or immediate reference for target object
 * @param name      name of property to get
 * @return promise for the property value
 */
Q.get = function (object, key) {
    return Q(object).dispatch("get", [key]);
};

Promise.prototype.get = function (key) {
    return this.dispatch("get", [key]);
};

/**
 * Sets the value of a property in a future turn.
 * @param object    promise or immediate reference for object object
 * @param name      name of property to set
 * @param value     new value of property
 * @return promise for the return value
 */
Q.set = function (object, key, value) {
    return Q(object).dispatch("set", [key, value]);
};

Promise.prototype.set = function (key, value) {
    return this.dispatch("set", [key, value]);
};

/**
 * Deletes a property in a future turn.
 * @param object    promise or immediate reference for target object
 * @param name      name of property to delete
 * @return promise for the return value
 */
Q.del = // XXX legacy
Q["delete"] = function (object, key) {
    return Q(object).dispatch("delete", [key]);
};

Promise.prototype.del = // XXX legacy
Promise.prototype["delete"] = function (key) {
    return this.dispatch("delete", [key]);
};

/**
 * Invokes a method in a future turn.
 * @param object    promise or immediate reference for target object
 * @param name      name of method to invoke
 * @param value     a value to post, typically an array of
 *                  invocation arguments for promises that
 *                  are ultimately backed with `resolve` values,
 *                  as opposed to those backed with URLs
 *                  wherein the posted value can be any
 *                  JSON serializable object.
 * @return promise for the return value
 */
// bound locally because it is used by other methods
Q.mapply = // XXX As proposed by "Redsandro"
Q.post = function (object, name, args) {
    return Q(object).dispatch("post", [name, args]);
};

Promise.prototype.mapply = // XXX As proposed by "Redsandro"
Promise.prototype.post = function (name, args) {
    return this.dispatch("post", [name, args]);
};

/**
 * Invokes a method in a future turn.
 * @param object    promise or immediate reference for target object
 * @param name      name of method to invoke
 * @param ...args   array of invocation arguments
 * @return promise for the return value
 */
Q.send = // XXX Mark Miller's proposed parlance
Q.mcall = // XXX As proposed by "Redsandro"
Q.invoke = function (object, name /*...args*/) {
    return Q(object).dispatch("post", [name, array_slice(arguments, 2)]);
};

Promise.prototype.send = // XXX Mark Miller's proposed parlance
Promise.prototype.mcall = // XXX As proposed by "Redsandro"
Promise.prototype.invoke = function (name /*...args*/) {
    return this.dispatch("post", [name, array_slice(arguments, 1)]);
};

/**
 * Applies the promised function in a future turn.
 * @param object    promise or immediate reference for target function
 * @param args      array of application arguments
 */
Q.fapply = function (object, args) {
    return Q(object).dispatch("apply", [void 0, args]);
};

Promise.prototype.fapply = function (args) {
    return this.dispatch("apply", [void 0, args]);
};

/**
 * Calls the promised function in a future turn.
 * @param object    promise or immediate reference for target function
 * @param ...args   array of application arguments
 */
Q["try"] =
Q.fcall = function (object /* ...args*/) {
    return Q(object).dispatch("apply", [void 0, array_slice(arguments, 1)]);
};

Promise.prototype.fcall = function (/*...args*/) {
    return this.dispatch("apply", [void 0, array_slice(arguments)]);
};

/**
 * Binds the promised function, transforming return values into a fulfilled
 * promise and thrown errors into a rejected one.
 * @param object    promise or immediate reference for target function
 * @param ...args   array of application arguments
 */
Q.fbind = function (object /*...args*/) {
    var promise = Q(object);
    var args = array_slice(arguments, 1);
    return function fbound() {
        return promise.dispatch("apply", [
            this,
            args.concat(array_slice(arguments))
        ]);
    };
};
Promise.prototype.fbind = function (/*...args*/) {
    var promise = this;
    var args = array_slice(arguments);
    return function fbound() {
        return promise.dispatch("apply", [
            this,
            args.concat(array_slice(arguments))
        ]);
    };
};

/**
 * Requests the names of the owned properties of a promised
 * object in a future turn.
 * @param object    promise or immediate reference for target object
 * @return promise for the keys of the eventually settled object
 */
Q.keys = function (object) {
    return Q(object).dispatch("keys", []);
};

Promise.prototype.keys = function () {
    return this.dispatch("keys", []);
};

/**
 * Turns an array of promises into a promise for an array.  If any of
 * the promises gets rejected, the whole array is rejected immediately.
 * @param {Array*} an array (or promise for an array) of values (or
 * promises for values)
 * @returns a promise for an array of the corresponding values
 */
// By Mark Miller
// http://wiki.ecmascript.org/doku.php?id=strawman:concurrency&rev=1308776521#allfulfilled
Q.all = all;
function all(promises) {
    return when(promises, function (promises) {
        var countDown = 0;
        var deferred = defer();
        array_reduce(promises, function (undefined, promise, index) {
            var snapshot;
            if (
                isPromise(promise) &&
                (snapshot = promise.inspect()).state === "fulfilled"
            ) {
                promises[index] = snapshot.value;
            } else {
                ++countDown;
                when(
                    promise,
                    function (value) {
                        promises[index] = value;
                        if (--countDown === 0) {
                            deferred.resolve(promises);
                        }
                    },
                    deferred.reject,
                    function (progress) {
                        deferred.notify({ index: index, value: progress });
                    }
                );
            }
        }, void 0);
        if (countDown === 0) {
            deferred.resolve(promises);
        }
        return deferred.promise;
    });
}

Promise.prototype.all = function () {
    return all(this);
};

/**
 * Waits for all promises to be settled, either fulfilled or
 * rejected.  This is distinct from `all` since that would stop
 * waiting at the first rejection.  The promise returned by
 * `allResolved` will never be rejected.
 * @param promises a promise for an array (or an array) of promises
 * (or values)
 * @return a promise for an array of promises
 */
Q.allResolved = deprecate(allResolved, "allResolved", "allSettled");
function allResolved(promises) {
    return when(promises, function (promises) {
        promises = array_map(promises, Q);
        return when(all(array_map(promises, function (promise) {
            return when(promise, noop, noop);
        })), function () {
            return promises;
        });
    });
}

Promise.prototype.allResolved = function () {
    return allResolved(this);
};

/**
 * @see Promise#allSettled
 */
Q.allSettled = allSettled;
function allSettled(promises) {
    return Q(promises).allSettled();
}

/**
 * Turns an array of promises into a promise for an array of their states (as
 * returned by `inspect`) when they have all settled.
 * @param {Array[Any*]} values an array (or promise for an array) of values (or
 * promises for values)
 * @returns {Array[State]} an array of states for the respective values.
 */
Promise.prototype.allSettled = function () {
    return this.then(function (promises) {
        return all(array_map(promises, function (promise) {
            promise = Q(promise);
            function regardless() {
                return promise.inspect();
            }
            return promise.then(regardless, regardless);
        }));
    });
};

/**
 * Captures the failure of a promise, giving an oportunity to recover
 * with a callback.  If the given promise is fulfilled, the returned
 * promise is fulfilled.
 * @param {Any*} promise for something
 * @param {Function} callback to fulfill the returned promise if the
 * given promise is rejected
 * @returns a promise for the return value of the callback
 */
Q.fail = // XXX legacy
Q["catch"] = function (object, rejected) {
    return Q(object).then(void 0, rejected);
};

Promise.prototype.fail = // XXX legacy
Promise.prototype["catch"] = function (rejected) {
    return this.then(void 0, rejected);
};

/**
 * Attaches a listener that can respond to progress notifications from a
 * promise's originating deferred. This listener receives the exact arguments
 * passed to ``deferred.notify``.
 * @param {Any*} promise for something
 * @param {Function} callback to receive any progress notifications
 * @returns the given promise, unchanged
 */
Q.progress = progress;
function progress(object, progressed) {
    return Q(object).then(void 0, void 0, progressed);
}

Promise.prototype.progress = function (progressed) {
    return this.then(void 0, void 0, progressed);
};

/**
 * Provides an opportunity to observe the settling of a promise,
 * regardless of whether the promise is fulfilled or rejected.  Forwards
 * the resolution to the returned promise when the callback is done.
 * The callback can return a promise to defer completion.
 * @param {Any*} promise
 * @param {Function} callback to observe the resolution of the given
 * promise, takes no arguments.
 * @returns a promise for the resolution of the given promise when
 * ``fin`` is done.
 */
Q.fin = // XXX legacy
Q["finally"] = function (object, callback) {
    return Q(object)["finally"](callback);
};

Promise.prototype.fin = // XXX legacy
Promise.prototype["finally"] = function (callback) {
    callback = Q(callback);
    return this.then(function (value) {
        return callback.fcall().then(function () {
            return value;
        });
    }, function (reason) {
        // TODO attempt to recycle the rejection with "this".
        return callback.fcall().then(function () {
            throw reason;
        });
    });
};

/**
 * Terminates a chain of promises, forcing rejections to be
 * thrown as exceptions.
 * @param {Any*} promise at the end of a chain of promises
 * @returns nothing
 */
Q.done = function (object, fulfilled, rejected, progress) {
    return Q(object).done(fulfilled, rejected, progress);
};

Promise.prototype.done = function (fulfilled, rejected, progress) {
    var onUnhandledError = function (error) {
        // forward to a future turn so that ``when``
        // does not catch it and turn it into a rejection.
        nextTick(function () {
            makeStackTraceLong(error, promise);
            if (Q.onerror) {
                Q.onerror(error);
            } else {
                throw error;
            }
        });
    };

    // Avoid unnecessary `nextTick`ing via an unnecessary `when`.
    var promise = fulfilled || rejected || progress ?
        this.then(fulfilled, rejected, progress) :
        this;

    if (typeof process === "object" && process && process.domain) {
        onUnhandledError = process.domain.bind(onUnhandledError);
    }

    promise.then(void 0, onUnhandledError);
};

/**
 * Causes a promise to be rejected if it does not get fulfilled before
 * some milliseconds time out.
 * @param {Any*} promise
 * @param {Number} milliseconds timeout
 * @param {String} custom error message (optional)
 * @returns a promise for the resolution of the given promise if it is
 * fulfilled before the timeout, otherwise rejected.
 */
Q.timeout = function (object, ms, message) {
    return Q(object).timeout(ms, message);
};

Promise.prototype.timeout = function (ms, message) {
    var deferred = defer();
    var timeoutId = setTimeout(function () {
        deferred.reject(new Error(message || "Timed out after " + ms + " ms"));
    }, ms);

    this.then(function (value) {
        clearTimeout(timeoutId);
        deferred.resolve(value);
    }, function (exception) {
        clearTimeout(timeoutId);
        deferred.reject(exception);
    }, deferred.notify);

    return deferred.promise;
};

/**
 * Returns a promise for the given value (or promised value), some
 * milliseconds after it resolved. Passes rejections immediately.
 * @param {Any*} promise
 * @param {Number} milliseconds
 * @returns a promise for the resolution of the given promise after milliseconds
 * time has elapsed since the resolution of the given promise.
 * If the given promise rejects, that is passed immediately.
 */
Q.delay = function (object, timeout) {
    if (timeout === void 0) {
        timeout = object;
        object = void 0;
    }
    return Q(object).delay(timeout);
};

Promise.prototype.delay = function (timeout) {
    return this.then(function (value) {
        var deferred = defer();
        setTimeout(function () {
            deferred.resolve(value);
        }, timeout);
        return deferred.promise;
    });
};

/**
 * Passes a continuation to a Node function, which is called with the given
 * arguments provided as an array, and returns a promise.
 *
 *      Q.nfapply(FS.readFile, [__filename])
 *      .then(function (content) {
 *      })
 *
 */
Q.nfapply = function (callback, args) {
    return Q(callback).nfapply(args);
};

Promise.prototype.nfapply = function (args) {
    var deferred = defer();
    var nodeArgs = array_slice(args);
    nodeArgs.push(deferred.makeNodeResolver());
    this.fapply(nodeArgs).fail(deferred.reject);
    return deferred.promise;
};

/**
 * Passes a continuation to a Node function, which is called with the given
 * arguments provided individually, and returns a promise.
 * @example
 * Q.nfcall(FS.readFile, __filename)
 * .then(function (content) {
 * })
 *
 */
Q.nfcall = function (callback /*...args*/) {
    var args = array_slice(arguments, 1);
    return Q(callback).nfapply(args);
};

Promise.prototype.nfcall = function (/*...args*/) {
    var nodeArgs = array_slice(arguments);
    var deferred = defer();
    nodeArgs.push(deferred.makeNodeResolver());
    this.fapply(nodeArgs).fail(deferred.reject);
    return deferred.promise;
};

/**
 * Wraps a NodeJS continuation passing function and returns an equivalent
 * version that returns a promise.
 * @example
 * Q.nfbind(FS.readFile, __filename)("utf-8")
 * .then(console.log)
 * .done()
 */
Q.nfbind =
Q.denodeify = function (callback /*...args*/) {
    var baseArgs = array_slice(arguments, 1);
    return function () {
        var nodeArgs = baseArgs.concat(array_slice(arguments));
        var deferred = defer();
        nodeArgs.push(deferred.makeNodeResolver());
        Q(callback).fapply(nodeArgs).fail(deferred.reject);
        return deferred.promise;
    };
};

Promise.prototype.nfbind =
Promise.prototype.denodeify = function (/*...args*/) {
    var args = array_slice(arguments);
    args.unshift(this);
    return Q.denodeify.apply(void 0, args);
};

Q.nbind = function (callback, thisp /*...args*/) {
    var baseArgs = array_slice(arguments, 2);
    return function () {
        var nodeArgs = baseArgs.concat(array_slice(arguments));
        var deferred = defer();
        nodeArgs.push(deferred.makeNodeResolver());
        function bound() {
            return callback.apply(thisp, arguments);
        }
        Q(bound).fapply(nodeArgs).fail(deferred.reject);
        return deferred.promise;
    };
};

Promise.prototype.nbind = function (/*thisp, ...args*/) {
    var args = array_slice(arguments, 0);
    args.unshift(this);
    return Q.nbind.apply(void 0, args);
};

/**
 * Calls a method of a Node-style object that accepts a Node-style
 * callback with a given array of arguments, plus a provided callback.
 * @param object an object that has the named method
 * @param {String} name name of the method of object
 * @param {Array} args arguments to pass to the method; the callback
 * will be provided by Q and appended to these arguments.
 * @returns a promise for the value or error
 */
Q.nmapply = // XXX As proposed by "Redsandro"
Q.npost = function (object, name, args) {
    return Q(object).npost(name, args);
};

Promise.prototype.nmapply = // XXX As proposed by "Redsandro"
Promise.prototype.npost = function (name, args) {
    var nodeArgs = array_slice(args || []);
    var deferred = defer();
    nodeArgs.push(deferred.makeNodeResolver());
    this.dispatch("post", [name, nodeArgs]).fail(deferred.reject);
    return deferred.promise;
};

/**
 * Calls a method of a Node-style object that accepts a Node-style
 * callback, forwarding the given variadic arguments, plus a provided
 * callback argument.
 * @param object an object that has the named method
 * @param {String} name name of the method of object
 * @param ...args arguments to pass to the method; the callback will
 * be provided by Q and appended to these arguments.
 * @returns a promise for the value or error
 */
Q.nsend = // XXX Based on Mark Miller's proposed "send"
Q.nmcall = // XXX Based on "Redsandro's" proposal
Q.ninvoke = function (object, name /*...args*/) {
    var nodeArgs = array_slice(arguments, 2);
    var deferred = defer();
    nodeArgs.push(deferred.makeNodeResolver());
    Q(object).dispatch("post", [name, nodeArgs]).fail(deferred.reject);
    return deferred.promise;
};

Promise.prototype.nsend = // XXX Based on Mark Miller's proposed "send"
Promise.prototype.nmcall = // XXX Based on "Redsandro's" proposal
Promise.prototype.ninvoke = function (name /*...args*/) {
    var nodeArgs = array_slice(arguments, 1);
    var deferred = defer();
    nodeArgs.push(deferred.makeNodeResolver());
    this.dispatch("post", [name, nodeArgs]).fail(deferred.reject);
    return deferred.promise;
};

/**
 * If a function would like to support both Node continuation-passing-style and
 * promise-returning-style, it can end its internal promise chain with
 * `nodeify(nodeback)`, forwarding the optional nodeback argument.  If the user
 * elects to use a nodeback, the result will be sent there.  If they do not
 * pass a nodeback, they will receive the result promise.
 * @param object a result (or a promise for a result)
 * @param {Function} nodeback a Node.js-style callback
 * @returns either the promise or nothing
 */
Q.nodeify = nodeify;
function nodeify(object, nodeback) {
    return Q(object).nodeify(nodeback);
}

Promise.prototype.nodeify = function (nodeback) {
    if (nodeback) {
        this.then(function (value) {
            nextTick(function () {
                nodeback(null, value);
            });
        }, function (error) {
            nextTick(function () {
                nodeback(error);
            });
        });
    } else {
        return this;
    }
};

// All code before this point will be filtered from stack traces.
var qEndingLine = captureLine();

return Q;

});
(function(w){
"use strict";

function define_stargate(){

// Public Stargate Object
var s = {};

//////////////////////////////////////
// Android store
function AndroidIosStore(androidApplicationLicenseKey, platform)
{
	this.onpurchasesuccess = null;
	this.onpurchasefail = null;
	
	this.onconsumesuccess = null;
	this.onconsumefail = null;
	
	this.onstorelistingsuccess = null;
	this.onstorelistingfail = null;

	this.onrestorepurchasessuccess = null;
	this.onrestorepurchasesfail = null;
	
	this.product_id_list = [];
	
	this.existing_purchases = [];
	
	this.product_info = {};		// map product id to info

	this.androidApplicationLicenseKey = androidApplicationLicenseKey;
	
	this.initialized = false;

	this.platform = platform;
	
	window.iap.setUp(this.androidApplicationLicenseKey);		
}

AndroidIosStore.prototype.addProductIds = function (idstring)
{
	if (idstring.indexOf(",") === -1) {
		if (this.product_id_list.indexOf(idstring) === -1) {
			this.product_id_list.push(idstring);
		}
	}
	else {
		var arr = idstring.split(",");
		for (var i = 0 ; i < arr.length ; i++) {
			
			if (this.product_id_list.indexOf(arr[i]) === -1) {
				this.product_id_list.push(arr[i]);				
			}
		}
	}
};

AndroidIosStore.prototype.hasProduct = function (product_)
{
	return this.existing_purchases.indexOf(product_) !== -1;
};

AndroidIosStore.prototype.purchaseProduct = function (product_)
{
	var self = this;
	//https://github.com/Wizcorp/phonegap-plugin-wizPurchase/blob/46f32fdf0be4f9c5837fe873efe5d06bf70c6819/www/phonegap/plugin/wizPurchasePlugin/wizPurchasePlugin.js
	//https://github.com/Wizcorp/phonegap-plugin-wizPurchase/tree/46f32fdf0be4f9c5837fe873efe5d06bf70c6819
	window.iap.purchaseProduct(product_, function (result)
	{
		for (var attrname in result) {
        	console.log("[IAP] purchaseProduct result details: '"+attrname+"' = '"+result[attrname]+"'");
        }
		// on success
		if (self.existing_purchases.indexOf(product_) === -1) {
			self.existing_purchases.push(product_);			
		}
		
		if (self.onpurchasesuccess) {
			self.onpurchasesuccess(product_, result);			
		}
		
	},
	function (error)
	{
		console.error("[IAP] purchaseProduct error: " + error);

		// on error
		if (self.onpurchasefail) {
			self.onpurchasefail(product_, error);			
		}
	});
};

AndroidIosStore.prototype.restorePurchases = function ()
{
	var self = this;

	//alert("debug restorePurchases0");
	window.iap.restorePurchases(function (result)
	{
		//alert("debug restorePurchases1: "+JSON.stringify(result));	
	
		// on success
		var i, p;
		for (i= 0 ; i < result.length; ++i)
		{
			p = result[i];				
			//alert("debug restorePurchases2: "+JSON.stringify(p));		
		
			if (self.existing_purchases.indexOf(p.productId) === -1) {
				self.existing_purchases.push(p.productId);				
			}
		}
		
		if (self.onrestorepurchasessuccess) {
			self.onrestorepurchasessuccess();			
		}
	}, 
	function (error)
	{
		//alert("debug restorePurchases3: "+JSON.stringify(error));
		console.error("[IAP] restorePurchases error: " + error);
		
		if (self.onrestorepurchasesfail) {
			self.onrestorepurchasesfail();			
		}
	});
	//alert("debug restorePurchases4");
};

AndroidIosStore.prototype.requestStoreListing = function ()
{
	var self = this;
	
	window.iap.requestStoreListing(self.product_id_list, function (result)
	{
/*
[
{
    "productId": "shield001",
    "title": "Shield of Peanuts",
    "price": "Formatted price of the item, including its currency sign.",
    "description": "A shield made entirely of peanuts."
}

iap.requestStoreListing("com.buongiorno.hybrid.game.test.skyshield.noads", function(a){console.log("success",a)}, function(e){console.error(e)})

success
 [Object]0: Object
   description: "No Ads for Skyshield Test"
   price: "0,50 €"
   productId: "com.buongiorno.hybrid.game.test.skyshield.noads"
   title: "No Ads (Skyshield Test)"
   json: Object
     description: "No Ads for Skyshield Test"
     price: "0,50 €"
     price_amount_micros: 500000
     price_currency_code: "EUR"
     productId: "com.buongiorno.hybrid.game.test.skyshield.noads"
     title: "No Ads (Skyshield Test)
     type: "inapp"
]
*/
		//alert("debug requestStoreListing1: "+JSON.stringify(result));//debug for Caleb
		
		for (var i = 0 ; i < result.length; ++i)
		{
			var p = result[i];
			//alert("debug requestStoreListing2: "+JSON.stringify(p));

			self.product_info[p.productId] = {
				title: p.title,
				price: p.price,
				price_amount_cent: 0,
				price_currency_code: "",
				type: "inapp"
			};

			var priceCent = '';
			if (self.platform === 'android') {
				priceCent = p.json.price_amount_micros / 10000;
				self.product_info[p.productId].price_amount_cent = priceCent;
				self.product_info[p.productId].price_currency_code = p.json.price_currency_code;
				self.product_info[p.productId].type = p.json.type;
			} else if (self.platform === 'ios') {
                priceCent = p.price_amount * 100;
                self.product_info[p.productId].price_amount_cent = priceCent;
                self.product_info[p.productId].price_currency_code = p.price_currency_code;
			}
		}
		
		if (self.onstorelistingsuccess) {
			self.onstorelistingsuccess();
		}
	}, function (error)
	{
		console.error("[IAP] requestStoreListing error: " + error + " | product_id_list: " + self.product_id_list);
		//alert("debug requestStoreListing3: "+JSON.stringify(error));
		if (self.onstorelistingfail) {
			self.onstorelistingfail();
		}
	});
	//alert("debug requestStoreListing4");		
};

AndroidIosStore.prototype.getProductName = function (product_)
{
	if (this.product_info.hasOwnProperty(product_)) {
		return this.product_info[product_].title;
	}
	else {
		console.warn("[StargateIAP] product not available: "+product_);
		return "";			
	}
};
AndroidIosStore.prototype.getProductAmountCent = function (product_)
{
	if (this.product_info.hasOwnProperty(product_)) {
		return this.product_info[product_].price_amount_cent;
	}
	else {
		console.warn("[StargateIAP] product not available: "+product_);
		return 0;			
	}
};
AndroidIosStore.prototype.getProductCurrency = function (product_)
{
	if (this.product_info.hasOwnProperty(product_)) {
		return this.product_info[product_].price_currency_code;
	}
	else {
		console.warn("[StargateIAP] product not available: "+product_);
		return 0;			
	}
};
AndroidIosStore.prototype.getProductType = function (product_)
{
	if (this.product_info.hasOwnProperty(product_)) {
		return this.product_info[product_].type;
	}
	else {
		console.warn("[StargateIAP] product not available: "+product_);
		return 0;			
	}
};

AndroidIosStore.prototype.getProductFormattedPrice = function (product_)
{
	// may not be immediately available in onstorelistingsuccess...
	if (this.product_info.hasOwnProperty(product_)) {
		return this.product_info[product_].price.toString();
	}
	else {
		return "";
	}
};


/* global AndroidStore, Q */

/***
* 
* Stargate initialization steps:
*  
*  1)   set options in the 'stargate.options' and 
*        callbacks in the 'stargate.calbacks' globals
*
*  2)   call stargate.init() method and wait the promise
*
*  3)   when the promise is resolved: 
*       
*       *) (if you want to leave the application splashscreen when loading)
*          load your game assets, then call stargate.hideSplashScreen()
* 
*       *) (if you want to show your loader to the user)
*          call stargate.hideSplashScreen() and show your loader GUI
* 
*  4)   call stargate.gameIsLoaded() when the loader if finished and
*        user is in main menu
* 
*/


// logger function
var log = function(msg, obj) {
    if (typeof obj !== 'undefined') {
        console.log("[Stargate] "+msg+" ",obj);
    } else {
        console.log("[Stargate] "+msg);
    }
    return true;
};
var err = function(msg, obj) {
    if (typeof obj !== 'undefined') {
        console.error("[Stargate] "+msg+" ",obj);
    } else {
        console.error("[Stargate] "+msg);
    }
    return false;
};

// device informations   // examples
var runningDevice = {
    available: false,    // true
    cordova: "",         // 4.1.1
    manufacturer: "",    // samsung
    model: "",           // GT-I9505
    platform: "",        // Android
    uuid: "",            // ac7245e38e3dfecb
    version: ""          // 5.0.1
};
var isRunningOnAndroid = function() {
    return runningDevice.platform == "Android";
};
var isRunningOnIos = function() {
    return runningDevice.platform == "iOS";
};
var isRunningOnCordova = function () {
    return (typeof w.cordova !== "undefined");
};

// public stargate options to be set before init()
s.options = {};
s.options.deltadnaEnabled = false;
s.options.deltadnaEnviromentKey = '';
s.options.deltadnaCollectHostName = '';
s.options.deltadnaEngageHostName = '';
s.options.deltadnaOnStartSendGameStartedEvent = true;
s.options.deltadnaOnFirstRunSendNewPlayerEvent = true;
s.options.mixpanelEnabled = false;
s.options.gameEnabled = false;
s.options.iapEnabled = false;
s.options.iapAndroidLicenseKey = '';
s.options.appsflyerEnabled = false;
s.options.appsflyerDevkey = '';
s.options.iosItunesAppId = '';
s.options.heyzapEnabled = false;
s.options.heyzapPublisherId = '';
s.options.cordovaHideStatusBar = false;

// options are sealed after init(), we save them here, so inside stargate use this variable
var savedOptions = {};

// public stargate callbacks: 
//  function that will be called when something on the application occurs
//  to be set before init()
s.callbacks = {};
s.callbacks.pushNotification = function(data) {err("pushNotification callback not defined");};
/**
* stargate.callbacks.androidBackButton: <Function>: boolean function()
*  callback called when android back button is pressed
*  if the callback return [true] then application is closed
*/
s.callbacks.androidBackButton = null;
s.callbacks.engageSuccess = function(data) {err("engageSuccess callback not defined");};        
s.callbacks.engageFailure = null;
s.callbacks.iap = {};
s.callbacks.iap.purchaseSuccess = null;
s.callbacks.iap.purchaseFail = null;
s.callbacks.iap.listingSuccess = null;
s.callbacks.iap.listingFail = null;
s.callbacks.iap.restoreSuccess = null;
s.callbacks.iap.restoreFail = null;

//
// call back handlers
// 

var stargatePushData = {};
var isGameLoaded = false;

var savePushNotificationData = function(data, type) {
    if (typeof data !== 'object') {
        data = {"_empty":true};
    }
    data["_type"] = type;
    stargatePushData = data;
};
var callPushNotificationCallback = function() {
    if (typeof w.stargate.callbacks.pushNotification !== 'function') {
        return err("stargate.callbacks.pushNotification not callable!");
    }
    
    if (isGameLoaded) {
        w.stargate.callbacks.pushNotification(stargatePushData);
        stargatePushData = {};
    }
};
var callAndroidBackButtonCallback = function(e) {
    if (typeof w.stargate.callbacks.androidBackButton !== 'function') {
        e.preventDefault();
        return err("stargate.callbacks.androidBackButton not callable!");
    }
    var exitApp = w.stargate.callbacks.androidBackButton();
    if (exitApp) {
        e.preventDefault();
        navigator.app.exitApp();
    }
    return true;
};
var callEngageSuccessCallback = function(decisionPoint, response) {
    if (typeof w.stargate.callbacks.engageSuccess !== 'function') {
        return err("stargate.callbacks.engageSuccess not callable!");
    }
    if (typeof response !== 'object') {
        response = {"_empty":true};
    }
    
    w.stargate.callbacks.engageSuccess(decisionPoint, response);
};
var callEngageFailureCallback = function(errorResponse) {
    if (typeof w.stargate.callbacks.engageFailure === 'function') {
        w.stargate.callbacks.engageFailure(errorResponse);
    }
};

var callIapPurchaseSuccessCallback = function(product, result) {
    log("[IAP] purchase Success for product: "+product, result);
    if (typeof w.stargate.callbacks.iap.purchaseSuccess === 'function') {
        w.stargate.callbacks.iap.purchaseSuccess(product, result);
    }
}
var callIapPurchaseFailCallback = function(product, error) {
    err("[IAP] purchase Fail for product: "+product, error);
    if (typeof w.stargate.callbacks.iap.purchaseFail === 'function') {
        w.stargate.callbacks.iap.purchaseFail(product, error);
    }
}
var callIapListingSuccessCallback = function() {
    log("[IAP] listing Success");
    if (typeof w.stargate.callbacks.iap.listingSuccess === 'function') {
        w.stargate.callbacks.iap.listingSuccess();
    }
}
var callIapListingFailCallback = function() {
    err("[IAP] listing Fail");
    if (typeof w.stargate.callbacks.iap.listingFail === 'function') {
        w.stargate.callbacks.iap.listingFail();
    }
}
var callIapRestoreSuccessCallback = function() {
    log("[IAP] restore Success");
    if (typeof w.stargate.callbacks.iap.restoreSuccess === 'function') {
        w.stargate.callbacks.iap.restoreSuccess();
    }
}
var callIapRestoreFailCallback = function() {
    err("[IAP] restore Fail");
    if (typeof w.stargate.callbacks.iap.restoreFail === 'function') {
        w.stargate.callbacks.iap.restoreFail();
    }
}


var initDevice = function() {
    if (typeof w.device === 'undefined') {
        return err("Missing cordova device plugin");
    }
    for (var key in runningDevice) {
        if (w.device.hasOwnProperty(key)) {
            runningDevice[key] = w.device[key];
        }
    }
    return true;
};

var initCordova = function() {
    
    if (savedOptions.cordovaHideStatusBar) {
        if (typeof w.StatusBar === 'undefined') {
            err("Missing cordova statusbar plugin");
        } else {
            log("[Cordova] Hiding statusbar");
            w.StatusBar.hide();
        }
    }
    
    if (typeof w.stargate.callbacks.androidBackButton === 'function') {
        document.addEventListener(
            'backbutton',
            function(e){
                log("[Cordova] backbutton pressed");
                callAndroidBackButtonCallback(e);
            },
            false
        );
    }

    // FIXME: add other event listner:
    //  https://cordova.apache.org/docs/en/4.0.0/cordova/events/events.html

    return true;
};

// -----------------------------
//       ANALITICS START
// -----------------------------
var initDeltadna = function() {
    if (!savedOptions.deltadnaEnabled) {
        return;
    }
    if (!!!savedOptions.deltadnaEnviromentKey) {
        throw new Error("Delta dna enviromentKey undefined");
    }
    if (!!!savedOptions.deltadnaCollectHostName) {
        throw new Error("Delta dna collectHostName undefined"); 
    }
    if (!!!savedOptions.deltadnaEngageHostName) {
        throw new Error("Delta dna engageHostName undefined"); 
    }
    if (typeof w.deltadna == 'undefined') {
        throw new Error("Deltadna Undefined, missing cordova plugin ?");
    }
    var deltaDNAsettings = {
        "onStartSendGameStartedEvent":!!(savedOptions.deltadnaOnStartSendGameStartedEvent),
        "onFirstRunSendNewPlayerEvent":!!(savedOptions.deltadnaOnFirstRunSendNewPlayerEvent)  
    };

    w.deltadna.startSDK(
        savedOptions.deltadnaEnviromentKey,
        savedOptions.deltadnaCollectHostName,
        savedOptions.deltadnaEngageHostName, 
        function(result){log("[DeltaDNA] startSDK Ok ",result);}, 
        function(error){err("[DeltaDNA] startSDK ERROR ",error);}, 
        deltaDNAsettings
    );
            
    w.deltadna.registerPushCallback(function(data){
        
        savePushNotificationData(data, "deltadna");
        callPushNotificationCallback();
    });
};

// analitics private varible
var deltaEngageParams = {};
var analiticsEventProperties = {};
var analiticsTransactionProperties = {};

s.analitics = {};
s.analitics.addEventProperty = function(propertyName, propertyValue) {
    analiticsEventProperties[propertyName] = propertyValue;
};
s.analitics.trackEvent = function(eventName) {

    if(savedOptions.deltadnaEnabled){
        log("[analitics.trackEvent] Sending to DeltaDNA: " + eventName);

        if (isRunningOnCordova()) {
            //we sanitize JSON on native side
            w.deltadna.recordEvent(
                eventName,
                analiticsEventProperties,
                function(result){log("[DeltaDNA] recordEvent Ok ",result);}, 
                function(error){err("[DeltaDNA] recordEvent ERROR ",error);}
            );
        }
    }

    if(savedOptions.mixpanelEnabled){
        log("[analitics.trackEvent] Sending to Mixpanel: " + eventName);

        if (isRunningOnCordova()) {
            w.mixpanel.track(
                eventName,
                analiticsEventProperties,
                function(result){log("[Mixpanel] track Ok ",result);}, 
                function(error){err("[Mixpanel] track ERROR ",error);}
            );
        } else {
            w.mixpanel.track(eventName, analiticsEventProperties);
        }
    }
    // clear already sent event properties
    analiticsEventProperties = {};
};
s.analitics.addEngagementParam = function(paramName, paramValue) {
    deltaEngageParams[paramName] = paramValue;
};
s.analitics.requestEngagement = function(decisionPoint) {

    var obj = {"decisionPoint":decisionPoint, "params":deltaEngageParams};
    
    if(isRunningOnCordova() && savedOptions.deltadnaEnabled){
        
        log("[analitics.requestEngagement] Requesting engagement to DeltaDNA on: " + decisionPoint, obj);

        w.deltadna.requestEngagement(
            obj,
            function(response){
                log("[DeltaDNA] requestEngagement Ok ",response);
                callEngageSuccessCallback(decisionPoint, response);
            },
            function(errorResponse){
                err("[DeltaDNA] requestEngagement ERROR ",errorResponse);
                callEngageFailureCallback(errorResponse);
            }
        );
        // clear already sent engage parameters
        deltaEngageParams = {};   
    }
};
s.analitics.addTransactionProperty = function(propertyName, propertyValue) {
    analiticsTransactionProperties[propertyName] = propertyValue;
};
var recordTransaction = function(productId) {
    
    if (!isRunningOnCordova()) {
        return log("[recordTransaction] not available outside device");
    }

    if (!iap.store) {
        return err("Store Undefined: missing configuration?");
    }

    // last succesfully bought product with stargate iap
    var transaction = {
        productId: productId,
        productAmountCent: iap.store.getProductAmountCent(productId),
        productCurrency: iap.store.getProductCurrency(productId),
        productName: iap.store.getProductName(productId),
        id: iap.lastTransactionOrderId,
        type: this.store.getProductType(productId)
    };
    
    if(savedOptions.deltadnaEnabled){
        var revenueValidationEnabled = true;
        log("[recordTransaction] deltaDNA ", transaction);

        if (typeof w.deltadna == 'undefined') {
            return err("Deltadna Undefined: missing cordova plugin?");
        }
        var transactionDeltadna = {
            "transactionName": transaction.productName,
            "transactionType": "PURCHASE",
            "transactionID": transaction.id,
            "productID": transaction.productId,
            "productsSpent": {
                "realCurrency":{
                    "realCurrencyAmount":transaction.productAmountCent,//Will be seen as 0.99
                    "realCurrencyType":transaction.productCurrency
                }
            },
            "productsReceived":{
                "items":[{
                    "item":{
                        "itemName":transaction.productName,
                        "itemAmount":1,
                        "itemType":transaction.type
                    }
                }]
            }
        };
        for (var attrname in analiticsTransactionProperties) {
            transactionDeltadna[attrname] = analiticsTransactionProperties[attrname];
        }

        if (revenueValidationEnabled) {
            transactionDeltadna["transactionServer"] = "UNKNOWN";
            transactionDeltadna["transactionReceipt"] = iap.lastTransactionReceipt;
            if (isRunningOnIos()) {
                transactionDeltadna["transactionServer"] = "APPLE";
            }
            if (isRunningOnAndroid()) {
                transactionDeltadna["transactionServer"] = "GOOGLE";
                transactionDeltadna["transactionReceipt"] = iap.lastTransactionResult.originalJson;
                transactionDeltadna["transactionReceiptSignature"] = iap.lastTransactionSignature;
            }
        }

        log("[recordTransaction] DeltaDNA recordTransaction sending to native: ", transactionDeltadna);

        w.deltadna.recordTransaction(
            transactionDeltadna,
            function(result){
                log("[DeltaDNA] recordTransaction completed ", result);
            },
            function(error){
                err("[DeltaDNA] recordTransaction error!", error);
            }
        );

    }
    if(savedOptions.mixpanelEnabled){
        if (typeof w.mixpanel == 'undefined') {
            return err("Mixpanel Undefined: missing cordova plugin?");
        }
        var timestamp = new Date().toISOString().substring(0, 19);
        var amount = Math.round(transaction.productAmountCent * 100) / 100;
        log("[recordTransaction] mixpanel amount: "+amount+", ts: "+timestamp);
        w.mixpanel.trackCharge(
            amount,
            {"$time":timestamp},
            function(result){
                log("[DeltaDNA] recordTransaction completed ", result);
            },
            function(error){
                err("[DeltaDNA] recordTransaction error!", error);
            }
        );
    }
    analiticsTransactionProperties = {};

};
// -----------------------------
//       ANALITICS END
// -----------------------------

var splashScreenHideCalled = false;
s.hideSplashScreen = function() {
    if (! isRunningOnCordova())
        return;

    if (typeof w.navigator == 'undefined' || typeof w.navigator.splashscreen == 'undefined')
        return err("splashscreen undefined, missing cordova plugin ?");
    
    splashScreenHideCalled = true;
    w.navigator.splashscreen.hide();
};

// -----------------------------
//         IAP START
// -----------------------------
// FIXME: add iap code from construct 2 plugin
var iap = {};
iap.store = null;
iap.lastTransactionOrderId = "";
iap.lastTransactionReceipt = "";
iap.lastTransactionSignature = "";
iap.lastTransactionResult = {};

var initIap = function() {

    if (!savedOptions.iapEnabled) {
        return;
    }
    if (!!!savedOptions.iapAndroidLicenseKey) {
        throw new Error("Iap Android License Key undefined");
    }

    if (typeof w.iap == 'undefined') {
        throw new Error("Iap Undefined, missing cordova plugin ?");
    }

    if (isRunningOnAndroid()) {
        iap.store = new AndroidStore(savedOptions.iapAndroidLicenseKey, 'android');
    }
    else if (isRunningOnIos()) {
        iap.store = new AndroidStore(savedOptions.iapAndroidLicenseKey, 'ios');
    }
    else {
        throw new Error("Platform not supported!");
    }
    
    iap.store.onpurchasesuccess = function(product, result) {
        
        iap.lastTransactionResult = result;
        iap.lastTransactionOrderId = result.orderId;
        iap.lastTransactionReceipt = result.receipt;
        if (result.signature) {
            iap.lastTransactionSignature = result.signature;
        } else {
            iap.lastTransactionSignature = "";
        }

        // record the transaction on analitics services
        recordTransaction(product);

        callIapPurchaseSuccessCallback(product, result);
    };
    
    iap.store.onpurchasefail = function(product, error) {
        callIapPurchaseFailCallback(product, error);
    };
    
    iap.store.onstorelistingsuccess = function () {
        callIapListingSuccessCallback();
    };
    
    iap.store.onstorelistingfail = function () {
        callIapListingFailCallback();
    };
    iap.store.onrestorepurchasessuccess = function (tag) {
        callIapRestoreSuccessCallback();
    };
    
    iap.store.onrestorepurchasesfail = function (tag) {
        callIapRestoreFailCallback();
    };
};

s.iap = {};

/**
*    addProductId(productId): 
*       add every product you want to use later
*       you have to call this before requestStoreListing
*/
s.iap.addProductId = function(productIds) {
    if (! isRunningOnCordova()) return;
    if (typeof w.iap == 'undefined') return err("iap undefined, missing cordova plugin ?");
    return iap.store && iap.store.addProductIds(productIds);
};

/**
*    requestStoreListing(): 
*       get information from the store for added product id
*       on finish success or fail it will call the saved callbacks
*/
s.iap.requestStoreListing = function() {
    if (! isRunningOnCordova()) return;
    if (typeof w.iap == 'undefined') return err("iap undefined, missing cordova plugin ?");
    return iap.store && iap.store.requestStoreListing();
};

/**
*    purchaseProductId(productId): 
*       purchase a productId
*       on finish success or fail it will call the saved callbacks
*/
s.iap.purchaseProductId = function(productId) {
    if (! isRunningOnCordova()) return;
    if (typeof w.iap == 'undefined') return err("iap undefined, missing cordova plugin ?");
    return iap.store && iap.store.purchaseProduct(productId);
};

/**
*    restorePurchases(): 
*       restore purchases already done by the user on this application
*       on finish success or fail it will call the saved callbacks
*/
s.iap.restorePurchases = function() {
    if (! isRunningOnCordova()) return;
    if (typeof w.iap == 'undefined') return err("iap undefined, missing cordova plugin ?");
    return iap.store && iap.store.restorePurchases();
};

s.iap.getProductName = function(productId) {
    if (! isRunningOnCordova()) return;
    if (typeof w.iap == 'undefined') return err("iap undefined, missing cordova plugin ?");
    return (iap.store ? iap.store.getProductName(productId) : "");
};
s.iap.getProductPrice = function(productId) {
    if (! isRunningOnCordova()) return;
    if (typeof w.iap == 'undefined') return err("iap undefined, missing cordova plugin ?");
    return (iap.store ? iap.store.getProductFormattedPrice(productId) : "");
};



// -----------------------------
//          IAP END
// -----------------------------

/**
*    
* gameIsLoaded(): call it when the game have finished loading, 
*                 it will enable callbacks that need the User Interface
*                 to be ready, like stargate.callbacks.pushNotification
*    
*/
s.gameIsLoaded = function() {
    isGameLoaded = true;

    if (isRunningOnCordova()) {
        // hide again splash screen (if client forget to call it)
        if (!splashScreenHideCalled)
            s.hideSplashScreen();

        // if there are pending push
        if(Object.keys(stargatePushData).length !== 0){
            
            // ... send them to user
            callPushNotificationCallback();
        }

        // FIXME: appsflyer code
        //if (this.installConversionDataLoadedIsToTrigger) {
        //    this.runtime.trigger(cr.plugins_.StargateJS.prototype.cnds.AppsFlyer_OnInstallConversionDataLoaded, this);
        //    this.installConversionDataLoadedIsToTrigger = false;
        //}
    }
};

var initDone = false;
var initDeferred = null;
var initDeviceDone = false;

var onDeviceReady = function () {            
    initDevice();
    initCordova();
    initDeltadna();

    initDeviceDone = true;
    initDeferred.resolve("Init Device Done");
};

/**
*    
* init()  
* @description: call it after setting options, 
*               after init() option will not be
*               read anymore
*
* @return       <Promise> 
*    
*/
s.init = function () {
    initDeferred = Q.defer();

    if (initDone) {
        initDeferred.reject(new Error("Init already called"));
    }
    if (!isRunningOnCordova()) {
        initDeferred.resolve("Not running on Cordova");
        return initDeferred.promise;
    }

    // save options internally, we don't want to let them change after init
    savedOptions = w.stargate.options;

    // finish the initialization of cordova plugin when deviceReady is received
    document.addEventListener('deviceready', onDeviceReady, false);
    
    //
    // FIXME: wait for completition of deviceReady init!!
    //

    initDone = true;
    return initDeferred.promise;
};





return s;
}


//define globally if it doesnt already exist
if(typeof(stargate) === "undefined"){
w.stargate = define_stargate();
}
else{
throw new Error("Stargate already defined.");
}


})(window);