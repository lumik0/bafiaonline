(() => {
  var __create = Object.create;
  var __defProp = Object.defineProperty;
  var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
  var __getOwnPropNames = Object.getOwnPropertyNames;
  var __getProtoOf = Object.getPrototypeOf;
  var __hasOwnProp = Object.prototype.hasOwnProperty;
  var __commonJS = (cb, mod) => function __require() {
    return mod || (0, cb[__getOwnPropNames(cb)[0]])((mod = { exports: {} }).exports, mod), mod.exports;
  };
  var __copyProps = (to, from, except, desc) => {
    if (from && typeof from === "object" || typeof from === "function") {
      for (let key of __getOwnPropNames(from))
        if (!__hasOwnProp.call(to, key) && key !== except)
          __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
    }
    return to;
  };
  var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
    // If the importer is in node compatibility mode or this is not an ESM
    // file that has been converted to a CommonJS file using a Babel-
    // compatible transform (i.e. "__esModule" has not been set), then set
    // "default" to the CommonJS "module.exports" for node compatibility.
    isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
    mod
  ));

  // core/src/lib/js-md5.js
  var require_js_md5 = __commonJS({
    "core/src/lib/js-md5.js"(exports, module) {
      (function() {
        "use strict";
        var INPUT_ERROR = "input is invalid type";
        var FINALIZE_ERROR = "finalize already called";
        var WINDOW = typeof window === "object";
        var root = WINDOW ? window : {};
        if (root.JS_MD5_NO_WINDOW) {
          WINDOW = false;
        }
        var WEB_WORKER = !WINDOW && typeof self === "object";
        var NODE_JS = false;
        if (NODE_JS) {
          root = global;
        } else if (WEB_WORKER) {
          root = self;
        }
        var COMMON_JS = !root.JS_MD5_NO_COMMON_JS && typeof module === "object" && module.exports;
        var AMD = typeof define === "function" && define.amd;
        var ARRAY_BUFFER = !root.JS_MD5_NO_ARRAY_BUFFER && typeof ArrayBuffer !== "undefined";
        var HEX_CHARS = "0123456789abcdef".split("");
        var EXTRA = [128, 32768, 8388608, -2147483648];
        var SHIFT = [0, 8, 16, 24];
        var OUTPUT_TYPES = ["hex", "array", "digest", "buffer", "arrayBuffer", "base64"];
        var BASE64_ENCODE_CHAR = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/".split("");
        var blocks = [], buffer8;
        if (ARRAY_BUFFER) {
          var buffer = new ArrayBuffer(68);
          buffer8 = new Uint8Array(buffer);
          blocks = new Uint32Array(buffer);
        }
        var isArray = Array.isArray;
        if (root.JS_MD5_NO_NODE_JS || !isArray) {
          isArray = function(obj) {
            return Object.prototype.toString.call(obj) === "[object Array]";
          };
        }
        var isView = ArrayBuffer.isView;
        if (ARRAY_BUFFER && (root.JS_MD5_NO_ARRAY_BUFFER_IS_VIEW || !isView)) {
          isView = function(obj) {
            return typeof obj === "object" && obj.buffer && obj.buffer.constructor === ArrayBuffer;
          };
        }
        var formatMessage = function(message) {
          var type = typeof message;
          if (type === "string") {
            return [message, true];
          }
          if (type !== "object" || message === null) {
            throw new Error(INPUT_ERROR);
          }
          if (ARRAY_BUFFER && message.constructor === ArrayBuffer) {
            return [new Uint8Array(message), false];
          }
          if (!isArray(message) && !isView(message)) {
            throw new Error(INPUT_ERROR);
          }
          return [message, false];
        };
        var createOutputMethod = function(outputType) {
          return function(message) {
            return new Md5(true).update(message)[outputType]();
          };
        };
        var createMethod = function() {
          var method = createOutputMethod("hex");
          if (NODE_JS) {
            method = nodeWrap(method);
          }
          method.create = function() {
            return new Md5();
          };
          method.update = function(message) {
            return method.create().update(message);
          };
          for (var i = 0; i < OUTPUT_TYPES.length; ++i) {
            var type = OUTPUT_TYPES[i];
            method[type] = createOutputMethod(type);
          }
          return method;
        };
        var createHmacOutputMethod = function(outputType) {
          return function(key, message) {
            return new HmacMd5(key, true).update(message)[outputType]();
          };
        };
        var createHmacMethod = function() {
          var method = createHmacOutputMethod("hex");
          method.create = function(key) {
            return new HmacMd5(key);
          };
          method.update = function(key, message) {
            return method.create(key).update(message);
          };
          for (var i = 0; i < OUTPUT_TYPES.length; ++i) {
            var type = OUTPUT_TYPES[i];
            method[type] = createHmacOutputMethod(type);
          }
          return method;
        };
        function Md5(sharedMemory) {
          if (sharedMemory) {
            blocks[0] = blocks[16] = blocks[1] = blocks[2] = blocks[3] = blocks[4] = blocks[5] = blocks[6] = blocks[7] = blocks[8] = blocks[9] = blocks[10] = blocks[11] = blocks[12] = blocks[13] = blocks[14] = blocks[15] = 0;
            this.blocks = blocks;
            this.buffer8 = buffer8;
          } else {
            if (ARRAY_BUFFER) {
              var buffer2 = new ArrayBuffer(68);
              this.buffer8 = new Uint8Array(buffer2);
              this.blocks = new Uint32Array(buffer2);
            } else {
              this.blocks = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
            }
          }
          this.h0 = this.h1 = this.h2 = this.h3 = this.start = this.bytes = this.hBytes = 0;
          this.finalized = this.hashed = false;
          this.first = true;
        }
        Md5.prototype.update = function(message) {
          if (this.finalized) {
            throw new Error(FINALIZE_ERROR);
          }
          var result = formatMessage(message);
          message = result[0];
          var isString = result[1];
          var code, index = 0, i, length = message.length, blocks2 = this.blocks;
          var buffer82 = this.buffer8;
          while (index < length) {
            if (this.hashed) {
              this.hashed = false;
              blocks2[0] = blocks2[16];
              blocks2[16] = blocks2[1] = blocks2[2] = blocks2[3] = blocks2[4] = blocks2[5] = blocks2[6] = blocks2[7] = blocks2[8] = blocks2[9] = blocks2[10] = blocks2[11] = blocks2[12] = blocks2[13] = blocks2[14] = blocks2[15] = 0;
            }
            if (isString) {
              if (ARRAY_BUFFER) {
                for (i = this.start; index < length && i < 64; ++index) {
                  code = message.charCodeAt(index);
                  if (code < 128) {
                    buffer82[i++] = code;
                  } else if (code < 2048) {
                    buffer82[i++] = 192 | code >>> 6;
                    buffer82[i++] = 128 | code & 63;
                  } else if (code < 55296 || code >= 57344) {
                    buffer82[i++] = 224 | code >>> 12;
                    buffer82[i++] = 128 | code >>> 6 & 63;
                    buffer82[i++] = 128 | code & 63;
                  } else {
                    code = 65536 + ((code & 1023) << 10 | message.charCodeAt(++index) & 1023);
                    buffer82[i++] = 240 | code >>> 18;
                    buffer82[i++] = 128 | code >>> 12 & 63;
                    buffer82[i++] = 128 | code >>> 6 & 63;
                    buffer82[i++] = 128 | code & 63;
                  }
                }
              } else {
                for (i = this.start; index < length && i < 64; ++index) {
                  code = message.charCodeAt(index);
                  if (code < 128) {
                    blocks2[i >>> 2] |= code << SHIFT[i++ & 3];
                  } else if (code < 2048) {
                    blocks2[i >>> 2] |= (192 | code >>> 6) << SHIFT[i++ & 3];
                    blocks2[i >>> 2] |= (128 | code & 63) << SHIFT[i++ & 3];
                  } else if (code < 55296 || code >= 57344) {
                    blocks2[i >>> 2] |= (224 | code >>> 12) << SHIFT[i++ & 3];
                    blocks2[i >>> 2] |= (128 | code >>> 6 & 63) << SHIFT[i++ & 3];
                    blocks2[i >>> 2] |= (128 | code & 63) << SHIFT[i++ & 3];
                  } else {
                    code = 65536 + ((code & 1023) << 10 | message.charCodeAt(++index) & 1023);
                    blocks2[i >>> 2] |= (240 | code >>> 18) << SHIFT[i++ & 3];
                    blocks2[i >>> 2] |= (128 | code >>> 12 & 63) << SHIFT[i++ & 3];
                    blocks2[i >>> 2] |= (128 | code >>> 6 & 63) << SHIFT[i++ & 3];
                    blocks2[i >>> 2] |= (128 | code & 63) << SHIFT[i++ & 3];
                  }
                }
              }
            } else {
              if (ARRAY_BUFFER) {
                for (i = this.start; index < length && i < 64; ++index) {
                  buffer82[i++] = message[index];
                }
              } else {
                for (i = this.start; index < length && i < 64; ++index) {
                  blocks2[i >>> 2] |= message[index] << SHIFT[i++ & 3];
                }
              }
            }
            this.lastByteIndex = i;
            this.bytes += i - this.start;
            if (i >= 64) {
              this.start = i - 64;
              this.hash();
              this.hashed = true;
            } else {
              this.start = i;
            }
          }
          if (this.bytes > 4294967295) {
            this.hBytes += this.bytes / 4294967296 << 0;
            this.bytes = this.bytes % 4294967296;
          }
          return this;
        };
        Md5.prototype.finalize = function() {
          if (this.finalized) {
            return;
          }
          this.finalized = true;
          var blocks2 = this.blocks, i = this.lastByteIndex;
          blocks2[i >>> 2] |= EXTRA[i & 3];
          if (i >= 56) {
            if (!this.hashed) {
              this.hash();
            }
            blocks2[0] = blocks2[16];
            blocks2[16] = blocks2[1] = blocks2[2] = blocks2[3] = blocks2[4] = blocks2[5] = blocks2[6] = blocks2[7] = blocks2[8] = blocks2[9] = blocks2[10] = blocks2[11] = blocks2[12] = blocks2[13] = blocks2[14] = blocks2[15] = 0;
          }
          blocks2[14] = this.bytes << 3;
          blocks2[15] = this.hBytes << 3 | this.bytes >>> 29;
          this.hash();
        };
        Md5.prototype.hash = function() {
          var a, b, c, d, bc, da, blocks2 = this.blocks;
          if (this.first) {
            a = blocks2[0] - 680876937;
            a = (a << 7 | a >>> 25) - 271733879 << 0;
            d = (-1732584194 ^ a & 2004318071) + blocks2[1] - 117830708;
            d = (d << 12 | d >>> 20) + a << 0;
            c = (-271733879 ^ d & (a ^ -271733879)) + blocks2[2] - 1126478375;
            c = (c << 17 | c >>> 15) + d << 0;
            b = (a ^ c & (d ^ a)) + blocks2[3] - 1316259209;
            b = (b << 22 | b >>> 10) + c << 0;
          } else {
            a = this.h0;
            b = this.h1;
            c = this.h2;
            d = this.h3;
            a += (d ^ b & (c ^ d)) + blocks2[0] - 680876936;
            a = (a << 7 | a >>> 25) + b << 0;
            d += (c ^ a & (b ^ c)) + blocks2[1] - 389564586;
            d = (d << 12 | d >>> 20) + a << 0;
            c += (b ^ d & (a ^ b)) + blocks2[2] + 606105819;
            c = (c << 17 | c >>> 15) + d << 0;
            b += (a ^ c & (d ^ a)) + blocks2[3] - 1044525330;
            b = (b << 22 | b >>> 10) + c << 0;
          }
          a += (d ^ b & (c ^ d)) + blocks2[4] - 176418897;
          a = (a << 7 | a >>> 25) + b << 0;
          d += (c ^ a & (b ^ c)) + blocks2[5] + 1200080426;
          d = (d << 12 | d >>> 20) + a << 0;
          c += (b ^ d & (a ^ b)) + blocks2[6] - 1473231341;
          c = (c << 17 | c >>> 15) + d << 0;
          b += (a ^ c & (d ^ a)) + blocks2[7] - 45705983;
          b = (b << 22 | b >>> 10) + c << 0;
          a += (d ^ b & (c ^ d)) + blocks2[8] + 1770035416;
          a = (a << 7 | a >>> 25) + b << 0;
          d += (c ^ a & (b ^ c)) + blocks2[9] - 1958414417;
          d = (d << 12 | d >>> 20) + a << 0;
          c += (b ^ d & (a ^ b)) + blocks2[10] - 42063;
          c = (c << 17 | c >>> 15) + d << 0;
          b += (a ^ c & (d ^ a)) + blocks2[11] - 1990404162;
          b = (b << 22 | b >>> 10) + c << 0;
          a += (d ^ b & (c ^ d)) + blocks2[12] + 1804603682;
          a = (a << 7 | a >>> 25) + b << 0;
          d += (c ^ a & (b ^ c)) + blocks2[13] - 40341101;
          d = (d << 12 | d >>> 20) + a << 0;
          c += (b ^ d & (a ^ b)) + blocks2[14] - 1502002290;
          c = (c << 17 | c >>> 15) + d << 0;
          b += (a ^ c & (d ^ a)) + blocks2[15] + 1236535329;
          b = (b << 22 | b >>> 10) + c << 0;
          a += (c ^ d & (b ^ c)) + blocks2[1] - 165796510;
          a = (a << 5 | a >>> 27) + b << 0;
          d += (b ^ c & (a ^ b)) + blocks2[6] - 1069501632;
          d = (d << 9 | d >>> 23) + a << 0;
          c += (a ^ b & (d ^ a)) + blocks2[11] + 643717713;
          c = (c << 14 | c >>> 18) + d << 0;
          b += (d ^ a & (c ^ d)) + blocks2[0] - 373897302;
          b = (b << 20 | b >>> 12) + c << 0;
          a += (c ^ d & (b ^ c)) + blocks2[5] - 701558691;
          a = (a << 5 | a >>> 27) + b << 0;
          d += (b ^ c & (a ^ b)) + blocks2[10] + 38016083;
          d = (d << 9 | d >>> 23) + a << 0;
          c += (a ^ b & (d ^ a)) + blocks2[15] - 660478335;
          c = (c << 14 | c >>> 18) + d << 0;
          b += (d ^ a & (c ^ d)) + blocks2[4] - 405537848;
          b = (b << 20 | b >>> 12) + c << 0;
          a += (c ^ d & (b ^ c)) + blocks2[9] + 568446438;
          a = (a << 5 | a >>> 27) + b << 0;
          d += (b ^ c & (a ^ b)) + blocks2[14] - 1019803690;
          d = (d << 9 | d >>> 23) + a << 0;
          c += (a ^ b & (d ^ a)) + blocks2[3] - 187363961;
          c = (c << 14 | c >>> 18) + d << 0;
          b += (d ^ a & (c ^ d)) + blocks2[8] + 1163531501;
          b = (b << 20 | b >>> 12) + c << 0;
          a += (c ^ d & (b ^ c)) + blocks2[13] - 1444681467;
          a = (a << 5 | a >>> 27) + b << 0;
          d += (b ^ c & (a ^ b)) + blocks2[2] - 51403784;
          d = (d << 9 | d >>> 23) + a << 0;
          c += (a ^ b & (d ^ a)) + blocks2[7] + 1735328473;
          c = (c << 14 | c >>> 18) + d << 0;
          b += (d ^ a & (c ^ d)) + blocks2[12] - 1926607734;
          b = (b << 20 | b >>> 12) + c << 0;
          bc = b ^ c;
          a += (bc ^ d) + blocks2[5] - 378558;
          a = (a << 4 | a >>> 28) + b << 0;
          d += (bc ^ a) + blocks2[8] - 2022574463;
          d = (d << 11 | d >>> 21) + a << 0;
          da = d ^ a;
          c += (da ^ b) + blocks2[11] + 1839030562;
          c = (c << 16 | c >>> 16) + d << 0;
          b += (da ^ c) + blocks2[14] - 35309556;
          b = (b << 23 | b >>> 9) + c << 0;
          bc = b ^ c;
          a += (bc ^ d) + blocks2[1] - 1530992060;
          a = (a << 4 | a >>> 28) + b << 0;
          d += (bc ^ a) + blocks2[4] + 1272893353;
          d = (d << 11 | d >>> 21) + a << 0;
          da = d ^ a;
          c += (da ^ b) + blocks2[7] - 155497632;
          c = (c << 16 | c >>> 16) + d << 0;
          b += (da ^ c) + blocks2[10] - 1094730640;
          b = (b << 23 | b >>> 9) + c << 0;
          bc = b ^ c;
          a += (bc ^ d) + blocks2[13] + 681279174;
          a = (a << 4 | a >>> 28) + b << 0;
          d += (bc ^ a) + blocks2[0] - 358537222;
          d = (d << 11 | d >>> 21) + a << 0;
          da = d ^ a;
          c += (da ^ b) + blocks2[3] - 722521979;
          c = (c << 16 | c >>> 16) + d << 0;
          b += (da ^ c) + blocks2[6] + 76029189;
          b = (b << 23 | b >>> 9) + c << 0;
          bc = b ^ c;
          a += (bc ^ d) + blocks2[9] - 640364487;
          a = (a << 4 | a >>> 28) + b << 0;
          d += (bc ^ a) + blocks2[12] - 421815835;
          d = (d << 11 | d >>> 21) + a << 0;
          da = d ^ a;
          c += (da ^ b) + blocks2[15] + 530742520;
          c = (c << 16 | c >>> 16) + d << 0;
          b += (da ^ c) + blocks2[2] - 995338651;
          b = (b << 23 | b >>> 9) + c << 0;
          a += (c ^ (b | ~d)) + blocks2[0] - 198630844;
          a = (a << 6 | a >>> 26) + b << 0;
          d += (b ^ (a | ~c)) + blocks2[7] + 1126891415;
          d = (d << 10 | d >>> 22) + a << 0;
          c += (a ^ (d | ~b)) + blocks2[14] - 1416354905;
          c = (c << 15 | c >>> 17) + d << 0;
          b += (d ^ (c | ~a)) + blocks2[5] - 57434055;
          b = (b << 21 | b >>> 11) + c << 0;
          a += (c ^ (b | ~d)) + blocks2[12] + 1700485571;
          a = (a << 6 | a >>> 26) + b << 0;
          d += (b ^ (a | ~c)) + blocks2[3] - 1894986606;
          d = (d << 10 | d >>> 22) + a << 0;
          c += (a ^ (d | ~b)) + blocks2[10] - 1051523;
          c = (c << 15 | c >>> 17) + d << 0;
          b += (d ^ (c | ~a)) + blocks2[1] - 2054922799;
          b = (b << 21 | b >>> 11) + c << 0;
          a += (c ^ (b | ~d)) + blocks2[8] + 1873313359;
          a = (a << 6 | a >>> 26) + b << 0;
          d += (b ^ (a | ~c)) + blocks2[15] - 30611744;
          d = (d << 10 | d >>> 22) + a << 0;
          c += (a ^ (d | ~b)) + blocks2[6] - 1560198380;
          c = (c << 15 | c >>> 17) + d << 0;
          b += (d ^ (c | ~a)) + blocks2[13] + 1309151649;
          b = (b << 21 | b >>> 11) + c << 0;
          a += (c ^ (b | ~d)) + blocks2[4] - 145523070;
          a = (a << 6 | a >>> 26) + b << 0;
          d += (b ^ (a | ~c)) + blocks2[11] - 1120210379;
          d = (d << 10 | d >>> 22) + a << 0;
          c += (a ^ (d | ~b)) + blocks2[2] + 718787259;
          c = (c << 15 | c >>> 17) + d << 0;
          b += (d ^ (c | ~a)) + blocks2[9] - 343485551;
          b = (b << 21 | b >>> 11) + c << 0;
          if (this.first) {
            this.h0 = a + 1732584193 << 0;
            this.h1 = b - 271733879 << 0;
            this.h2 = c - 1732584194 << 0;
            this.h3 = d + 271733878 << 0;
            this.first = false;
          } else {
            this.h0 = this.h0 + a << 0;
            this.h1 = this.h1 + b << 0;
            this.h2 = this.h2 + c << 0;
            this.h3 = this.h3 + d << 0;
          }
        };
        Md5.prototype.hex = function() {
          this.finalize();
          var h0 = this.h0, h1 = this.h1, h2 = this.h2, h3 = this.h3;
          return HEX_CHARS[h0 >>> 4 & 15] + HEX_CHARS[h0 & 15] + HEX_CHARS[h0 >>> 12 & 15] + HEX_CHARS[h0 >>> 8 & 15] + HEX_CHARS[h0 >>> 20 & 15] + HEX_CHARS[h0 >>> 16 & 15] + HEX_CHARS[h0 >>> 28 & 15] + HEX_CHARS[h0 >>> 24 & 15] + HEX_CHARS[h1 >>> 4 & 15] + HEX_CHARS[h1 & 15] + HEX_CHARS[h1 >>> 12 & 15] + HEX_CHARS[h1 >>> 8 & 15] + HEX_CHARS[h1 >>> 20 & 15] + HEX_CHARS[h1 >>> 16 & 15] + HEX_CHARS[h1 >>> 28 & 15] + HEX_CHARS[h1 >>> 24 & 15] + HEX_CHARS[h2 >>> 4 & 15] + HEX_CHARS[h2 & 15] + HEX_CHARS[h2 >>> 12 & 15] + HEX_CHARS[h2 >>> 8 & 15] + HEX_CHARS[h2 >>> 20 & 15] + HEX_CHARS[h2 >>> 16 & 15] + HEX_CHARS[h2 >>> 28 & 15] + HEX_CHARS[h2 >>> 24 & 15] + HEX_CHARS[h3 >>> 4 & 15] + HEX_CHARS[h3 & 15] + HEX_CHARS[h3 >>> 12 & 15] + HEX_CHARS[h3 >>> 8 & 15] + HEX_CHARS[h3 >>> 20 & 15] + HEX_CHARS[h3 >>> 16 & 15] + HEX_CHARS[h3 >>> 28 & 15] + HEX_CHARS[h3 >>> 24 & 15];
        };
        Md5.prototype.toString = Md5.prototype.hex;
        Md5.prototype.digest = function() {
          this.finalize();
          var h0 = this.h0, h1 = this.h1, h2 = this.h2, h3 = this.h3;
          return [
            h0 & 255,
            h0 >>> 8 & 255,
            h0 >>> 16 & 255,
            h0 >>> 24 & 255,
            h1 & 255,
            h1 >>> 8 & 255,
            h1 >>> 16 & 255,
            h1 >>> 24 & 255,
            h2 & 255,
            h2 >>> 8 & 255,
            h2 >>> 16 & 255,
            h2 >>> 24 & 255,
            h3 & 255,
            h3 >>> 8 & 255,
            h3 >>> 16 & 255,
            h3 >>> 24 & 255
          ];
        };
        Md5.prototype.array = Md5.prototype.digest;
        Md5.prototype.arrayBuffer = function() {
          this.finalize();
          var buffer2 = new ArrayBuffer(16);
          var blocks2 = new Uint32Array(buffer2);
          blocks2[0] = this.h0;
          blocks2[1] = this.h1;
          blocks2[2] = this.h2;
          blocks2[3] = this.h3;
          return buffer2;
        };
        Md5.prototype.buffer = Md5.prototype.arrayBuffer;
        Md5.prototype.base64 = function() {
          var v1, v2, v3, base64Str = "", bytes = this.array();
          for (var i = 0; i < 15; ) {
            v1 = bytes[i++];
            v2 = bytes[i++];
            v3 = bytes[i++];
            base64Str += BASE64_ENCODE_CHAR[v1 >>> 2] + BASE64_ENCODE_CHAR[(v1 << 4 | v2 >>> 4) & 63] + BASE64_ENCODE_CHAR[(v2 << 2 | v3 >>> 6) & 63] + BASE64_ENCODE_CHAR[v3 & 63];
          }
          v1 = bytes[i];
          base64Str += BASE64_ENCODE_CHAR[v1 >>> 2] + BASE64_ENCODE_CHAR[v1 << 4 & 63] + "==";
          return base64Str;
        };
        function HmacMd5(key, sharedMemory) {
          var i, result = formatMessage(key);
          key = result[0];
          if (result[1]) {
            var bytes = [], length = key.length, index = 0, code;
            for (i = 0; i < length; ++i) {
              code = key.charCodeAt(i);
              if (code < 128) {
                bytes[index++] = code;
              } else if (code < 2048) {
                bytes[index++] = 192 | code >>> 6;
                bytes[index++] = 128 | code & 63;
              } else if (code < 55296 || code >= 57344) {
                bytes[index++] = 224 | code >>> 12;
                bytes[index++] = 128 | code >>> 6 & 63;
                bytes[index++] = 128 | code & 63;
              } else {
                code = 65536 + ((code & 1023) << 10 | key.charCodeAt(++i) & 1023);
                bytes[index++] = 240 | code >>> 18;
                bytes[index++] = 128 | code >>> 12 & 63;
                bytes[index++] = 128 | code >>> 6 & 63;
                bytes[index++] = 128 | code & 63;
              }
            }
            key = bytes;
          }
          if (key.length > 64) {
            key = new Md5(true).update(key).array();
          }
          var oKeyPad = [], iKeyPad = [];
          for (i = 0; i < 64; ++i) {
            var b = key[i] || 0;
            oKeyPad[i] = 92 ^ b;
            iKeyPad[i] = 54 ^ b;
          }
          Md5.call(this, sharedMemory);
          this.update(iKeyPad);
          this.oKeyPad = oKeyPad;
          this.inner = true;
          this.sharedMemory = sharedMemory;
        }
        HmacMd5.prototype = new Md5();
        HmacMd5.prototype.finalize = function() {
          Md5.prototype.finalize.call(this);
          if (this.inner) {
            this.inner = false;
            var innerHash = this.array();
            Md5.call(this, this.sharedMemory);
            this.update(this.oKeyPad);
            this.update(innerHash);
            Md5.prototype.finalize.call(this);
          }
        };
        var exports2 = createMethod();
        exports2.md5 = exports2;
        exports2.md5.hmac = createHmacMethod();
        if (COMMON_JS) {
          module.exports = exports2;
        } else {
          root.md5 = exports2;
          if (AMD) {
            define(function() {
              return exports2;
            });
          }
        }
      })();
    }
  });

  // core/src/fs/indexeddb.ts
  var IndexedDB = class {
    constructor(dbName = "Macintosh HD") {
      this.dbName = dbName;
    }
    db;
    objectStore = "Storage";
    logDebug = false;
    log(...args) {
      if (this.logDebug) {
        console.log(...args);
      }
    }
    init() {
      return new Promise((res, rej) => {
        const request = indexedDB.open(this.dbName, 1);
        request.onupgradeneeded = () => {
          const db = request.result;
          db.createObjectStore(this.objectStore);
        };
        request.onsuccess = () => {
          this.db = request.result;
          res();
        };
        request.onerror = () => rej(request.error);
      });
    }
    transaction() {
      return this.db.transaction([this.objectStore], "readwrite").objectStore(this.objectStore);
    }
    getPath(path) {
      path = String(path);
      if (!path.startsWith("/")) path = "/" + path;
      return path;
    }
    async createFile(path) {
      path = this.getPath(path);
      await this.writeFile(path, "");
    }
    async writeFile(path, data) {
      path = this.getPath(path);
      const store = this.transaction();
      return new Promise((res, rej) => {
        const content = data instanceof Blob ? data : new Blob([data instanceof Uint8Array ? data : String(data)]);
        const entry = { type: "file", content };
        const request = store.put(entry, path);
        request.onsuccess = () => {
          this.log(`Writed file [${path}] = ${data instanceof Uint8Array ? `${data.length} length of uint8array` : data instanceof Blob ? `${data.size} length of blob` : typeof data == "object" ? "" : `${data.length} length of string`}`);
          res();
        };
        request.onerror = () => {
          this.log(`Can't write file [${path}]`);
          rej(request.error);
        };
      });
    }
    async readFile(path) {
      path = this.getPath(path);
      const bytes = await this.readFileBytes(path);
      return new TextDecoder().decode(bytes);
    }
    async readFileBytes(path) {
      path = this.getPath(path);
      const store = this.transaction();
      return new Promise((res, rej) => {
        const request = store.get(path);
        request.onsuccess = () => {
          const result = request.result;
          if (result && result.type == "file") {
            if (result.content instanceof Blob) {
              result.content.arrayBuffer().then((buf) => res(new Uint8Array(buf)));
            } else {
              rej(new Error("Unsupported file content type"));
            }
          } else {
            rej("File not found or not a file " + path);
          }
        };
        request.onerror = () => rej(request.error);
      });
    }
    async readFileB64(path) {
      path = this.getPath(path);
      const store = this.transaction();
      return new Promise((res, rej) => {
        const request = store.get(path);
        request.onsuccess = () => {
          const result = request.result;
          if (result?.type === "file") {
            result.content.arrayBuffer().then((buf) => {
              const bytes = new Uint8Array(buf);
              let binary = "";
              bytes.forEach((byte) => binary += String.fromCharCode(byte));
              res(`data:${result.content.type || "application/octet-stream"};base64,${btoa(binary)}`);
            });
          } else {
            rej("File not found or not a file");
          }
        };
        request.onerror = () => rej(request.error);
      });
    }
    async createDir(path) {
      path = this.getPath(path);
      if (await this.existsDir(path)) return;
      const store = this.transaction();
      return new Promise((res, rej) => {
        const entry = { type: "dir" };
        const request = store.put(entry, path);
        request.onsuccess = () => {
          this.log(`Created directory ${path}`);
          res();
        };
        request.onerror = () => {
          this.log(`Can't create directory`);
          rej(request.error);
        };
      });
    }
    async existsDir(path) {
      path = this.getPath(path);
      const store = this.transaction();
      return new Promise((res) => {
        const request = store.get(path);
        request.onsuccess = () => res(request.result !== void 0 && request.result.type == "dir");
        request.onerror = () => res(false);
      });
    }
    async existsFile(path) {
      path = this.getPath(path);
      const store = this.transaction();
      return new Promise((res) => {
        const request = store.get(path);
        request.onsuccess = () => res(request.result !== void 0 && request.result.type == "file");
        request.onerror = () => res(false);
      });
    }
    async exists(path) {
      path = this.getPath(path);
      const store = this.transaction();
      return new Promise((res) => {
        const request = store.get(path);
        request.onsuccess = () => res(request.result !== void 0);
        request.onerror = () => res(false);
      });
    }
    async isFile(path) {
      path = this.getPath(path);
      const store = this.transaction();
      return new Promise((res) => {
        const request = store.get(path);
        request.onsuccess = () => res(request.result?.type === "file");
        request.onerror = () => res(false);
      });
    }
    async isDirectory(path) {
      path = this.getPath(path);
      const store = this.transaction();
      return new Promise((res) => {
        const request = store.get(path);
        request.onsuccess = () => res(request.result?.type === "dir");
        request.onerror = () => res(false);
      });
    }
    async deleteFile(path) {
      path = this.getPath(path);
      const store = this.transaction();
      return new Promise((res) => {
        const req = store.delete(path);
        req.onsuccess = () => {
          this.log(`Deleted file ${path}`);
          res(true);
        };
        req.onerror = () => {
          this.log(`Can't delete file ${path}`);
          res(false);
        };
      });
    }
    async deleteDirectory(path, recursive = false) {
      path = this.getPath(path);
      const store = this.transaction();
      const dirPath = path.endsWith("/") ? path : path + "/";
      const keysToDelete = [];
      return new Promise((res) => {
        const request = store.openCursor();
        request.onsuccess = () => {
          const cursor = request.result;
          if (!cursor) {
            const tx = this.transaction();
            tx.delete(path);
            if (recursive) {
              for (const key2 of keysToDelete) {
                tx.delete(key2);
              }
            }
            this.log(`Deleted directory ${path} - ${recursive}`);
            res(true);
            return;
          }
          const key = cursor.key;
          if (recursive && key.startsWith(dirPath)) {
            keysToDelete.push(key);
          }
          cursor.continue();
        };
        request.onerror = () => {
          this.log(`Can't delete directory ${path} - ${recursive}`);
          res(false);
        };
      });
    }
    async listDir(path) {
      path = this.getPath(path);
      const store = this.db.transaction("files", "readonly").objectStore("files");
      const entries = /* @__PURE__ */ new Set();
      const prefix = path.endsWith("/") ? path : path + "/";
      return new Promise((res, rej) => {
        const request = store.openCursor();
        request.onsuccess = () => {
          const cursor = request.result;
          if (!cursor) return res([...entries]);
          const key = cursor.key;
          if (key.startsWith(prefix)) {
            const relative = key.slice(prefix.length).split("/")[0];
            entries.add(relative);
          }
          cursor.continue();
        };
        request.onerror = () => rej(request.error);
      });
    }
    async rename(oldPath, newPath) {
      oldPath = this.getPath(oldPath);
      newPath = this.getPath(newPath);
      const content = await this.readFileBytes(oldPath);
      await this.writeFile(newPath, content);
      this.log(`Rename ${oldPath} - ${newPath}`);
      return this.deleteFile(oldPath);
    }
    async copyFile(fromPath, toPath) {
      fromPath = this.getPath(fromPath);
      toPath = this.getPath(toPath);
      const content = await this.readFileBytes(fromPath);
      await this.writeFile(toPath, content);
      this.log(`Copy ${fromPath} - ${toPath}`);
      return true;
    }
    async move(fromPath, toPath) {
      fromPath = this.getPath(fromPath);
      toPath = this.getPath(toPath);
      const success = await this.copyFile(fromPath, toPath);
      if (success) {
        this.log(`Move ${fromPath} - ${toPath}`);
        return this.deleteFile(fromPath);
      }
      this.log(`Can't move ${fromPath} - ${toPath}`);
      return false;
    }
    async loadImage(path) {
      path = this.getPath(path);
      const data = await this.readFileBytes(path);
      const blob = new Blob([data]);
      const url = URL.createObjectURL(blob);
      return new Promise((res, rej) => {
        const img = new Image();
        img.onload = () => {
          URL.revokeObjectURL(url);
          res(img);
        };
        img.onerror = () => {
          URL.revokeObjectURL(url);
          rej("Image load failed");
        };
        img.src = url;
      });
    }
    cacheImagesAsDataURL = {};
    async loadImageAsDataURL(path) {
      path = this.getPath(path);
      const sha1 = await this.getSHA1(path);
      if (this.cacheImagesAsDataURL[path] && this.cacheImagesAsDataURL[path].sha1 == sha1) {
        return this.cacheImagesAsDataURL[path].result;
      }
      const data = await this.readFileBytes(path);
      const base64 = btoa(String.fromCharCode(...new Uint8Array(data)));
      const mimeType = fs_default.getMimeType(path);
      const result = `data:${mimeType};base64,${base64}`;
      this.cacheImagesAsDataURL[path] = { sha1, result };
      return result;
    }
    async erase() {
      const store = this.transaction();
      return new Promise((res, rej) => {
        const request = store.openCursor();
        request.onsuccess = (event) => {
          const db = event.target.result;
          const transaction = this.db.transaction(
            Array.from(db.objectStoreNames),
            "readwrite"
          );
          const storeNames = Array.from(db.objectStoreNames);
          for (let storeName of storeNames) {
            const store2 = transaction.objectStore(storeName);
            const clearRequest = store2.clear();
            clearRequest.onsuccess = () => {
            };
            clearRequest.onerror = (event2) => {
              new Error(`Error deleting store "${storeName}":`, event2.target.error);
              res(false);
              return;
            };
          }
          transaction.oncomplete = () => {
            db.close();
            res(true);
          };
        };
        request.onerror = (event) => {
          new Error("Error opening db", event.target.error);
          res(false);
        };
      });
    }
    async getSHA1(path) {
      path = this.getPath(path);
      const bytes = await this.readFileBytes(path);
      if (typeof crypto.subtle == "undefined") return Math.random().toString();
      const hashBuffer = await crypto.subtle.digest("SHA-1", bytes);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
    }
  };

  // core/src/fs/opfs.ts
  var OPFS = class {
    constructor(root) {
      this.root = root;
    }
    type = "OPFS";
    logDebug = false;
    log(...args) {
      if (this.logDebug) {
        console.log(...args);
      }
    }
    getPath(path) {
      if (!path.startsWith("/")) path = "/" + path;
      return path;
    }
    async getPathParts(path) {
      return path.replace(/^\/+/, "").split("/").filter(global.Boolean);
    }
    async getParentDirHandle(path, create = false) {
      path = this.getPath(path);
      const parts = await this.getPathParts(path);
      parts.pop();
      let dir = this.root;
      for (const part of parts) {
        dir = await dir.getDirectoryHandle(part, { create });
      }
      return dir;
    }
    async getFileHandle(path, create = false) {
      path = this.getPath(path);
      const parts = await this.getPathParts(path);
      const name = parts.pop();
      const parent = await this.getParentDirHandle(path, create);
      return parent.getFileHandle(name, { create });
    }
    async getDirectoryHandle(path, create = false) {
      path = this.getPath(path);
      const parts = await this.getPathParts(path);
      let dir = this.root;
      for (const part of parts) {
        dir = await dir.getDirectoryHandle(part, { create });
      }
      return dir;
    }
    async createFile(path) {
      path = this.getPath(path);
      await this.getFileHandle(path, true);
      this.log(`Created file [${path}]`);
    }
    async writeFile(path, data) {
      path = this.getPath(path);
      const fileHandle = await this.getFileHandle(path, true);
      const writable = await fileHandle.createWritable();
      if (data instanceof global.Uint8Array) await writable.write(new global.Blob([data]));
      else await writable.write(data);
      await writable.close();
      this.log(`Writed file [${path}] = ${data instanceof global.Uint8Array ? `${data.length} length of uint8array` : data instanceof global.Blob ? "" : `${data.length} length of string`}`);
    }
    async readFile(path) {
      path = this.getPath(path);
      try {
        const fileHandle = await this.getFileHandle(path);
        const file = await fileHandle.getFile();
        return await file.text();
      } catch (e) {
        throw error(`Can't read file [${path}]`);
      }
    }
    async readFileBytes(path) {
      path = this.getPath(path);
      try {
        const fileHandle = await this.getFileHandle(path);
        const file = await fileHandle.getFile();
        const buffer = await file.arrayBuffer();
        return new global.Uint8Array(buffer);
      } catch (e) {
        throw error(`Can't read file [${path}]`);
      }
    }
    async readFileB64(path) {
      path = this.getPath(path);
      try {
        let binary = "";
        const fileHandle = await this.getFileHandle(path);
        const file = await fileHandle.getFile();
        const buffer = await file.arrayBuffer();
        const bytes = new global.Uint8Array(buffer);
        bytes.forEach((byte) => binary += global.String.fromCharCode(byte));
        return `data:${file.type || "application/octet-stream"};base64,${global.btoa(binary)}`;
      } catch (e) {
        throw error(`Can't read file [${path}]`);
      }
    }
    async loadImage(path) {
      path = this.getPath(path);
      const fileData = await this.readFileBytes(path);
      const blob = new global.Blob([fileData]);
      const imageUrl = global.URL.createObjectURL(blob);
      return new Promise((res, rej) => {
        const img = new global.Image();
        img.onload = () => {
          global.URL.revokeObjectURL(imageUrl);
          res(img);
        };
        img.onerror = (err) => {
          global.URL.revokeObjectURL(imageUrl);
          rej(`Failed to load image: ${err}`);
        };
        img.src = imageUrl;
      });
    }
    async loadImageAsDataURL(path) {
      path = this.getPath(path);
      const data = await this.readFileBytes(path);
      const base64 = global.btoa(global.String.fromCharCode(...new global.Uint8Array(data)));
      const mimeType = fs_default.getMimeType(path);
      return `data:${mimeType};base64,${base64}`;
    }
    async createDir(path) {
      path = this.getPath(path);
      if (await this.existsDir(path)) return;
      await this.getDirectoryHandle(path, true);
      this.log(`Created directory [${path}]`);
    }
    async exists(path) {
      path = this.getPath(path);
      let file = false;
      let directory = false;
      try {
        await this.getFileHandle(path);
        file = true;
      } catch {
      }
      try {
        await this.getDirectoryHandle(path);
        directory = true;
      } catch {
      }
      return file || directory;
    }
    async existsFile(path) {
      path = this.getPath(path);
      try {
        await this.getFileHandle(path);
        return true;
      } catch {
      }
      return false;
    }
    async existsDir(path) {
      path = this.getPath(path);
      try {
        await this.getDirectoryHandle(path);
        return true;
      } catch {
      }
      return false;
    }
    async isFile(path) {
      path = this.getPath(path);
      try {
        await this.getFileHandle(path);
        return true;
      } catch {
        return false;
      }
    }
    async isDirectory(path) {
      path = this.getPath(path);
      try {
        await this.getDirectoryHandle(path);
        return true;
      } catch {
        return false;
      }
    }
    async deleteFile(path) {
      path = this.getPath(path);
      if (!await this.existsFile(path)) {
        this.log(`Can't delete file [${path}] - not exists`);
        return false;
      }
      try {
        const parts = await this.getPathParts(path);
        const name = parts.pop();
        const parent = await this.getParentDirHandle(path);
        await parent.removeEntry(name);
        this.log(`Deleted file [${path}]`);
        return true;
      } catch (e) {
        this.log(`Can't delete file [${path}] - ${e}`);
        return false;
      }
    }
    async deleteDirectory(path, recursive = false) {
      path = this.getPath(path);
      if (!await this.existsDir(path)) {
        this.log(`Can't delete directory [${path}] - not exists`);
        return false;
      }
      try {
        const parts = await this.getPathParts(path);
        const name = parts.pop();
        const parent = await this.getParentDirHandle(path);
        await parent.removeEntry(name, { recursive });
        this.log(`Deleted directory [${path}]`);
        return true;
      } catch (e) {
        this.log(`Can't delete directory [${path}] - ${e}`);
        return false;
      }
    }
    async listDir(path) {
      path = this.getPath(path);
      try {
        const dir = await this.getDirectoryHandle(path);
        const result = [];
        for await (const [name] of dir.entries()) result.unshift(name);
        return result;
      } catch {
        return [];
      }
    }
    async rename(oldPath, newPath) {
      oldPath = this.getPath(oldPath);
      newPath = this.getPath(newPath);
      try {
        const file = await this.readFileBytes(oldPath);
        await this.writeFile(newPath, file);
        const success = await this.deleteFile(oldPath);
        if (success) this.log(`Renamed file ${oldPath} - ${newPath}`);
        else this.log(`Failed to delete original file during rename`);
        return success;
      } catch {
        this.log(`Can't rename file ${oldPath} - ${newPath}`);
        return false;
      }
    }
    async copyFile(fromPath, toPath) {
      fromPath = this.getPath(fromPath);
      toPath = this.getPath(toPath);
      try {
        const data = await this.readFileBytes(fromPath);
        await this.writeFile(toPath, data);
        this.log(`Copy ${fromPath} - ${toPath}`);
        return true;
      } catch {
        this.log(`Can't copy ${fromPath} - ${toPath}`);
        return false;
      }
    }
    async move(fromPath, toPath) {
      fromPath = this.getPath(fromPath);
      toPath = this.getPath(toPath);
      if (await this.copyFile(fromPath, toPath)) {
        this.log(`Move ${fromPath} - ${toPath}`);
        return await this.deleteFile(fromPath);
      }
      this.log(`Can't move ${fromPath} - ${toPath}`);
      return false;
    }
    async erase() {
      async function deleteAllEntries(dirHandle) {
        for await (const [name, handle] of dirHandle.entries()) {
          if (handle.kind == "file") {
            await dirHandle.removeEntry(name);
          } else if (handle.kind == "directory") {
            await deleteAllEntries(handle);
            await dirHandle.removeEntry(name, { recursive: true });
          }
        }
      }
      await deleteAllEntries(this.root);
      return true;
    }
    async getSHA1(path) {
      path = this.getPath(path);
      const bytes = await this.readFileBytes(path);
      const hashBuffer = await global.crypto.subtle.digest("SHA-1", bytes);
      const hashArray = global.Array.from(new global.Uint8Array(hashBuffer));
      return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
    }
  };

  // core/src/fs/inmemory.ts
  var InMemoryFS = class {
    type = "InMemory";
    logDebug = false;
    data = {};
    log(...args) {
      if (this.logDebug) {
        console.log(...args);
      }
    }
    getPath(path) {
      if (!path.startsWith("/")) path = "/" + path;
      return path;
    }
    async createFile(path) {
      this.data[this.getPath(path)] = { content: new Uint8Array(), isDir: false };
      this.log(`Created file [${path}]`);
    }
    async writeFile(path, data) {
      path = this.getPath(path);
      let buffer;
      if (typeof data == "string") {
        buffer = new TextEncoder().encode(data);
      } else if (data instanceof Blob) {
        const arrayBuffer = await data.arrayBuffer();
        buffer = new Uint8Array(arrayBuffer);
      } else if (data instanceof Uint8Array) {
        buffer = data;
      } else if (typeof data == "object") {
        buffer = new TextEncoder().encode(JSON.stringify(data));
      } else {
        throw error("Unsupported data type");
      }
      this.data[path] = { content: buffer, isDir: false };
      this.log(`Wrote to file [${path}]`);
    }
    async readFile(path) {
      path = this.getPath(path);
      const entry = this.data[path];
      if (!entry || entry.isDir) {
        throw error(`File not found: ${path}`);
      }
      return new global.TextDecoder().decode(entry.content);
    }
    async readFileBytes(path) {
      path = this.getPath(path);
      const entry = this.data[path];
      if (!entry || entry.isDir) {
        throw error(`File not found: ${path}`);
      }
      return entry.content;
    }
    async readFileB64(path) {
      path = this.getPath(path);
      const bytes = await this.readFileBytes(path);
      return global.btoa(global.String.fromCharCode.apply(null, bytes));
    }
    async loadImage(path) {
      path = this.getPath(path);
      const fileData = await this.readFileBytes(path);
      const blob = new global.Blob([fileData]);
      const imageUrl = global.URL.createObjectURL(blob);
      return new Promise((res, rej) => {
        const img = new global.Image();
        img.onload = () => {
          global.URL.revokeObjectURL(imageUrl);
          res(img);
        };
        img.onerror = (err) => {
          global.URL.revokeObjectURL(imageUrl);
          rej(`Failed to load image: ${err}`);
        };
        img.src = imageUrl;
      });
    }
    async loadImageAsDataURL(path) {
      path = this.getPath(path);
      const data = await this.readFileBytes(path);
      const base64 = global.btoa(global.String.fromCharCode(...new global.Uint8Array(data)));
      const mimeType = fs_default.getMimeType(path);
      return `data:${mimeType};base64,${base64}`;
    }
    async createDir(path) {
      path = this.getPath(path);
      if (await this.existsDir(path)) return;
      this.data[path] = { content: new Uint8Array(0), isDir: true };
      this.log(`Created directory [${path}]`);
    }
    async exists(path) {
      path = this.getPath(path);
      return !!this.data[path];
    }
    async existsFile(path) {
      path = this.getPath(path);
      const entry = this.data[path];
      return !!(entry && !entry.isDir);
    }
    async existsDir(path) {
      path = this.getPath(path);
      const entry = this.data[path];
      return !!(entry && entry.isDir);
    }
    async isFile(path) {
      path = this.getPath(path);
      const entry = this.data[path];
      return !!(entry && !entry.isDir);
    }
    async isDirectory(path) {
      path = this.getPath(path);
      const entry = this.data[path];
      return !!(entry && entry.isDir);
    }
    async deleteFile(path) {
      path = this.getPath(path);
      if (!await this.existsFile(path)) {
        this.log(`Can't delete file [${path}] - not exists`);
        return false;
      }
      delete this.data[path];
      this.log(`Deleted file [${path}]`);
      return true;
    }
    async deleteDirectory(path, recursive = false) {
      path = this.getPath(path);
      if (!await this.existsDir(path)) {
        this.log(`Can't delete directory [${path}] - not exists`);
        return false;
      }
      if (!recursive) {
        for (const key in this.data) {
          if (key != path && key.startsWith(path + "/")) {
            this.log(`Directory not empty: ${path}`);
            return false;
          }
        }
      }
      const keysToDelete = Object.keys(this.data).filter(
        (key) => key == path || key.startsWith(path + "/")
      );
      for (const key of keysToDelete) {
        delete this.data[key];
      }
      this.log(`Deleted directory [${path}]`);
      return true;
    }
    async listDir(path) {
      path = this.getPath(path);
      if (!await this.existsDir(path)) {
        throw error(`Directory not found: ${path}`);
      }
      const result = /* @__PURE__ */ new Set();
      for (const key in this.data) {
        if (key == path) continue;
        if (key.startsWith(path + "/")) {
          const subPath = key.substring(path.length + 1);
          const slashIndex = subPath.indexOf("/");
          const name = slashIndex == -1 ? subPath : subPath.substring(0, slashIndex);
          result.add(name);
        }
      }
      return Array.from(result);
    }
    async rename(oldPath, newPath) {
      oldPath = this.getPath(oldPath);
      newPath = this.getPath(newPath);
      if (!await this.exists(oldPath)) {
        this.log(`Rename failed: source [${oldPath}] does not exist`);
        return false;
      }
      if (await this.exists(newPath)) {
        this.log(`Rename failed: target [${newPath}] already exists`);
        return false;
      }
      const isDir = await this.isDirectory(oldPath);
      const oldContent = this.data[oldPath];
      if (isDir) {
        const entries = Object.keys(this.data).filter(
          (k) => k.startsWith(oldPath + "/")
        );
        for (const key of entries) {
          const suffix = key.substring(oldPath.length);
          this.data[newPath + suffix] = this.data[key];
          delete this.data[key];
        }
      } else {
        this.data[newPath] = oldContent;
        delete this.data[oldPath];
      }
      this.log(`Renamed [${oldPath}] \u2192 [${newPath}]`);
      return true;
    }
    async copyFile(fromPath, toPath) {
      fromPath = this.getPath(fromPath);
      toPath = this.getPath(toPath);
      if (!await this.existsFile(fromPath)) {
        this.log(`Copy failed: source file [${fromPath}] does not exist`);
        return false;
      }
      if (await this.exists(toPath)) {
        this.log(`Copy failed: target file [${toPath}] already exists`);
        return false;
      }
      const content = this.data[fromPath].content;
      this.data[toPath] = { content, isDir: false };
      this.log(`Copied [${fromPath}] \u2192 [${toPath}]`);
      return true;
    }
    async move(fromPath, toPath) {
      fromPath = this.getPath(fromPath);
      toPath = this.getPath(toPath);
      if (await this.copyFile(fromPath, toPath)) {
        this.log(`Move ${fromPath} - ${toPath}`);
        return await this.deleteFile(fromPath);
      }
      this.log(`Can't move ${fromPath} - ${toPath}`);
      return false;
    }
    async erase() {
      this.data = {};
      return true;
    }
    async getSHA1(path) {
      path = this.getPath(path);
      const bytes = await this.readFileBytes(path);
      const hashBuffer = await global.crypto.subtle.digest("SHA-1", bytes);
      const hashArray = global.Array.from(new global.Uint8Array(hashBuffer));
      return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
    }
  };

  // core/src/fs/fs.ts
  var FS = class _FS {
    logDebug = false;
    backend;
    type = "OPFS";
    async init(type = "auto", root) {
      if (type == "auto") {
        type = "InMemory";
        if ("Indexeddb" in window) type = "Indexeddb";
        if (typeof navigator.storage != "undefined") type = "OPFS";
      }
      this.type = type;
      await this.changeBackend(type, root, true);
      console.log("Filesystem initialized");
    }
    async changeBackend(type = "InMemory", root, force = false) {
      const t = type.toLowerCase();
      if (this.type == type && !force) return;
      if (t == "opfs") {
        if (location.protocol == "file:") throw new Error(`OPFS doesn't work on protocol file://`);
        if (!root || !(root instanceof FileSystemDirectoryHandle)) root = await navigator.storage.getDirectory();
        this.backend = new OPFS(root);
      } else if (t == "indexeddb") {
        const backend = new IndexedDB(typeof root == "string" ? root : "BafiaOnline");
        await backend.init();
        this.backend = backend;
      } else if (t == "inmemory") {
        this.backend = new InMemoryFS();
      } else {
        throw new Error("No backend");
      }
      this.type = type;
      console.log("FS Type: " + type);
      this.backend.logDebug = false;
    }
    static async get(type = "InMemory", root) {
      return await new _FS().init(type, root);
    }
    getMimeType(path) {
      const extension = path.toLowerCase().split(".").pop() || "";
      const mimeTypes = {
        // Images
        "png": "image/png",
        "jpg": "image/jpeg",
        "jpeg": "image/jpeg",
        "gif": "image/gif",
        "bmp": "image/bmp",
        "webp": "image/webp",
        "svg": "image/svg+xml",
        "ico": "image/x-icon",
        // Audio
        "mp3": "audio/mpeg",
        "wav": "audio/wav",
        "ogg": "audio/ogg",
        "m4a": "audio/mp4",
        // Video
        "mp4": "video/mp4",
        "webm": "video/webm",
        "mov": "video/quicktime",
        // Documents
        "txt": "text/plain",
        "html": "text/html",
        "htm": "text/html",
        "css": "text/css",
        "js": "application/javascript",
        "json": "application/json",
        "xml": "application/xml",
        "pdf": "application/pdf",
        // Archives
        "zip": "application/zip",
        "rar": "application/x-rar-compressed",
        "7z": "application/x-7z-compressed",
        "tar": "application/x-tar",
        "gz": "application/gzip",
        // Other
        "bin": "application/octet-stream",
        "exe": "application/octet-stream",
        "dll": "application/octet-stream"
      };
      return mimeTypes[extension] || "application/octet-stream";
    }
    createFile(path) {
      return this.backend.createFile(path);
    }
    writeFile(path, data) {
      return this.backend.writeFile(path, data);
    }
    readFile(path) {
      return this.backend.readFile(path);
    }
    readFileBytes(path) {
      return this.backend.readFileBytes(path);
    }
    readFileB64(path) {
      return this.backend.readFileB64(path);
    }
    createDir(path) {
      return this.backend.createDir(path);
    }
    existsDir(path) {
      return this.backend.existsDir(path);
    }
    existsFile(path) {
      return this.backend.existsFile(path);
    }
    exists(path) {
      return this.backend.exists(path);
    }
    isFile(path) {
      return this.backend.isFile(path);
    }
    isDirectory(path) {
      return this.backend.isDirectory(path);
    }
    deleteFile(path) {
      return this.backend.deleteFile(path);
    }
    deleteDirectory(path, recursive) {
      return this.backend.deleteDirectory(path, recursive);
    }
    listDir(path) {
      return this.backend.listDir(path);
    }
    rename(oldPath, newPath) {
      return this.backend.rename(oldPath, newPath);
    }
    copyFile(fromPath, toPath) {
      return this.backend.copyFile(fromPath, toPath);
    }
    move(fromPath, toPath) {
      return this.backend.move(fromPath, toPath);
    }
    loadImage(path) {
      return this.backend.loadImage(path);
    }
    loadImageAsDataURL(path) {
      return this.backend.loadImageAsDataURL(path);
    }
    erase() {
      return this.backend.erase();
    }
    getSHA1(path) {
      return this.backend.getSHA1(path);
    }
  };
  var fs_default = new FS();

  // core/src/Events.ts
  var EventHandle = class {
    constructor(event, callback, owner, priorityName = 2 /* NORMAL */) {
      this.event = event;
      this.callback = callback;
      this.owner = owner;
      this.priorityName = priorityName;
    }
    keyName;
    key(name) {
      this.keyName = name;
      return this;
    }
    getKey() {
      return this.keyName;
    }
    priority(priority) {
      this.priorityName = priority;
      return this;
    }
    getPriority() {
      return this.priorityName;
    }
    remove() {
      this.owner["_removeHandle"](this);
    }
  };
  var Events = class {
    customListeners = {};
    on(evt, callback, priority = 2 /* NORMAL */) {
      const handle = new EventHandle(evt, callback, this, priority);
      let arr = this.customListeners[evt];
      if (!arr) {
        arr = [];
        this.customListeners[evt] = arr;
      }
      let i = arr.findIndex((h) => h.getPriority() > priority);
      if (i === -1) {
        arr.push(handle);
      } else {
        arr.splice(i, 0, handle);
      }
      return handle;
    }
    once(evt, callback, priority = 2 /* NORMAL */) {
      const wrapper = ((...args) => {
        callback(...args);
        this.off(evt, wrapper);
      });
      return this.on(evt, wrapper, priority);
    }
    off(evt, callback) {
      const arr = this.customListeners[evt];
      if (!arr) return false;
      const before = arr.length;
      this.customListeners[evt] = arr.filter((h) => h.callback !== callback);
      return arr.length < before;
    }
    /**
     * Объект(событие) может измениться
     */
    async call(evt, event = void 0) {
      const arr = this.customListeners[evt];
      if (!arr) return event;
      for (const h of arr) {
        const r = h.callback(event);
        if (r instanceof Promise) await r;
      }
      return event;
    }
    /**
     * Синхронный вызов слушателей (с приоритетом)
     */
    emit(evt, ...args) {
      const arr = this.customListeners[evt];
      if (!arr) return false;
      for (const h of arr) {
        h.callback(...args);
      }
      return arr.length > 0;
    }
    /**
     * Асинхронный вызов слушателей (с приоритетом, собирает результаты)
     */
    async emitR(evt, ...args) {
      const arr = this.customListeners[evt];
      if (!arr) return [];
      const results = [];
      for (const h of arr) {
        const r = h.callback(...args);
        results.push(r instanceof Promise ? await r : r);
      }
      return results;
    }
    async wait(type, timeout = 1e7) {
      return new Promise((resolve, reject) => {
        const timer = setTimeout(() => {
          this.off(type, func);
        }, timeout);
        const func = (...args) => {
          clearTimeout(timer);
          this.off("message", func);
          resolve(args);
        };
        this.on(type, func);
      });
    }
    removeByKey(key) {
      let removed = false;
      for (const evt in this.customListeners) {
        const arr = this.customListeners[evt];
        if (!arr) continue;
        const before = arr.length;
        this.customListeners[evt] = arr.filter((h) => h.getKey() !== key);
        if (this.customListeners[evt].length < before) removed = true;
      }
      return removed;
    }
    _removeHandle(handle) {
      const arr = this.customListeners[handle.event];
      if (!arr) return;
      this.customListeners[handle.event] = arr.filter((h) => h !== handle);
    }
    removeAllEvents() {
      this.customListeners = {};
    }
  };

  // core/version.json
  var version_default = {
    launcher: "Alpha 1.1.1",
    vanilla: "Alpha 1.1.1"
  };

  // launcher/src/App.ts
  var App = class extends Events {
    version = version_default.launcher;
    windowsElem;
    launcher;
    constructor() {
      super();
      this.windowsElem = document.createElement("div");
      this.windowsElem.style.width = "100%";
      this.windowsElem.style.height = window.innerHeight + "px";
      document.body.appendChild(this.windowsElem);
      this.#initEvents();
    }
    #initEvents() {
      window.addEventListener("focus", (e) => this.emit("focus", e), true);
      window.addEventListener("blur", (e) => this.emit("unfocus", e), true);
      window.addEventListener("click", (e) => this.emit("click", e), true);
      window.addEventListener("keydown", (e) => this.emit("keydown", e), true);
      window.addEventListener("keyup", (e) => this.emit("keyup", e), true);
      window.addEventListener("wheel", (e) => this.emit("wheel", e), true);
      window.addEventListener("resize", (e) => this.emit("resize"), true);
    }
  };
  var App_default = new App();

  // core/src/utils/mobile.ts
  function isMobile() {
    return window.navigator.maxTouchPoints || "ontouchstart" in document;
  }

  // core/src/utils/TypeScript.ts
  function wrap(obj, prop, onSet, onGet) {
    let val = obj[prop];
    Object.defineProperty(obj, prop, {
      get: () => onGet ? onGet() : val,
      set: (v) => {
        onSet?.(v);
        val = v;
      },
      enumerable: true
    });
  }

  // core/src/utils/utils.ts
  var global2 = window;
  function getZoom() {
    const style = global2.getComputedStyle(document.body);
    const transform = style.transform;
    const zoom = global2.parseFloat(style.zoom || "1");
    if (transform && transform != "none") {
      const match = transform.match(/matrix\(([\d.]+),/);
      if (match) return global2.parseFloat(match[1]);
    }
    return global2.isNaN(zoom) ? 1 : zoom;
  }
  function error2(...message) {
    const msg = message.join("\n");
    console.error(msg);
    return msg;
  }
  function wait(timeout = 0) {
    return new Promise((res) => setTimeout(res, timeout));
  }
  async function decompress(data) {
    const isGzip = data[0] == 31 && data[1] == 139;
    if (!isGzip) throw error2("Data are not compressed gzip");
    try {
      const stream = new global2.Blob([data]).stream().pipeThrough(new global2.DecompressionStream("gzip"));
      return new global2.Uint8Array(await new global2.Response(stream).arrayBuffer());
    } catch (err) {
      console.error("Decompression error:", err);
      throw error2(err);
    }
  }
  function createScript(options) {
    const script = document.createElement("script");
    if (!options.remove) options.remove = true;
    function func(callback) {
      if (options.remove) script.remove();
      callback();
    }
    if (options.src) script.src = options.src;
    if (options.type) script.type = options.type;
    if (options.async) script.async = options.async;
    if (options.html) script.innerHTML = options.html;
    if (options.defer) script.defer = options.defer;
    if (options.toBody) document.body.appendChild(script);
    else document.head.appendChild(script);
    return new Promise((res, rej) => {
      script.onload = () => func(res);
      script.onerror = () => func(rej);
      if (options.type == "importmap") res(1);
    });
    ;
  }
  function noXSS(input) {
    return String(input).replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&#x2F;/gi, "/");
  }

  // launcher/src/Window.ts
  function drag(win, event) {
    const el = win.el;
    const zoom = getZoom();
    const startX = event.clientX / zoom, startY = event.clientY / zoom;
    const origX = el.offsetLeft ?? win.x, origY = el.offsetTop ?? win.y;
    const deltaX = startX - origX, deltaY = startY - origY;
    function downHandler(e) {
    }
    function moveHandler(e) {
      let x = e.clientX / zoom - deltaX, y = e.clientY / zoom - deltaY;
      let ox = el.offsetLeft, oy = el.offsetTop, oh = el.offsetHeight, ow = el.offsetWidth, or = ox + ow, ob = oy + oh;
      event.stopPropagation?.();
      event.preventDefault?.();
      if (y < 2 && oy > 1) y = 0;
      win.x = x;
      if (y >= 0 && oy >= 0) win.y = y;
    }
    function upHandler(e) {
      if (document.removeEventListener) {
        document.removeEventListener("mousedown", downHandler, true);
        document.removeEventListener("mouseup", upHandler, true);
        document.removeEventListener("mousemove", moveHandler, true);
      } else if (document.detachEvent) {
        el.detachEvent("onlosecapture", upHandler);
        el.detachEvent("onmousedown", downHandler);
        el.detachEvent("onmouseup", upHandler);
        el.detachEvent("onmousemove", moveHandler);
        el.releaseCapture();
      } else {
        document.onmouseup = olduphandler;
        document.onmousemove = oldmovehandler;
      }
      win.saveRelativePosition();
      event.stopPropagation?.();
      event.preventDefault?.();
    }
    if (document.addEventListener) {
      document.addEventListener("mousedown", downHandler, true);
      document.addEventListener("mousemove", moveHandler, true);
      document.addEventListener("mouseup", upHandler, true);
    } else if (document.attachEvent) {
      el.setCapture();
      el.attachEvent("onmousedown", downHandler);
      el.attachEvent("onmousemove", moveHandler);
      el.attachEvent("onmouseup", upHandler);
      el.attachEvent("onclosecapture", upHandler);
    } else {
      var oldmovehandler = document.onmousemove;
      var olduphandler = document.onmouseup;
      document.onmousemove = moveHandler;
      document.onmouseup = upHandler;
    }
    event.stopPropagation?.();
    event.preventDefault?.();
  }
  function resizableDrag(win, event, direction) {
    if (!win.resizable) return;
    const el = win.el;
    const zoom = getZoom();
    const startX = event.clientX / zoom, startY = event.clientY / zoom;
    const startWidth = el.clientWidth, startHeight = el.clientHeight;
    const startLeft = el.offsetLeft ?? win.x, startTop = el.offsetTop ?? win.y;
    function moveHandler(e) {
      if (!win.resizable) return;
      const currX = e.clientX / zoom;
      const currY = e.clientY / zoom;
      let newWidth = startWidth;
      let newHeight = startHeight;
      let newLeft = startLeft;
      let newTop = startTop;
      if (direction.includes("e")) {
        newWidth = Math.max(win.minWidth, startWidth + (currX - startX));
      }
      if (direction.includes("s")) {
        newHeight = Math.max(win.minHeight, startHeight + (currY - startY));
      }
      if (direction.includes("w")) {
        newWidth = Math.max(win.minWidth, startWidth - (currX - startX));
        newLeft = startLeft + (currX - startX);
      }
      if (direction.includes("n")) {
        newHeight = Math.max(win.minHeight, startHeight - (currY - startY));
        newTop = startTop + (currY - startY);
      }
      e.stopPropagation?.();
      e.preventDefault?.();
      win.width = newWidth;
      win.height = newHeight;
      if (newWidth > win.minWidth && direction.includes("w")) win.x = newLeft;
      if (newHeight > win.minHeight && direction.includes("n")) win.y = newTop;
    }
    function upHandler(e) {
      document.removeEventListener("mousemove", moveHandler, true);
      document.removeEventListener("mouseup", upHandler, true);
      e.stopPropagation?.();
    }
    document.addEventListener("mousemove", moveHandler, true);
    document.addEventListener("mouseup", upHandler, true);
    event.stopPropagation?.();
    event.preventDefault?.();
  }
  var WindowManager = new class extends Events {
    id = 0;
    windows = [];
    activeWindow = null;
    add(win) {
      if (this.windows.includes(win)) return;
      if (!win.isAlive) return;
      this.windows.push(win);
      this.call("open", win);
    }
    remove(win) {
      const index = this.windows.indexOf(win);
      if (index != -1) {
        this.windows.splice(index, 1);
        this.call("close", win);
      }
    }
    addzIndex(win) {
      const currentZ = win.zIndex;
      let maxZ = 0;
      for (const win2 of this.windows) {
        maxZ = Math.max(maxZ, win2.zIndex);
      }
      return currentZ < maxZ ? maxZ + 1 : currentZ;
    }
    activate(win) {
      this.activeWindow = win;
      this.call("activate", win);
    }
    deactivate(win) {
      if (win == this.activeWindow) {
        this.activeWindow = null;
        this.call("deactivate", win);
      }
    }
  }();
  var Window = class extends Events {
    constructor(options) {
      super();
      this.options = options;
      const zoom = getZoom();
      this.title = options.title ?? "Window";
      this.width = options.width ?? 500;
      this.height = options.height ?? 500;
      this.minWidth = options.minWidth ?? 100;
      this.minHeight = options.minHeight ?? 100;
      this.x = options.center ? (window.innerWidth / zoom - this.width) / 2 : options.x ?? 0;
      this.y = options.center ? (window.innerHeight / zoom - this.height) / 2 : options.y ?? 0;
      this.titleBarHeight = options.titleBarHeight ?? 16;
      this.resizable = options.resizable ?? true;
      this.moveable = options.moveable ?? true;
      this.hasTitleBar = options.hasTitleBar ?? true;
      this.closeButton = options.closeButton ?? true;
      this.minButton = options.minButton ?? true;
      this.maxButton = options.maxButton ?? true;
      this.zoom = options.zoom ?? 1;
      const isM = isMobile() && !options.noMobile;
      if (isM) {
        this.x = 0;
        this.y = 0;
        this.width = window.innerWidth / zoom;
        this.height = window.innerHeight / zoom;
        this.hasTitleBar = false;
      }
      wrap(this, "width", (v) => {
        this.el.style.width = v + "px";
        this.emit("resize", { oldWidth: this.width, oldHeight: this.height });
      });
      wrap(this, "height", (v) => {
        this.el.style.height = v + "px";
        this.emit("resize", { oldWidth: this.width, oldHeight: this.height });
      });
      wrap(this, "x", (v) => {
        this.el.style.left = v + "px";
        this.emit("resize", { oldWidth: this.width, oldHeight: this.height });
      });
      wrap(this, "y", (v) => {
        this.el.style.top = v + "px";
        this.emit("resize", { oldWidth: this.width, oldHeight: this.height });
      });
      WindowManager.add(this);
      this.#init();
      this.activate();
      if (isM) this.max();
    }
    isAlive = true;
    isActivated = true;
    isMaximum = false;
    isLocked = false;
    doActivate = true;
    content;
    titleBar;
    el;
    zIndex = WindowManager.id + 1;
    id = WindowManager.id++;
    pid = -1;
    title = "Window";
    x = 0;
    y = 0;
    width = 0;
    height = 0;
    minWidth = 0;
    minHeight = 0;
    titleBarHeight = 0;
    resizable = false;
    moveable = false;
    hasTitleBar = false;
    closeButton = false;
    minButton = false;
    maxButton = false;
    zoom = 0;
    oldPos = { x: 0, y: 0, width: 0, height: 0 };
    #init() {
      this.el = document.createElement("div");
      this.el.classList.add("win");
      this.el.style.position = "absolute";
      this.el.style.width = this.width + "px";
      this.el.style.height = this.height + "px";
      this.el.style.left = this.x + "px";
      this.el.style.top = this.y + "px";
      this.el.id = `win_${this.id}`;
      this.el.onmousedown = (e) => {
        if (!this.hasTitleBar) this.drag(e);
        return true;
      };
      this.titleBar = document.createElement("div");
      this.titleBar.classList.add("titleBar");
      this.titleBar.style.display = this.hasTitleBar ? "display" : "none";
      this.titleBar.onmousedown = (e) => this.drag(e);
      const closeBtn = document.createElement("div");
      closeBtn.classList.add("closeBtn");
      closeBtn.style.display = !this.closeButton ? "none" : "block";
      closeBtn.style.top = (this.titleBarHeight - 10) / 2 - 1 + "px";
      closeBtn.onclick = () => this.close();
      const minBtn = document.createElement("div");
      minBtn.classList.add("minBtn");
      minBtn.style.display = !this.minButton ? "none" : "block";
      minBtn.style.top = (this.titleBarHeight - 10) / 2 - 1 + "px";
      minBtn.onclick = () => this.min();
      const maxBtn = document.createElement("div");
      maxBtn.classList.add("maxBtn");
      maxBtn.style.display = !this.maxButton ? "none" : "block";
      maxBtn.style.top = (this.titleBarHeight - 10) / 2 - 1 + "px";
      maxBtn.onclick = () => this.max();
      const title = document.createElement("div");
      title.classList.add("title");
      title.innerHTML = this.title;
      wrap(this, "title", (v) => title.textContent = noXSS(v));
      const corners = [
        { dir: "se", style: { background: "transparent", position: "absolute", width: "8px", height: "8px", zIndex: "10", right: "0px", bottom: "0px", cursor: "nwse-resize" } },
        { dir: "ne", style: { background: "transparent", position: "absolute", width: "8px", height: "8px", zIndex: "10", right: "0px", top: "0px", cursor: "nesw-resize" } },
        { dir: "nw", style: { background: "transparent", position: "absolute", width: "8px", height: "8px", zIndex: "10", left: "0px", top: "0px", cursor: "nwse-resize" } },
        { dir: "sw", style: { background: "transparent", position: "absolute", width: "8px", height: "8px", zIndex: "10", left: "0px", bottom: "0px", cursor: "nesw-resize" } }
      ];
      for (const corner of corners) {
        const handle = document.createElement("div");
        for (const s in corner.style) handle.style[s] = corner.style[s];
        handle.onmousedown = (e) => this.resize(e, corner.dir);
        this.el.appendChild(handle);
      }
      const edges = [
        { dir: "e", style: { background: "transparent", position: "absolute", zIndex: "5", right: "0px", top: "0px", bottom: "0px", width: "2px", cursor: "ew-resize" } },
        { dir: "w", style: { background: "transparent", position: "absolute", zIndex: "5", left: "0px", top: "0px", bottom: "0px", width: "2px", cursor: "ew-resize" } },
        { dir: "n", style: { background: "transparent", position: "absolute", zIndex: "5", top: "0px", left: "0px", right: "0px", height: "2px", cursor: "ns-resize" } },
        { dir: "s", style: { background: "transparent", position: "absolute", zIndex: "5", bottom: "0px", left: "0px", right: "0px", height: "2px", cursor: "ns-resize" } }
      ];
      for (const edge of edges) {
        const handle = document.createElement("div");
        for (const s in edge.style) handle.style[s] = edge.style[s];
        handle.onmousedown = (e) => this.resize(e, edge.dir);
        this.el.appendChild(handle);
      }
      const content = document.createElement("div");
      content.classList.add("content");
      content.tabIndex = 1;
      content.style.height = `calc(100% - ${this.titleBarHeight}px)`;
      content.onmousedown = (e) => this.activate.bind(this);
      this.content = document.createElement("div");
      this.content.style.display = "block";
      this.content.id = `content_${this.id}`;
      this.content.style.zoom = this.zoom + "";
      content.appendChild(this.content);
      this.titleBar.appendChild(closeBtn);
      this.titleBar.appendChild(minBtn);
      this.titleBar.appendChild(maxBtn);
      this.titleBar.appendChild(title);
      this.el.appendChild(this.titleBar);
      this.el.appendChild(content);
      App_default.windowsElem.appendChild(this.el);
    }
    drag(e) {
      this.activate();
      if (this.isMaximum) return;
      if (this.moveable)
        drag(this, e);
    }
    resize(event, direction) {
      if (this.isMaximum || !this.resizable) return;
      resizableDrag(this, event, direction);
    }
    activate() {
      WindowManager.windows.forEach((e) => e.deactivate());
      if (this.doActivate) WindowManager.activate(this);
      this.isActivated = true;
      this.zIndex = WindowManager.addzIndex(this);
      this.el.style.zIndex = this.zIndex + "";
    }
    deactivate() {
      this.isActivated = false;
      if (this.doActivate) WindowManager.deactivate(this);
    }
    lock() {
      if (this.isLocked) return;
      this.isLocked = true;
      this.el.style.pointerEvents = "none";
      this.el.style.userSelect = "none";
      this.el.style.filter = "brightness(0.5)";
    }
    unlock() {
      if (!this.isLocked) return;
      this.isLocked = false;
      this.el.style.pointerEvents = "all";
      this.el.style.userSelect = "text";
      this.el.style.filter = "none";
    }
    show() {
      this.el.style.display = "block";
    }
    hide() {
      this.el.style.display = "none";
      this.deactivate();
    }
    min() {
      this.hide();
    }
    max() {
      this.isMaximum = !this.isMaximum;
      if (!this.isMaximum) {
        App_default.removeByKey(`max_win_${this.id}`);
        this.el.style.outline = "";
        this.el.style.transition = ".5s";
        this.x = this.oldPos.x;
        this.y = this.oldPos.y;
        this.width = this.oldPos.width;
        this.height = this.oldPos.height;
        wait(500).then(() => this.el.style.transition = "");
        return;
      }
      const zoom = getZoom();
      this.oldPos = { x: this.x, y: this.y, width: this.width, height: this.height };
      this.el.style.transition = ".5s";
      this.x = 0;
      this.y = 1;
      this.width = innerWidth / zoom;
      this.height = innerHeight / zoom;
      App_default.on("resize", () => {
        const zoom2 = getZoom();
        this.width = innerWidth / zoom2;
        this.height = innerHeight / zoom2;
      }).key(`max_win_${this.id}`);
      wait(500).then(() => {
        this.el.style.transition = "";
        this.el.style.outline = "none";
      });
    }
    // setSize(width: number, height: number) {
    //     if(this.minWidth > width) return
    //     if(this.minHeight > height) return
    //     this.width = width;
    //     this.height = height;
    //     this.el.style.transition = 'none';
    //     this.el.style.width = width+'px';
    //     this.el.style.height = width+'px';
    //     this.el.style.transition = 'width 1s ease, height 1s ease';
    // }
    _relativeToCenter = null;
    get relativeToCenter() {
      const width = window.innerWidth;
      const height = window.innerHeight;
      if (!this._relativeToCenter) this.saveRelativePosition(width, height);
      return this._relativeToCenter;
    }
    saveRelativePosition(logicalWidth, logicalHeight) {
      if (typeof logicalWidth == "undefined") logicalWidth = window.innerWidth;
      if (typeof logicalHeight == "undefined") logicalHeight = window.innerHeight;
      const centerX = logicalWidth / 2;
      const centerY = logicalHeight / 2;
      return this._relativeToCenter = {
        dx: this.x - centerX,
        dy: this.y - centerY
      };
    }
    updatePositionFromRelative(logicalWidth, logicalHeight) {
      const centerX = logicalWidth / 2;
      const centerY = logicalHeight / 2;
      this.x = centerX + this.relativeToCenter.dx;
      this.y = centerY + this.relativeToCenter.dy;
    }
    async close(force = false) {
      const e = await this.call("close", { isCancelled: false });
      if (e.isCancelled && !force) return;
      this.el.remove();
      this.isAlive = false;
      this.removeAllEvents();
      WindowManager.remove(this);
    }
  };

  // core/src/lib/cbor.js
  var POW_2_24 = 5960464477539063e-23;
  var POW_2_32 = 4294967296;
  var POW_2_53 = 9007199254740992;
  function encode(value) {
    let data = new ArrayBuffer(256);
    let dataView = new DataView(data);
    let lastLength;
    let offset = 0;
    function prepareWrite(length) {
      let newByteLength = data.byteLength;
      const requiredLength = offset + length;
      while (newByteLength < requiredLength)
        newByteLength <<= 1;
      if (newByteLength !== data.byteLength) {
        const oldDataView = dataView;
        data = new ArrayBuffer(newByteLength);
        dataView = new DataView(data);
        const uint32count = offset + 3 >> 2;
        for (let i = 0; i < uint32count; ++i)
          dataView.setUint32(i << 2, oldDataView.getUint32(i << 2));
      }
      lastLength = length;
      return dataView;
    }
    function commitWrite() {
      offset += lastLength;
    }
    function writeFloat64(value2) {
      commitWrite(prepareWrite(8).setFloat64(offset, value2));
    }
    function writeUint8(value2) {
      commitWrite(prepareWrite(1).setUint8(offset, value2));
    }
    function writeUint8Array(value2) {
      const dataView2 = prepareWrite(value2.length);
      for (let i = 0; i < value2.length; ++i)
        dataView2.setUint8(offset + i, value2[i]);
      commitWrite();
    }
    function writeUint16(value2) {
      commitWrite(prepareWrite(2).setUint16(offset, value2));
    }
    function writeUint32(value2) {
      commitWrite(prepareWrite(4).setUint32(offset, value2));
    }
    function writeUint64(value2) {
      const low = value2 % POW_2_32;
      const high = (value2 - low) / POW_2_32;
      const dataView2 = prepareWrite(8);
      dataView2.setUint32(offset, high);
      dataView2.setUint32(offset + 4, low);
      commitWrite();
    }
    function writeTypeAndLength(type, length) {
      if (length < 24) {
        writeUint8(type << 5 | length);
      } else if (length < 256) {
        writeUint8(type << 5 | 24);
        writeUint8(length);
      } else if (length < 65536) {
        writeUint8(type << 5 | 25);
        writeUint16(length);
      } else if (length < 4294967296) {
        writeUint8(type << 5 | 26);
        writeUint32(length);
      } else {
        writeUint8(type << 5 | 27);
        writeUint64(length);
      }
    }
    function encodeItem(value2) {
      let i;
      if (value2 === false)
        return writeUint8(244);
      if (value2 === true)
        return writeUint8(245);
      if (value2 === null)
        return writeUint8(246);
      if (value2 === void 0)
        return writeUint8(247);
      switch (typeof value2) {
        case "number":
          if (Math.floor(value2) === value2) {
            if (0 <= value2 && value2 <= POW_2_53)
              return writeTypeAndLength(0, value2);
            if (-POW_2_53 <= value2 && value2 < 0)
              return writeTypeAndLength(1, -(value2 + 1));
          }
          writeUint8(251);
          return writeFloat64(value2);
        case "string":
          const utf8data = [];
          for (i = 0; i < value2.length; ++i) {
            let charCode = value2.charCodeAt(i);
            if (charCode < 128) {
              utf8data.push(charCode);
            } else if (charCode < 2048) {
              utf8data.push(192 | charCode >> 6);
              utf8data.push(128 | charCode & 63);
            } else if (charCode < 55296) {
              utf8data.push(224 | charCode >> 12);
              utf8data.push(128 | charCode >> 6 & 63);
              utf8data.push(128 | charCode & 63);
            } else {
              charCode = (charCode & 1023) << 10;
              charCode |= value2.charCodeAt(++i) & 1023;
              charCode += 65536;
              utf8data.push(240 | charCode >> 18);
              utf8data.push(128 | charCode >> 12 & 63);
              utf8data.push(128 | charCode >> 6 & 63);
              utf8data.push(128 | charCode & 63);
            }
          }
          writeTypeAndLength(3, utf8data.length);
          return writeUint8Array(utf8data);
        default:
          let length;
          if (Array.isArray(value2)) {
            length = value2.length;
            writeTypeAndLength(4, length);
            for (i = 0; i < length; ++i)
              encodeItem(value2[i]);
          } else if (value2 instanceof Uint8Array) {
            writeTypeAndLength(2, value2.length);
            writeUint8Array(value2);
          } else {
            let keys = Object.keys(value2);
            length = keys.length;
            writeTypeAndLength(5, length);
            for (i = 0; i < length; ++i) {
              let key = keys[i];
              encodeItem(key);
              encodeItem(value2[key]);
            }
          }
      }
    }
    encodeItem(value);
    if ("slice" in data)
      return data.slice(0, offset);
    const ret = new ArrayBuffer(offset);
    const retView = new DataView(ret);
    for (let i = 0; i < offset; ++i)
      retView.setUint8(i, dataView.getUint8(i));
    return ret;
  }
  function decode(data, tagger, simpleValue) {
    const dataView = new DataView(data);
    let offset = 0;
    if (typeof tagger !== "function")
      tagger = function(value) {
        return value;
      };
    if (typeof simpleValue !== "function")
      simpleValue = function() {
        return void 0;
      };
    function commitRead(length, value) {
      offset += length;
      return value;
    }
    function readArrayBuffer(length) {
      return commitRead(length, new Uint8Array(data, offset, length));
    }
    function readFloat16() {
      const tempArrayBuffer = new ArrayBuffer(4);
      const tempDataView = new DataView(tempArrayBuffer);
      const value = readUint16();
      const sign = value & 32768;
      let exponent = value & 31744;
      const fraction = value & 1023;
      if (exponent === 31744)
        exponent = 255 << 10;
      else if (exponent !== 0)
        exponent += 127 - 15 << 10;
      else if (fraction !== 0)
        return (sign ? -1 : 1) * fraction * POW_2_24;
      tempDataView.setUint32(0, sign << 16 | exponent << 13 | fraction << 13);
      return tempDataView.getFloat32(0);
    }
    function readFloat32() {
      return commitRead(4, dataView.getFloat32(offset));
    }
    function readFloat64() {
      return commitRead(8, dataView.getFloat64(offset));
    }
    function readUint8() {
      return commitRead(1, dataView.getUint8(offset));
    }
    function readUint16() {
      return commitRead(2, dataView.getUint16(offset));
    }
    function readUint32() {
      return commitRead(4, dataView.getUint32(offset));
    }
    function readUint64() {
      return readUint32() * POW_2_32 + readUint32();
    }
    function readBreak() {
      if (dataView.getUint8(offset) !== 255)
        return false;
      offset += 1;
      return true;
    }
    function readLength(additionalInformation) {
      if (additionalInformation < 24)
        return additionalInformation;
      if (additionalInformation === 24)
        return readUint8();
      if (additionalInformation === 25)
        return readUint16();
      if (additionalInformation === 26)
        return readUint32();
      if (additionalInformation === 27)
        return readUint64();
      if (additionalInformation === 31)
        return -1;
      throw "Invalid length encoding";
    }
    function readIndefiniteStringLength(majorType) {
      const initialByte = readUint8();
      if (initialByte === 255)
        return -1;
      let length = readLength(initialByte & 31);
      if (length < 0 || initialByte >> 5 !== majorType)
        throw "Invalid indefinite length element";
      return length;
    }
    function appendUtf16Data(utf16data, length) {
      for (let i = 0; i < length; ++i) {
        let value = readUint8();
        if (value & 128) {
          if (value < 224) {
            value = (value & 31) << 6 | readUint8() & 63;
            length -= 1;
          } else if (value < 240) {
            value = (value & 15) << 12 | (readUint8() & 63) << 6 | readUint8() & 63;
            length -= 2;
          } else {
            value = (value & 15) << 18 | (readUint8() & 63) << 12 | (readUint8() & 63) << 6 | readUint8() & 63;
            length -= 3;
          }
        }
        if (value < 65536) {
          utf16data.push(value);
        } else {
          value -= 65536;
          utf16data.push(55296 | value >> 10);
          utf16data.push(56320 | value & 1023);
        }
      }
    }
    function decodeItem() {
      const initialByte = readUint8();
      const majorType = initialByte >> 5;
      const additionalInformation = initialByte & 31;
      let length, i;
      if (majorType === 7) {
        switch (additionalInformation) {
          case 25:
            return readFloat16();
          case 26:
            return readFloat32();
          case 27:
            return readFloat64();
        }
      }
      length = readLength(additionalInformation);
      if (length < 0 && (majorType < 2 || 6 < majorType))
        throw "Invalid length";
      switch (majorType) {
        case 0:
          return length;
        case 1:
          return -1 - length;
        case 2:
          if (length < 0) {
            const elements = [];
            let fullArrayLength = 0;
            while ((length = readIndefiniteStringLength(majorType)) >= 0) {
              fullArrayLength += length;
              elements.push(readArrayBuffer(length));
            }
            let fullArray = new Uint8Array(fullArrayLength);
            let fullArrayOffset = 0;
            for (i = 0; i < elements.length; ++i) {
              fullArray.set(elements[i], fullArrayOffset);
              fullArrayOffset += elements[i].length;
            }
            return fullArray;
          }
          return readArrayBuffer(length);
        case 3:
          const utf16data = [];
          if (length < 0) {
            while ((length = readIndefiniteStringLength(majorType)) >= 0)
              appendUtf16Data(utf16data, length);
          } else
            appendUtf16Data(utf16data, length);
          return String.fromCharCode.apply(null, utf16data);
        case 4:
          let retArray;
          if (length < 0) {
            retArray = [];
            while (!readBreak())
              retArray.push(decodeItem());
          } else {
            retArray = new Array(length);
            for (i = 0; i < length; ++i)
              retArray[i] = decodeItem();
          }
          return retArray;
        case 5:
          const retObject = {};
          for (i = 0; i < length || length < 0 && !readBreak(); ++i) {
            const key = decodeItem();
            retObject[key] = decodeItem();
          }
          return retObject;
        case 6:
          return tagger(decodeItem(), length);
        case 7:
          switch (length) {
            case 20:
              return false;
            case 21:
              return true;
            case 22:
              return null;
            case 23:
              return void 0;
            default:
              return simpleValue(length);
          }
      }
    }
    let ret = decodeItem();
    if (offset !== data.byteLength)
      throw "Remaining bytes";
    return ret;
  }
  var cbor_default = {
    encode,
    decode
  };

  // core/src/image.ts
  async function writeToFS(toPath = "/", structure, rewrite = false, start = () => {
  }, process = () => {
  }) {
    const entries = Object.entries(structure);
    start(entries.length);
    for (const [path, { data, sha1 }] of entries) {
      const filePath = `${toPath}${path}`;
      let shouldWrite = rewrite;
      if (!rewrite) {
        if (!await fs_default.existsFile(filePath)) {
          shouldWrite = true;
        } else {
          const currentSha1 = await fs_default.getSHA1(filePath);
          if (currentSha1 !== sha1) shouldWrite = true;
        }
      }
      if (shouldWrite) {
        await fs_default.writeFile(filePath, data);
        process(filePath, true);
      } else {
        process(filePath, false);
      }
    }
  }
  async function readImage(path, toPath = "/", rewrite = false, options) {
    const obj = window;
    let name = path.split("/").pop()?.split(".")[0] ?? "image";
    console.log(`Decompressing image ${path}..`);
    if (!obj[name]) throw error2("Image not found");
    try {
      const compressed = new Uint8Array(obj[name]);
      const decompressed = await decompress(compressed);
      const imageArray = cbor_default.decode(decompressed.buffer);
      const image = {};
      for (const entry of imageArray) {
        image[entry.path] = { data: entry.data, sha1: entry.sha1 };
      }
      delete obj[name];
      await writeToFS(toPath, image, rewrite, options?.startProcessFS, options?.processFS);
      return image;
    } catch (e) {
      throw error2("Image loading error\nThe image may be corrupted", e);
    }
  }

  // core/src/Constants.ts
  var uriServer = "wss://dottap.com:7091";

  // core/src/config.ts
  var defaultConfig = {
    path: "",
    version: 1,
    auth: null,
    debug: false,
    uriServer,
    userAgent: null
  };
  var config = defaultConfig;
  function get(key) {
    return config[key] == void 0 ? defaultConfig[key] : config[key];
  }
  function config_default(replaceConfig) {
    if (replaceConfig)
      config = replaceConfig;
    return {
      path: get("path"),
      version: get("version"),
      auth: get("auth"),
      debug: get("debug"),
      uriServer: get("uriServer"),
      userAgent: get("userAgent")
    };
  }

  // core/src/PacketDataKeys.ts
  var PacketDataKeys = {
    ACCEPTED: "a",
    ACCEPT_MESSAGES: "ac",
    ACTIVE: "ac",
    ACTIVITY: "ac",
    ADD_CLIENT_TO_CHAT: "acc",
    ADD_CLIENT_TO_DASHBOARD: "acd",
    ADD_CLIENT_TO_FRIENDSHIP_LIST: "acfl",
    ADD_CLIENT_TO_PRIVATE_CHAT: "acpc",
    ADD_CLIENT_TO_ROOMS_LIST: "acrl",
    ADD_FRIEND: "af",
    ADD: "add",
    ADD_PLAYER: "ap",
    ADMIN_BLOCK_USER: "abu",
    ADMIN_CONTROL_USER: "acu",
    ADMIN: "adm",
    ADMIN_KICK_USER: "aku",
    ADMIN_UNBLOCK_USER: "auu",
    AFFECTED_BY_ROLES: "abr",
    ALIVE: "a",
    APP_LANGUAGE: "alc",
    ASPIRIN: "a",
    BACKPACK: "bp",
    BILLING_APP_PACKAGE: "bapckg",
    BILLING_PRODUCT_ID: "bpid",
    BILLING_PURCHASE_PENDING: "bppndng",
    BILLING_PURCHASE_TOKEN: "bptkn",
    BLOCKED_USERS: "bus",
    BLOCK_DEVICE: "bdv",
    BLOCK_IP: "bi",
    BONUSES_ENABLED: "bns",
    BONUS_PRICE: "bp",
    BRIBE: "b",
    BUY_BILLING_MARKET_ITEM: "mrktgg",
    BUY_BILLING_MARKET_SUCCESS_ITEM: "bbmrktis",
    BUY_MARKET_ITEM: "bmrkti",
    BUY_MARKET_ITEM_SUCCESS: "bmrktis",
    CHAT_MESSAGE_CREATE: "cmc",
    CHECK_PLAYER_IS_IN_ROOM: "cpir",
    CIVILIAN_ALIVE: "c",
    CIVILIAN_ALL: "ca",
    CLEAN_VOTES_HISTORY: "cv",
    CLOUD_MESSAGING_TOKEN_IS_SAVED: "cmts",
    COMPLAINTS: "cmps",
    COMPLAINT: "cmp",
    CONDOM: "cm",
    CONFESSION: "cn",
    CONNECTION_CHECKER_PERIOD: "ccp",
    CONNECTION_INACTIVE_TIMEOUT: "cit",
    CREATED: "c",
    CREATE_PLAYER: "cp",
    CREATOR_BLOCKED: "crb",
    DATA: "data",
    DAYTIME: "d",
    DESCRIPTION: "dsc",
    DEVICE_ID: "d",
    EMAIL: "e",
    EMAIL_NOT_VERIFIED: "env",
    EMAIL_NOT_VERIFIED_MESSAGE_CREATE_TIMEOUT: "envmct",
    ERROR_FLOOD_DETECTED: "erfd",
    ERROR: "e",
    ERROR_OCCUR: "ero",
    EXPERIENCE: "ex",
    FILE: "f",
    FIRST_AID_KIT: "f",
    FIRST_NAME: "fn",
    FRIENDSHIP_FLAG: "fpf",
    FRIENDSHIP: "fp",
    FRIENDSHIP_LIST: "frl",
    FRIENDSHIP_LIST_LIMIT: "fll",
    FRIENDSHIP_LIST_LIMIT_FOR_VIP: "fllfv",
    FRIENDSHIP_REQUESTS: "fr",
    FRIENDS_IN_INVITE_LIST: "fiil",
    FRIEND_IN_ROOM: "fir",
    FRIEND_IS_INVITED: "fiinvtd",
    FRIEND: "ff",
    FRIEND_USER_OBJECT_ID: "f",
    GAME_DAYTIME: "gd",
    GAME_FINISHED: "gf",
    GAME_STARTED: "gsd",
    GAME_STATUS_IN_ROOMS_LIST: "gsrl",
    GAME_STATUS: "gs",
    GET_BLOCKED_USERS: "gbus",
    GET_COMPLAINTS: "gcmps",
    GET_FRIENDS_IN_INVITE_LIST: "gfiil",
    GET_PLAYERS: "gp",
    GET_RATING: "gr",
    GET_SENT_FRIEND_REQUESTS_LIST: "gsfrl",
    GET_USER_PROFILE: "gup",
    GET_MATCH_MAKING_USERS_IN_QUEUE_INTERVAL: "mmguiabk",
    GIVE_UP: "agu",
    GIFT_MARKET_ITEMS: "gmrkti",
    GOLD: "g",
    GOOGLE_SIGN_IN: "gsin",
    GOOGLE_TOKEN: "gt",
    GOOGLE_USER_ID: "gui",
    HIS_FRIENDSHIP_LIST_FULL: "hflf",
    INFO_MESSAGE: "imsg",
    INVITATION_SENDER_USERNAME: "isun",
    IP_ADDRESS: "ip",
    IS_BILLING_ITEM: "ibi",
    IS_DAY_ACTION_USED: "idau",
    IS_INVITED: "iinvtd",
    IS_NIGHT_ACTION_ALTERNATIVE: "inaa",
    IS_NIGHT_ACTION_USED: "inau",
    IS_ONLINE: "on",
    ITEM_PRICE_TEXT: "iprct",
    KICK_TIMER: "kt",
    KICK_USER_AUTHORITY_LESS_THAN_USER: "kualtu",
    KICK_USER_GAME_STARTED: "kugs",
    KICK_USER: "ku",
    KICK_USER_NOT_IN_ROOM: "kunir",
    KICK_USER_OBJECT_ID: "k",
    KICK_USER_PRICE: "kup",
    KICK_USER_RANK: "kur",
    KICK_USER_STARTED: "kus",
    KICK_USER_VOTE: "kuv",
    LAST_NAME: "ln",
    LEVEL: "l",
    LIE_DETECTOR: "l",
    MAFIA_ALIVE: "m",
    MAFIA_ALL: "ma",
    MAKE_COMPLAINT: "mc",
    MATCH_MAKING_MATCH_STATUS: "mmms",
    MATCH_MAKING_BASE_PLAYERS_AMOUNT: "mmbpa",
    MATCH_MAKING_GET_STATUS: "mmgsk",
    MATH_MAKING_ADD_USER: "mmauk",
    MARKET_ITEMS: "mrkti",
    MAXIMUM_PLAYERS: "mxmp",
    MAX_PLAYERS: "mxp",
    MESSAGES: "ms",
    MESSAGE: "m",
    MESSAGE_STYLE: "mstl",
    MESSAGE_TYPE: "t",
    MESSAGE_STICKER: "mstk",
    MIN_LEVEL: "mnl",
    MIN_PLAYERS: "mnp",
    MONEY: "mo",
    NEW_CLOUD_MESSAGING_TOKEN: "ncmt",
    NEW_MESSAGES: "nm",
    NEXT_LEVEL_EXPERIENCE: "nle",
    NOT_ENOUGH_AUTHORITY_ERROR: "neae",
    NO_CHANGES: "noch",
    NUM: "n",
    NUM_MAFIA: "m",
    NUM_PLAYERS: "p",
    OBJECT_ID: "o",
    PASSWORD: "pw",
    PHOTO: "ph",
    PLAYED_GAMES: "pg",
    PLAYERS_IN_ROOM: "pin",
    PLAYERS: "pls",
    PLAYERS_NUM: "pn",
    PLAYERS_STAT: "ps",
    PLAYER: "p",
    PLAYER_ROLE_STATISTICS: "prst",
    PREVIOUS_LEVEL_EXPERIENCE: "ple",
    PRICE_USERNAME_SET: "pus",
    PRIVATE_CHAT_MESSAGE_CREATE: "pmc",
    RANKS: "r",
    RATING: "rtg",
    RATING_MODE: "rmd",
    RATING_TYPE: "rt",
    RATING_USERS_LIST: "rul",
    RATING_VALUE: "rv",
    REASON: "r",
    REMOVE_COMPLAINT: "rcmp",
    REMOVE_FRIEND: "rf",
    REMOVE_INVITATION_TO_ROOM: "ritr",
    REMOVE: "rm",
    REMOVE_MESSAGES: "rmm",
    REMOVE_PHOTO: "rph",
    REMOVE_PLAYER: "rp",
    REMOVE_USER: "rmu",
    ROLES: "roles",
    ROLE_ACTION: "ra",
    ROLE: "r",
    ROOMS: "rs",
    ROOM_CREATED: "rcd",
    ROOM_CREATE: "rc",
    ROOM_ENTER: "re",
    ROOM_MODEL_TYPE: "rmt",
    ROOM_STATISTICS: "rst",
    ROOM_IN_LOBBY_STATE: "rils",
    ROOM: "rr",
    ROOM_MESSAGE_CREATE: "rmc",
    ROOM_OBJECT_ID: "ro",
    ROOM_PASSWORD_IS_WRONG_ERROR: "rpiw",
    ROOM_PASS: "psw",
    ROOM_STATUS: "rs",
    SCORE: "sc",
    SCREENSHOT: "sc",
    SEARCH_TEXT: "st",
    SEARCH_USER: "su",
    SELECTED_ROLES: "sr",
    SEND_FRIEND_INVITE_TO_ROOM: "sfitr",
    SERVER_CONFIG: "scfg",
    SERVER_LANGUAGE_CHANGE_TIME: "slct",
    SERVER_LANGUAGE: "slc",
    SERVER_ROOM_TITLE_MINIMAL_LEVEL: "srtml",
    SERVER_ROOM_PASSWORD_MINIMAL_LEVEL: "srpml",
    SET_ROOM_PASSWORD_MIN_AUTHORITY: "srpma",
    SET_PROFILE_PHOTO_MINIMAL_LEVEL: "sppml",
    SET_SERVER_LANGUAGE_TIME_ERROR: "sslte",
    SEX: "s",
    SHOW_PASSWORD_ROOM_INFO_BUTTON: "sprib",
    SIGN_IN_ERROR: "siner",
    SIGN_IN: "sin",
    SIGN_OUT_USER: "soutu",
    STATUS: "s",
    TEAM: "t",
    TEXT: "tx",
    TIMER: "t",
    TIME: "t",
    TIME_SEC_REMAINING: "tsr",
    TIME_UNTIL: "tu",
    TITLE: "tt",
    TOKEN: "t",
    TYPE_ERROR: "err",
    TYPE: "ty",
    UPDATED: "up",
    UPLOAD_PHOTO: "upp",
    UPLOAD_SCREENSHOT: "ups",
    USED_LAST_MESSAGE: "um",
    USERNAME_HAS_WRONG_SYMBOLS: "unws",
    USERNAME_IS_EMPTY: "unie",
    USERNAME_IS_EXISTS: "unex",
    USERNAME_IS_OUT_OF_BOUNDS: "unob",
    USERNAME: "u",
    USERNAME_SET: "uns",
    USERNAME_TRANSLIT: "ut",
    USERS: "u",
    USER_BLOCKED: "ublk",
    USER_CHANGE_SEX: "ucs",
    USER_DASHBOARD: "uud",
    USER_DATA: "ud",
    USER_INACTIVE_BLOCKED: "uib",
    USER_IN_ANOTHER_ROOM: "uiar",
    USER_IN_A_ROOM: "uir",
    USER_IS_NOT_VIP: "uinv",
    USER_IS_NOT_VIP_TO_INVITE_FRIENDS_IN_ROOM: "uinvtifr",
    USER: "uu",
    USER_KICKED: "ukd",
    USER_LEVEL_NOT_ENOUGH: "ulne",
    USER_NOT_IN_A_ROOM: "unir",
    USER_OBJECT_ID: "uo",
    USER_PROFILE: "uup",
    USER_RANK_FOR_KICK: "ur",
    USER_RANK: "r",
    USER_RECEIVER: "ur",
    USER_ROLE_ERROR: "ure",
    USER_SENDER: "us",
    USER_SENDER_OBJECT_ID: "uso",
    USER_SET_SERVER_LANGUAGE: "usls",
    USER_SET_USERNAME_ERROR: "ueue",
    USER_ENERGY: "ue",
    USER_SIGN_IN: "usi",
    USER_USING_DOUBLE_ACCOUNT: "uuda",
    VEST: "v",
    VIP_ENABLED: "venb",
    VIP: "v",
    VIP_ACCOUNT: "vip_account",
    VIP_UPDATED: "vupd",
    VOTES: "v",
    VOTE: "v",
    WHO_WON: "w",
    WINS_AS_KILLER: "wik",
    WINS_AS_MAFIA: "wim",
    WINS_AS_PEACEFUL: "wip",
    WRONG_FILE_SIZE: "wfs",
    WRONG_FILE_TYPE: "wft",
    YOUR_FRIENDSHIP_LIST_FULL: "yflf",
    ID: "i",
    MATCH_MAKING_SCORE: "mmscr",
    MATCH_MAKING_ADD_USER: "mmauk",
    MATCH_MAKING_REMOVE_USER: "mmruk",
    MATCH_MAKING_LIST_KEY: "mmblk",
    MATCH_MAKING_USER_IN_ROOM: "mmuir",
    MATCH_MAKING_BUCKET_RESPONSE_PLAYERS_AMOUNT: "mmbpa",
    VOTE_PLAYER_LIST: "vpl",
    PRIVATE_CHAT_LIST_MESSAGES: "pclms",
    PROFILE_USER_DATA: "pud",
    USER_ACCOUNT_COINS: "uac",
    SILVER_COINS: "scns",
    GOLD_COINS: "gcns",
    DECORATIONS: "dcrs",
    SAME_ROOM: "isr",
    BLOCKED_USER_INFO: "bui",
    DECORATION_ID: "did",
    DECORATION_TYPE: "dt",
    DECORAION_PARARAMETER: "dp",
    USER_CURRENET_ENERGY_AMOUNT: "ucea",
    USER_MAX_FREE_ENERGY_AMOUNT: "umfea",
    USER_ENERGY_AMOUNT_FIRST_TIMER: "ueaft",
    USER_ENERGY_AMOUNT_NEXT_TIMERS: "ueant",
    CREATOR_OBJECT_ID: "rco",
    VIP_REMANING_MILLISECONDS: "vrms",
    DASHBOARD_USER: "du",
    BACKPACK_SIZE: "bps",
    BACKPACK_VIP_SIZE: "bpsv",
    AVAILABLE_DECORATIONS: "bids",
    ACTIVATED_DECORATIONS: "aids",
    BACKPACK_ITEM_ID: "bio",
    WHO_BLOCKED_USER_ID: "wbuo",
    IS_USER_ID_MATCHED: "iuoim",
    IS_DEVICE_ID_MATHED: "idim",
    IS_IP_ADDRESS_MATCHED: "iipam",
    ACTIVATED_ITEM_OBJECT_ID: "aio",
    ITEM_EXPIRE_AFTER: "iea",
    MARKET_PRODUCT_ID: "mpid",
    MARKET_OFFER_COIN_TYPE: "moct",
    MARKET_OFFER_PRICE: "mop",
    MARKET_OFFER_DURATION: "mod",
    MARKET_COINS_AMOUNT: "mca",
    MARKET_COIN_TYPE: "mct",
    PAYMENT_URL: "puk",
    ITEM_PRISE_TESXT: "iprct",
    BILLING_PURCHASE_ACCOUNT_ID: "bpaid",
    MARKET_ITEM_DECORATION: "mid",
    MARKET_ITEM_OFFERS: "mio",
    PHOTO_FILENAME: "ph",
    MARKET_ITEM_DECORATIONS: "mids",
    MARKET_BILLING_ITEM: "mbi",
    MARKET_VIP_ITEMS: "mivs",
    MARKET_SILVER_COIN_ITEMS: "misc",
    MARKET_OFFER_ID: "moid",
    SELECTED_PARAMETERS_IDS: "dp",
    CACHE_KEY: "cchk",
    USER_DEFAULT_PHOTOS_IDS: "usdphi",
    IS_MATCH_MAKING_ENABLED: "is_match_making_enabled",
    IS_BACKPACK_ENABLED: "is_backpack_enabled",
    MATCH_MAKING_MINIMUM_LEVEL: "match_making_minimum_level",
    PUBLIC_CHAT_MINIMUM_LEVEL: "public_chat_minimum_level",
    PLAYERS_DATA: "data",
    VERSION_CODE: "vc",
    MATCH_MAKING_FINDED_USERS_NUMBER: "mmfun",
    PRIVATE_CHAT_LAST_MESSAGE: "pclm",
    USER_GET_DEFAULT_PHOTOS: "usgdph",
    USER_DEFAULT_PHOTOS: "usdph",
    DASHBOARD: "db",
    BACKPACK_GET: "bpg",
    MARKET_BILLING_TYPE: "mbt",
    MARKET_GET: "mrktg",
    MARKET: "mr",
    BUY_BILLING_VIP_ITEM: "bbvi",
    BUY_SILVER_COINS_ITEM: "bsci",
    BUY_DECORATION: "bd",
    BUY_DECORATION_REQUEST: "bdr",
    MATCH_MAKING_ADD_GAME: "mmag",
    MATCH_MAKING_USER_ADD_GAME: "mmcuag",
    MATCH_MAKING_USER_SELECT_ROLE: "mmusr",
    MATCH_MAKING_COUNT_USER_SELECTED_ROLES: "mmcusr",
    MATCH_MAKING_ROOM: "mmrr",
    MATCH_MAKING_ROLES_COUNT: "mmrc",
    NEED_MINIMUM_LEVEL_CHAT: "nelfpc",
    NEED_MINIMUM_LEVEL_MM: "nelfmm",
    USER_CHANGE_EMAIL: "uche",
    USER_RESET_PASSWORD: "usrp",
    USER_RESET_PASSWORD_SENDED: "usrps",
    USER_WITH_EMAIL_NOT_EXISTS: "uwene",
    USTMR: "ustmr",
    USRSFR: "usrsfr"
  };
  var PacketDataKeys_default = PacketDataKeys;

  // core/src/utils/md5.ts
  var import_js_md5 = __toESM(require_js_md5());
  function md5salt(string, salt = "azxsw", iterations = 5) {
    let result = string;
    for (let i = 0; i < iterations; i++) {
      result = (0, import_js_md5.default)(result + salt);
    }
    return result;
  }

  // launcher/src/Launcher.ts
  function uuidv4() {
    return "10000000-1000-4000-8000-100000000000".replace(/[018]/g, (c) => (+c ^ crypto.getRandomValues(new Uint8Array(1))[0] & 15 >> +c / 4).toString(16));
  }
  function tokenHex(nBytes) {
    const bytes = new Uint8Array(nBytes);
    crypto.getRandomValues(bytes);
    return [...bytes].map((b) => b.toString(16).padStart(2, "0")).join("");
  }
  var Launcher = class {
    win;
    openedWindows = [];
    options = {
      version: "",
      profile: "",
      theme: "macos"
    };
    versions = [];
    profiles = [];
    statusText;
    progressBar;
    btnPlay;
    constructor() {
      this.win = new Window({
        title: `\u041B\u0430\u0443\u043D\u0447\u0435\u0440 (${App_default.version})`,
        // width: 700,
        width: 400,
        height: 300,
        center: true
      });
      this.#init();
    }
    async readVersion(src) {
      try {
        await createScript({ src });
        const version = window["version"];
        delete window["version"];
        return version;
      } catch {
        try {
          const t = await (await fetch(src)).text();
          window["eval"](t);
          const version = window["version"];
          delete window["version"];
          return version;
        } catch {
          return null;
        }
      }
      return null;
    }
    async #init() {
      await this.readData();
      this.#initContent();
      if (this.versions.length == 0) {
        this.btnPlay.disabled = true;
        this.statusText.textContent = `\u0421\u043A\u0430\u0447\u0438\u0432\u0430\u043D\u0438\u0435 \u0432\u0435\u0440\u0441\u0438\u0438..`;
        console.log(`Downloading default version [vanilla]..`);
        try {
          const src = `https://raw.githubusercontent.com/lumik0/bafiaonline/refs/heads/master/run/images/vanilla.js?v=${Math.random()}`;
          const version = await this.readVersion(src);
          if (version) await this.downloadVersion({ ...version, scriptPath: src });
        } catch (e) {
          console.error(e);
          this.btnPlay.disabled = false;
        }
      }
    }
    async writeData() {
      await fs_default.writeFile(`/versions.json`, JSON.stringify(this.versions));
      await fs_default.writeFile(`/profiles.json`, JSON.stringify(this.profiles));
      await fs_default.writeFile(`/options.json`, JSON.stringify(this.options));
    }
    async readData() {
      if (!await fs_default.existsFile("/urlsVersions.json")) fs_default.writeFile(`/urlsVersions.json`, JSON.stringify(["./images/vanilla.js", "./vanilla.js"]));
      if (!await fs_default.existsFile("/versions.json")) fs_default.writeFile(`/versions.json`, "[]");
      if (!await fs_default.existsFile("/profiles.json")) fs_default.writeFile(`/profiles.json`, "[]");
      if (!await fs_default.existsFile("/options.json")) fs_default.writeFile(`/options.json`, JSON.stringify({
        version: "",
        profile: "",
        theme: "macos"
      }));
      this.versions = JSON.parse(await fs_default.readFile(`/versions.json`));
      this.profiles = JSON.parse(await fs_default.readFile(`/profiles.json`));
      this.options = JSON.parse(await fs_default.readFile(`/options.json`));
    }
    async #initContent(checkVersions = true) {
      const updateVersions = [];
      this.win.content.innerHTML = "";
      const div = document.createElement("div");
      div.style.padding = "5px";
      this.win.content.appendChild(div);
      this.statusText = document.createElement("div");
      this.statusText.style.margin = "5px 5px 0 5px";
      div.appendChild(this.statusText);
      this.progressBar = document.createElement("progress");
      this.progressBar.value = 0;
      this.progressBar.style.width = "100%";
      div.appendChild(this.progressBar);
      const versions = document.createElement("div");
      versions.style.display = "flex";
      versions.style.alignItems = "center";
      versions.style.fontSize = "13px";
      const txtVersions = document.createElement("span");
      txtVersions.style.minWidth = "70px";
      txtVersions.textContent = `\u0412\u0435\u0440\u0441\u0438\u0438:`;
      versions.appendChild(txtVersions);
      const listVersions = document.createElement(`select`);
      listVersions.value = "\u0412\u044B\u0431\u0435\u0440\u0438\u0442\u0435 \u0432\u0435\u0440\u0441\u0438\u044E..";
      listVersions.style.width = "100%";
      listVersions.value = this.options.version;
      for (const ver of this.versions) {
        const el = document.createElement("option");
        el.innerHTML = ver.name;
        if (ver.scriptPath && checkVersions) updateVersions.push(ver);
        listVersions.appendChild(el);
      }
      versions.appendChild(listVersions);
      const btnAddVersion = document.createElement("button");
      btnAddVersion.innerHTML = `+`;
      btnAddVersion.onclick = () => this.addVersion();
      versions.appendChild(btnAddVersion);
      const btnRemoveVersion = document.createElement("button");
      btnRemoveVersion.innerHTML = `-`;
      btnRemoveVersion.onclick = async () => {
        const p = this.versions.findIndex((e) => e.name == listVersions.value);
        if (p != -1) {
          btnRemoveVersion.disabled = true;
          this.versions.splice(p, 1);
          await this.writeData();
          this.#initContent();
        }
      };
      versions.appendChild(btnRemoveVersion);
      div.appendChild(versions);
      const profiles = document.createElement("div");
      profiles.style.display = "flex";
      profiles.style.alignItems = "center";
      profiles.style.fontSize = "13px";
      const txtProfiles = document.createElement("span");
      txtProfiles.style.minWidth = "70px";
      txtProfiles.textContent = `\u041F\u0440\u043E\u0444\u0438\u043B\u0438:`;
      profiles.appendChild(txtProfiles);
      const listProfiles = document.createElement(`select`);
      listProfiles.value = "\u0412\u044B\u0431\u0435\u0440\u0438\u0442\u0435 \u043F\u0440\u043E\u0444\u0438\u043B\u044C..";
      listProfiles.style.width = "100%";
      listProfiles.value = this.options.profile;
      for (const pr of this.profiles) {
        const el = document.createElement("option");
        el.innerHTML = pr.name;
        if (pr.name == "") {
          pr.name = "\u041D\u043E\u0432\u044B\u0439 \u0430\u043A\u043A\u0430\u0443\u043D\u0442";
          el.style.background = "#57e057";
        }
        listProfiles.appendChild(el);
      }
      profiles.appendChild(listProfiles);
      const btnAddProfile = document.createElement("button");
      btnAddProfile.innerHTML = `+`;
      btnAddProfile.onclick = () => this.addProfile();
      profiles.appendChild(btnAddProfile);
      const btnRemoveProfile = document.createElement("button");
      btnRemoveProfile.innerHTML = `-`;
      btnRemoveProfile.onclick = async () => {
        const p = this.profiles.findIndex((e) => e.name == listProfiles.value);
        if (p != -1) {
          btnRemoveProfile.disabled = true;
          this.profiles.splice(p, 1);
          await this.writeData();
          this.#initContent();
        }
      };
      profiles.appendChild(btnRemoveProfile);
      div.appendChild(profiles);
      const btns = document.createElement("div");
      btns.style.display = "flex";
      btns.style.margin = "5px";
      btns.style.justifyContent = "center";
      div.appendChild(btns);
      this.btnPlay = document.createElement("button");
      this.btnPlay.innerHTML = `\u0418\u0433\u0440\u0430\u0442\u044C`;
      this.btnPlay.style.margin = "1px";
      this.btnPlay.onclick = async () => {
        const v = this.versions.find((e) => e.name == listVersions.value);
        const p = this.profiles.find((e) => e.name == listProfiles.value);
        if (v) {
          if (!p) {
            const e = confirm(`\u0443 \u0432\u0430\u0441 \u043D\u0435\u0442 \u043F\u0440\u043E\u0444\u0438\u043B\u044F. \u0412\u044B \u043C\u043E\u0436\u0435\u0442\u0435 \u0441\u043E\u0437\u0434\u0430\u0442\u044C \u0435\u0433\u043E \u0432 \u043B\u0430\u0443\u043D\u0447\u0435\u0440\u0435, \u0432\u044B \u0443\u0432\u0435\u0440\u0435\u043D\u044B \u0447\u0442\u043E \u0431\u0443\u0434\u0435\u0442\u0435 \u0432\u0445\u043E\u0434\u0438\u0442\u044C \u0432 \u0438\u0433\u0440\u0435?

\u0421 \u043F\u0440\u043E\u0444\u0438\u043B\u0435\u043C \u0430\u0432\u0442\u043E\u043C\u0430\u0442\u0438\u0447\u0435\u0441\u043A\u0438\u0439 \u0432\u0445\u043E\u0434 \u0431\u0443\u0434\u0435\u0442`);
            if (!e) {
              btnAddProfile.style.transition = "1s";
              btnAddProfile.style.transform = "scale(5)";
              await wait(1e3);
              btnAddProfile.style.transform = "none";
              return;
            }
          }
          this.runGame(v, p);
        } else {
          alert(`\u041D\u0435 \u043D\u0430\u0439\u0434\u0435\u043D\u0430 \u0432\u0435\u0440\u0441\u0438\u044F`);
          btnAddVersion.style.transition = "1s";
          btnAddVersion.style.transform = "scale(5)";
          await wait(1e3);
          btnAddVersion.style.transform = "none";
        }
      };
      btns.appendChild(this.btnPlay);
      const githubBtn = document.createElement("button");
      githubBtn.innerHTML = `Github`;
      githubBtn.style.margin = "1px";
      githubBtn.onclick = () => window.open("https://github.com/lumik0/bafiaonline", "_blank");
      btns.appendChild(githubBtn);
      for await (const ver of updateVersions) {
        this.statusText.textContent = "\u041F\u0440\u043E\u0432\u0435\u0440\u043A\u0430..";
        const version = await this.readVersion(ver.scriptPath);
        if (version) await this.downloadVersion({ ...version, ...ver });
      }
    }
    addProfile() {
      const self2 = this;
      this.win.lock();
      let webSocket;
      const width = isMobile() ? window.innerWidth - 150 : 300;
      const win = new Window({
        title: "\u0414\u043E\u0431\u0430\u0432\u043B\u0435\u043D\u0438\u0435 \u043F\u0440\u043E\u0444\u0438\u043B\u044F",
        width,
        height: 220,
        resizable: false,
        moveable: false,
        noMobile: true,
        minButton: false,
        maxButton: false,
        x: this.win.x + (this.win.width - width) / 2,
        y: this.win.y + (this.win.height - 200) / 2
      });
      win.content.style.overflow = "hidden";
      win.on("close", () => {
        this.win.unlock();
      });
      const div = document.createElement("div");
      div.style.padding = "10px";
      win.content.appendChild(div);
      const status = document.createElement("div");
      status.innerHTML = `\u041F\u043E\u0434\u043A\u043B\u044E\u0447\u0435\u043D\u0438\u0435 \u043A \u0441\u0435\u0440\u0432\u0435\u0440\u0443..`;
      status.style.textAlign = "center";
      const inputEmail = document.createElement("input");
      inputEmail.style.width = "-webkit-fill-available";
      inputEmail.placeholder = "e-mail \u0438\u043B\u0438 \u043D\u0438\u043A\u043D\u0435\u0439\u043C";
      div.appendChild(inputEmail);
      const inputPassword = document.createElement("input");
      inputPassword.style.width = "-webkit-fill-available";
      inputPassword.placeholder = "\u043F\u0430\u0440\u043E\u043B\u044C";
      div.appendChild(inputPassword);
      const or = document.createElement("div");
      or.style.textAlign = "center";
      or.style.width = "100%";
      or.style.margin = "2px";
      or.innerHTML = "\u0438\u043B\u0438";
      div.appendChild(or);
      const inputToken = document.createElement("input");
      inputToken.style.width = "-webkit-fill-available";
      inputToken.placeholder = "\u0442\u043E\u043A\u0435\u043D";
      div.appendChild(inputToken);
      const inputUserId = document.createElement("input");
      inputUserId.style.width = "-webkit-fill-available";
      inputUserId.placeholder = "ID \u043F\u043E\u043B\u044C\u0437\u043E\u0432\u0430\u0442\u0435\u043B\u044F";
      div.appendChild(inputUserId);
      const btn = document.createElement("button");
      btn.style.width = "100%";
      btn.innerHTML = "\u0421\u043E\u0437\u0434\u0430\u0442\u044C";
      btn.disabled = true;
      function createWebSocket() {
        webSocket = new WebSocket(uriServer);
        webSocket.onerror = (e) => console.error(e);
        webSocket.onmessage = async (e) => {
          const json = JSON.parse(e.data);
          if (json[PacketDataKeys_default.TYPE] == PacketDataKeys_default.SIGN_IN_ERROR) {
            btn.disabled = false;
            status.innerHTML = `\u041E\u0448\u0438\u0431\u043A\u0430. \u041A\u043E\u0434 \u043E\u0448\u0438\u0431\u043A\u0438: ${json[PacketDataKeys_default.ERROR]}`;
            status.style.color = "red";
          } else if (json[PacketDataKeys_default.TYPE] == PacketDataKeys_default.USER_SIGN_IN) {
            const u = json[PacketDataKeys_default.USER][PacketDataKeys_default.USERNAME];
            if (u == "") return;
            self2.profiles.push({
              name: u,
              email: inputEmail.value,
              password: inputPassword.value,
              token: json[PacketDataKeys_default.USER][PacketDataKeys_default.TOKEN],
              userId: json[PacketDataKeys_default.USER][PacketDataKeys_default.OBJECT_ID]
            });
            await self2.writeData();
            win.close();
            self2.#initContent();
          } else if (json[PacketDataKeys_default.TYPE] == PacketDataKeys_default.USERNAME_HAS_WRONG_SYMBOLS) {
            alert(`\u0414\u043B\u044F \u043D\u0438\u043A\u043D\u0435\u0439\u043C\u0430 \u0432\u044B \u043C\u043E\u0436\u0435\u0442\u0435 \u0438\u0441\u043F\u043E\u043B\u044C\u0437\u043E\u0432\u0430\u0442\u044C \u0442\u043E\u043B\u044C\u043A\u043E 0-9 \u0430-\u042F a-Z \u0441\u0438\u043C\u0432\u043E\u043B\u044B`);
            const uu = prompt(`\u0414\u043B\u044F \u0438\u0433\u0440\u044B \u0438 \u043E\u0431\u0449\u0435\u043D\u0438\u044F \u0441 \u0434\u0440\u0443\u0433\u0438\u043C\u0438 \u0438\u0433\u0440\u043E\u043A\u0430\u043C\u0438 \u0443 \u0432\u0430\u0441 \u0434\u043E\u043B\u0436\u0435\u043D \u0431\u044B\u0442\u044C \u0443\u0441\u0442\u0430\u043D\u043E\u0432\u043B\u0435\u043D \u041D\u0438\u043A\u043D\u044D\u0439\u043C`);
            webSocket.send(JSON.stringify({
              [PacketDataKeys_default.TYPE]: PacketDataKeys_default.USERNAME_SET,
              [PacketDataKeys_default.OBJECT_ID]: inputUserId.value,
              [PacketDataKeys_default.TOKEN]: inputToken.value,
              [PacketDataKeys_default.USERNAME]: uu
            }));
          } else if (json[PacketDataKeys_default.TYPE] == PacketDataKeys_default.USERNAME_IS_EXISTS) {
            alert(`\u0414\u0430\u043D\u043D\u044B\u0439 \u043D\u0438\u043A\u043D\u0435\u0439\u043C \u0443\u0436\u0435 \u0437\u0430\u0440\u0435\u0433\u0438\u0441\u0442\u0440\u0438\u0440\u043E\u0432\u0430\u043D`);
            const uu = prompt(`\u0414\u043B\u044F \u0438\u0433\u0440\u044B \u0438 \u043E\u0431\u0449\u0435\u043D\u0438\u044F \u0441 \u0434\u0440\u0443\u0433\u0438\u043C\u0438 \u0438\u0433\u0440\u043E\u043A\u0430\u043C\u0438 \u0443 \u0432\u0430\u0441 \u0434\u043E\u043B\u0436\u0435\u043D \u0431\u044B\u0442\u044C \u0443\u0441\u0442\u0430\u043D\u043E\u0432\u043B\u0435\u043D \u041D\u0438\u043A\u043D\u044D\u0439\u043C`);
            webSocket.send(JSON.stringify({
              [PacketDataKeys_default.TYPE]: PacketDataKeys_default.USERNAME_SET,
              [PacketDataKeys_default.OBJECT_ID]: inputUserId.value,
              [PacketDataKeys_default.TOKEN]: inputToken.value,
              [PacketDataKeys_default.USERNAME]: uu
            }));
          } else if (json[PacketDataKeys_default.TYPE] == PacketDataKeys_default.USERNAME_IS_OUT_OF_BOUNDS) {
            alert(`\u041D\u0438\u043A\u043D\u0435\u0439\u043C \u0441\u043B\u0438\u0448\u043A\u043E\u043C \u043A\u043E\u0440\u043E\u0442\u043A\u0438\u0439 \u0438\u043B\u0438 \u0434\u043B\u0438\u043D\u043D\u044B\u0439.
\u041D\u0438\u043A\u043D\u0435\u0439\u043C \u0434\u043E\u043B\u0436\u0435\u043D \u0441\u043E\u0441\u0442\u043E\u044F\u0442\u044C \u0438\u0437 3-12 \u0441\u0438\u043C\u0432\u043E\u043B\u044B`);
            const uu = prompt(`\u0414\u043B\u044F \u0438\u0433\u0440\u044B \u0438 \u043E\u0431\u0449\u0435\u043D\u0438\u044F \u0441 \u0434\u0440\u0443\u0433\u0438\u043C\u0438 \u0438\u0433\u0440\u043E\u043A\u0430\u043C\u0438 \u0443 \u0432\u0430\u0441 \u0434\u043E\u043B\u0436\u0435\u043D \u0431\u044B\u0442\u044C \u0443\u0441\u0442\u0430\u043D\u043E\u0432\u043B\u0435\u043D \u041D\u0438\u043A\u043D\u044D\u0439\u043C`);
            webSocket.send(JSON.stringify({
              [PacketDataKeys_default.TYPE]: PacketDataKeys_default.USERNAME_SET,
              [PacketDataKeys_default.OBJECT_ID]: inputUserId.value,
              [PacketDataKeys_default.TOKEN]: inputToken.value,
              [PacketDataKeys_default.USERNAME]: uu
            }));
          } else if (json[PacketDataKeys_default.TYPE] == PacketDataKeys_default.USERNAME_IS_EMPTY) {
            alert(`\u041D\u0438\u043A\u043D\u0435\u0439\u043C \u043D\u0435 \u043C\u043E\u0436\u0435\u0442 \u0431\u044B\u0442\u044C \u043F\u0443\u0441\u0442\u044B\u043C`);
            const uu = prompt(`\u0414\u043B\u044F \u0438\u0433\u0440\u044B \u0438 \u043E\u0431\u0449\u0435\u043D\u0438\u044F \u0441 \u0434\u0440\u0443\u0433\u0438\u043C\u0438 \u0438\u0433\u0440\u043E\u043A\u0430\u043C\u0438 \u0443 \u0432\u0430\u0441 \u0434\u043E\u043B\u0436\u0435\u043D \u0431\u044B\u0442\u044C \u0443\u0441\u0442\u0430\u043D\u043E\u0432\u043B\u0435\u043D \u041D\u0438\u043A\u043D\u044D\u0439\u043C`);
            webSocket.send(JSON.stringify({
              [PacketDataKeys_default.TYPE]: PacketDataKeys_default.USERNAME_SET,
              [PacketDataKeys_default.OBJECT_ID]: inputUserId.value,
              [PacketDataKeys_default.TOKEN]: inputToken.value,
              [PacketDataKeys_default.USERNAME]: uu
            }));
          } else if (json[PacketDataKeys_default.TYPE] == PacketDataKeys_default.USERNAME_SET) {
            const acc = self2.profiles.find((e2) => e2.name == "");
            if (!acc) {
              alert("\u041D\u0435\u0442 \u0430\u043A\u043A\u0430\u0443\u043D\u0442\u0430");
              return;
            }
            acc.name = json[PacketDataKeys_default.USERNAME];
            await self2.writeData();
            win.close();
            self2.#initContent();
          } else if (json[PacketDataKeys_default.TYPE] == PacketDataKeys_default.USER_RESET_PASSWORD_SENDED) {
            alert(`\u041E\u0442\u043F\u0440\u0430\u0432\u043B\u0435\u043D\u043E \u043F\u0438\u0441\u044C\u043C\u043E \u043D\u0430 \u0441\u0431\u0440\u043E\u0441 \u043F\u0430\u0440\u043E\u043B\u044F`);
          } else if (json[PacketDataKeys_default.TYPE] == PacketDataKeys_default.USER_WITH_EMAIL_NOT_EXISTS) {
            alert(`\u041F\u043E\u043B\u044C\u0437\u043E\u0432\u0430\u0442\u0435\u043B\u044C \u0441 \u0442\u0430\u043A\u0438\u043C email \u043D\u0435 \u043D\u0430\u0439\u0434\u0435\u043D. \u0412\u043E\u0437\u043C\u043E\u0436\u043D\u043E, \u0432\u044B \u0437\u0430\u0431\u044B\u043B\u0438 \u0441\u0432\u043E\u0439 email?`);
          } else if (json[PacketDataKeys_default.TYPE] == PacketDataKeys_default.USTMR) {
            alert(`\u0412\u044B \u043C\u043E\u0436\u0435\u0442\u0435 \u0437\u0430\u043F\u0440\u043E\u0441\u0438\u0442\u044C \u0441\u0431\u0440\u043E\u0441 \u043F\u0430\u0440\u043E\u043B\u044F \u043F\u043E\u0441\u043B\u0435 ${json[PacketDataKeys_default.USRSFR]} \u0441\u0435\u043A\u0443\u043D\u0434`);
          }
          console.log(json);
        };
        webSocket.onopen = () => {
          status.innerHTML = `\u041F\u043E\u0434\u043A\u043B\u044E\u0447\u0435\u043D\u043E`;
          btn.disabled = false;
        };
        webSocket.onclose = () => {
          btn.disabled = true;
          status.innerHTML = `\u0421\u043E\u0435\u0434\u0438\u043D\u0435\u043D\u0438\u0435 \u0437\u0430\u043A\u0440\u044B\u0442\u043E.. \u041D\u0430\u0436\u043C\u0438\u0442\u0435 \u0447\u0442\u043E\u0431\u044B \u043F\u0435\u0440\u0435\u043F\u043E\u0434\u043A\u043B\u044E\u0447\u0438\u0442\u044C\u0441\u044F`;
          status.onclick = () => {
            status.innerHTML = `\u041F\u043E\u0434\u043A\u043B\u044E\u0447\u0435\u043D\u0438\u0435 \u043A \u0441\u0435\u0440\u0432\u0435\u0440\u0443..`;
            status.onclick = null;
            createWebSocket();
          };
        };
      }
      createWebSocket();
      btn.onclick = () => {
        status.innerHTML = ``;
        if (inputEmail.value != "" && inputPassword.value != "") {
          btn.disabled = true;
          webSocket.send(JSON.stringify({
            [PacketDataKeys_default.TYPE]: PacketDataKeys_default.SIGN_IN,
            [PacketDataKeys_default.EMAIL]: inputEmail.value,
            [PacketDataKeys_default.PASSWORD]: md5salt(inputPassword.value),
            [PacketDataKeys_default.DEVICE_ID]: tokenHex(8)
          }));
        } else if (inputToken.value != "" && inputUserId.value != "") {
          btn.disabled = true;
          webSocket.send(JSON.stringify({
            [PacketDataKeys_default.TYPE]: PacketDataKeys_default.SIGN_IN,
            [PacketDataKeys_default.OBJECT_ID]: inputUserId.value,
            [PacketDataKeys_default.TOKEN]: inputToken.value
          }));
        }
      };
      div.appendChild(btn);
      const btnReg = document.createElement("button");
      btnReg.style.width = "100%";
      btnReg.innerHTML = "\u0420\u0435\u0433\u0438\u0441\u0442\u0440\u0430\u0446\u0438\u044F";
      btnReg.onclick = async () => {
        if (this.profiles.find((e) => e.name == "")) {
          const uu = prompt(`\u041D\u0430\u0439\u0434\u0435\u043D \u0430\u043A\u043A\u0430\u0443\u043D\u0442 \u0431\u0435\u0437 \u043D\u0438\u043A\u043D\u0435\u0439\u043C\u0430.
\u0414\u043B\u044F \u0438\u0433\u0440\u044B \u0438 \u043E\u0431\u0449\u0435\u043D\u0438\u044F \u0441 \u0434\u0440\u0443\u0433\u0438\u043C\u0438 \u0438\u0433\u0440\u043E\u043A\u0430\u043C\u0438 \u0443 \u0432\u0430\u0441 \u0434\u043E\u043B\u0436\u0435\u043D \u0431\u044B\u0442\u044C \u0443\u0441\u0442\u0430\u043D\u043E\u0432\u043B\u0435\u043D \u041D\u0438\u043A\u043D\u044D\u0439\u043C`);
          webSocket.send(JSON.stringify({
            [PacketDataKeys_default.TYPE]: PacketDataKeys_default.USERNAME_SET,
            [PacketDataKeys_default.OBJECT_ID]: inputUserId.value,
            [PacketDataKeys_default.TOKEN]: inputToken.value,
            [PacketDataKeys_default.USERNAME]: uu
          }));
          return;
        }
        if (inputEmail.value != "" && inputPassword.value != "") {
          const data = await fetch(`https://api.mafia.dottap.com/user/sign_up`, {
            method: "POST",
            headers: {
              "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8"
            },
            body: new URLSearchParams({
              email: inputEmail.value,
              username: "",
              password: md5salt(inputPassword.value),
              deviceId: tokenHex(8),
              lang: "RUS"
            })
          });
          const result = await data.json();
          if (result.error) {
            if (result.error == "USING_TEMP_EMAIL") {
              alert(`\u0417\u0430\u043F\u0440\u0435\u0449\u0435\u043D\u043E \u0438\u0441\u043F\u043E\u043B\u044C\u0437\u043E\u0432\u0430\u0442\u044C \u0441\u0435\u0440\u0432\u0438\u0441\u044B \u0434\u043B\u044F \u0432\u0440\u0435\u043C\u0435\u043D\u043D\u043E\u0439 \u0440\u0435\u0433\u0438\u0441\u0442\u0440\u0430\u0446\u0438\u0438 email.
\u0418\u0441\u043F\u043E\u043B\u044C\u0437\u0443\u0439\u0442\u0435 \u043F\u043E\u043F\u0443\u043B\u044F\u0440\u043D\u044B\u0435 \u0441\u0435\u0440\u0432\u0438\u0441\u044B, \u043D\u0430\u043F\u0440\u0438\u043C\u0435\u0440 Gmail, Mail.Ru, Yandex, Yahoo \u0438 \u0442\u0434.`);
            } else if (result.error == "EMAIL_EXISTS") {
              alert(`\u0414\u0430\u043D\u043D\u044B\u0439 email \u0443\u0436\u0435 \u0437\u0430\u0440\u0435\u0433\u0438\u0441\u0442\u0440\u0438\u0440\u043E\u0432\u0430\u043D`);
            }
            return;
          }
          if (result[PacketDataKeys_default.OBJECT_ID]) {
            btn.disabled = true;
            self2.profiles.push({
              name: "",
              email: inputEmail.value,
              password: inputPassword.value,
              token: result[PacketDataKeys_default.TOKEN],
              userId: result[PacketDataKeys_default.OBJECT_ID]
            });
            this.writeData();
            const uu = prompt(`\u0414\u043B\u044F \u0438\u0433\u0440\u044B \u0438 \u043E\u0431\u0449\u0435\u043D\u0438\u044F \u0441 \u0434\u0440\u0443\u0433\u0438\u043C\u0438 \u0438\u0433\u0440\u043E\u043A\u0430\u043C\u0438 \u0443 \u0432\u0430\u0441 \u0434\u043E\u043B\u0436\u0435\u043D \u0431\u044B\u0442\u044C \u0443\u0441\u0442\u0430\u043D\u043E\u0432\u043B\u0435\u043D \u041D\u0438\u043A\u043D\u044D\u0439\u043C`);
            webSocket.send(JSON.stringify({
              [PacketDataKeys_default.TYPE]: PacketDataKeys_default.USERNAME_SET,
              [PacketDataKeys_default.OBJECT_ID]: inputUserId.value,
              [PacketDataKeys_default.TOKEN]: inputToken.value,
              [PacketDataKeys_default.USERNAME]: uu
            }));
          }
        }
      };
      div.appendChild(btnReg);
      div.appendChild(status);
      const links = document.createElement("div");
      links.style.display = "flex";
      links.style.justifyContent = "center";
      div.appendChild(links);
      const why = document.createElement("div");
      why.style.margin = "3px";
      why.style.textAlign = "center";
      why.style.fontSize = "12px";
      why.style.color = "#8888f8";
      why.style.textDecoration = "underline";
      why.style.cursor = "pointer";
      why.style.userSelect = "none";
      why.innerHTML = "\u041F\u043E\u0447\u0435\u043C\u0443?";
      why.onclick = () => {
        alert(`\u041C\u044B \u043D\u0435 \u0441\u043E\u0431\u0438\u0440\u0430\u0435\u043C \u0434\u0430\u043D\u043D\u044B\u0435 \u0430\u043A\u043A\u0430\u0443\u043D\u0442\u043E\u0432

\u041D\u0430\u0448 \u0438\u0441\u0445\u043E\u0434\u043D\u044B\u0439 \u043A\u043E\u0434 \u043E\u0442\u043A\u0440\u044B\u0442 https://github.com/lumik0/bafiaonline

\u0412\u044B \u0432 \u043B\u044E\u0431\u043E\u043C \u0441\u043B\u0443\u0447\u0430\u0435 \u043C\u043E\u0436\u0435\u0442\u0435 \u0432\u043E\u0439\u0442\u0438 \u0441 \u0432\u0442\u043E\u0440\u043E\u0433\u043E \u0430\u043A\u043A\u0430\u0443\u043D\u0442\u0430`);
      };
      links.appendChild(why);
      const forgetPass = document.createElement("div");
      forgetPass.style.margin = "3px";
      forgetPass.style.textAlign = "center";
      forgetPass.style.fontSize = "12px";
      forgetPass.style.color = "#8888f8";
      forgetPass.style.textDecoration = "underline";
      forgetPass.style.cursor = "pointer";
      forgetPass.style.userSelect = "none";
      forgetPass.innerHTML = "\u0417\u0430\u0431\u044B\u043B \u043F\u0430\u0440\u043E\u043B\u044C?";
      forgetPass.onclick = () => {
        const email = prompt(`\u0414\u043B\u044F \u0441\u0431\u0440\u043E\u0441\u0430 \u043F\u0430\u0440\u043E\u043B\u044F, \u043F\u043E\u0436\u0430\u043B\u0443\u0439\u0441\u0442\u0430, \u0432\u0432\u0435\u0434\u0438\u0442\u0435 \u0437\u0430\u0440\u0435\u0433\u0438\u0441\u0442\u0440\u0438\u0440\u043E\u0432\u0430\u043D\u043D\u044B\u0439 \u0432 \u0438\u0433\u0440\u0435 email`);
        if (email != "") webSocket.send(JSON.stringify({
          [PacketDataKeys_default.TYPE]: PacketDataKeys_default.USER_RESET_PASSWORD,
          [PacketDataKeys_default.EMAIL]: email,
          [PacketDataKeys_default.APP_LANGUAGE]: "RUS"
        }));
      };
      links.appendChild(forgetPass);
    }
    async addVersion(version) {
      const self2 = this;
      if (version) {
        if (!await fs_default.existsFile(`${version.path}/config.json`)) {
          const conf = config_default();
          conf.path = version.path;
          await fs_default.writeFile(`${version.path}/config.json`, JSON.stringify(conf));
        }
        if (!version.uuid) version.uuid = uuidv4();
        const i = this.versions.findIndex((e2) => e2.path == version.path);
        if (i != -1) {
          this.versions[i] = version;
        } else {
          this.versions.push(version);
        }
        await this.writeData();
        if (i == -1) await this.#initContent(false);
        return;
      }
      this.win.lock();
      const width = isMobile() ? window.innerWidth - 150 : 300;
      const win = new Window({
        title: "\u0414\u043E\u0431\u0430\u0432\u043B\u0435\u043D\u0438\u0435 \u0432\u0435\u0440\u0441\u0438\u0438",
        width,
        height: 200,
        resizable: false,
        moveable: false,
        noMobile: true,
        minButton: false,
        maxButton: false,
        x: this.win.x + (this.win.width - width) / 2,
        y: this.win.y + (this.win.height - 200) / 2
      });
      win.content.style.overflow = "hidden";
      win.on("close", () => {
        this.win.unlock();
      });
      const btnLoadFile = document.createElement("button");
      btnLoadFile.style.width = "100%";
      btnLoadFile.innerHTML = "\u0417\u0430\u0433\u0440\u0443\u0437\u0438\u0442\u044C \u0444\u0430\u0439\u043B";
      btnLoadFile.onclick = () => this.readDownloadVersion();
      win.content.appendChild(btnLoadFile);
      const div = document.createElement("div");
      div.style.display = "flex";
      const inputPathScript = document.createElement("input");
      inputPathScript.placeholder = `\u041F\u0443\u0442\u044C \u043A \u0441\u043A\u0440\u0438\u043F\u0442\u0443`;
      div.appendChild(inputPathScript);
      const btnLoadScript = document.createElement("button");
      btnLoadScript.style.width = "100%";
      btnLoadScript.innerHTML = "\u0417\u0430\u0433\u0440\u0443\u0437\u0438\u0442\u044C \u0441\u043A\u0440\u0438\u043F\u0442";
      btnLoadScript.onclick = async () => {
        const src = inputPathScript.value;
        try {
          const version2 = await this.readVersion(src);
          if (version2) {
            win.lock();
            await self2.downloadVersion({ ...version2, scriptPath: src });
            win.close();
          } else {
            alert(`\u041E\u0448\u0438\u0431\u043A\u0430: ${e}`);
          }
        } catch (e2) {
          alert(`\u041E\u0448\u0438\u0431\u043A\u0430: ${e2}`);
        }
      };
      div.appendChild(btnLoadScript);
      win.content.appendChild(div);
      const foundScripts = document.createElement("div");
      foundScripts.style.display = "flex";
      foundScripts.style.flexDirection = "column";
      const e = document.createElement("p");
      e.style.margin = "5px";
      e.textContent = `\u041D\u0430\u0439\u0434\u0435\u043D\u044B \u0432\u0435\u0440\u0441\u0438\u0438:`;
      foundScripts.appendChild(e);
      const urls = JSON.parse(await fs_default.readFile(`/urlsVersions.json`));
      let found = false;
      for await (const url of urls) {
        try {
          const version2 = await this.readVersion(url);
          if (version2) {
            const e2 = document.createElement("button");
            e2.textContent = noXSS(url);
            e2.onclick = async () => {
              win.lock();
              await self2.downloadVersion({ ...version2, scriptPath: url });
              win.close();
            };
            foundScripts.appendChild(e2);
            found = true;
          }
        } catch {
        }
      }
      if (found) win.content.appendChild(foundScripts);
    }
    async downloadVersion(version) {
      const self2 = this;
      const dirName = version.name.replaceAll(`/`, `_`);
      if (!version.path) version.path = `/versions/${dirName}`;
      let size = 0, total = 0;
      this.btnPlay.disabled = true;
      await readImage("image", `${version.path}/`, false, {
        startProcessFS(s) {
          size = s;
          self2.progressBar.max = s;
        },
        processFS(path, write) {
          total++;
          self2.progressBar.value = total;
          if (write) {
            self2.statusText.textContent = `\u0421\u043A\u0430\u0447\u0430\u043D \u0444\u0430\u0439\u043B (${total}/${size})`;
            console.log(`downloading..`, path);
          } else
            self2.statusText.textContent = `\u041F\u0440\u043E\u0432\u0435\u0440\u043A\u0430 (${total}/${size})`;
        }
      });
      this.btnPlay.disabled = false;
      self2.statusText.textContent = ``;
      self2.addVersion(version);
    }
    readDownloadVersion() {
      const self2 = this;
      const input = document.createElement("input");
      input.type = "file";
      return new Promise((res, rej) => {
        input.onchange = (e) => {
          if (!e.target) return;
          const file = e.target.files[0];
          const reader = new FileReader();
          reader.readAsText(file, "UTF-8");
          reader.onload = async (readerEvent) => {
            const content = readerEvent.target.result;
            window["eval"](content);
            const version = window["version"];
            delete window["version"];
            await self2.downloadVersion(version);
            res(true);
          };
          reader.onerror = () => res(false);
        };
        input.click();
      });
    }
    async runGame(version, profile) {
      const config2 = JSON.parse(await fs_default.readFile(`${version.path}/config.json`));
      const mainScript = await fs_default.readFile(`${version.path}/main.js`);
      window["eval"](mainScript);
      if (!window["main"]) {
        console.error(`No main function`);
        return;
      }
      if (profile) {
        config2.auth = {
          email: profile.email,
          password: profile.password
          // token: profile.token,
          // userId: profile.userId
        };
      }
      if (this.options.version != version.name || this.options.profile != profile?.name) {
        this.options.version = version.name;
        this.options.profile = profile ? profile.name : "";
        this.writeData();
      }
      const win = new Window({
        title: `${version.name}`,
        width: 400,
        height: 500,
        minWidth: 250,
        minHeight: 400,
        center: true,
        zoom: 0.7
      });
      window["main"](config2, win, win.content);
      this.openedWindows.push(win);
    }
  };

  // launcher/src/index.ts
  async function main() {
    await fs_default.init("Indexeddb");
    App_default.launcher = new Launcher();
  }
  (async function() {
    await new Promise(async (res) => {
      await document.fonts.ready;
      const iid = setInterval(() => {
        if (document.body && document.readyState == "interactive" || document.readyState == "complete") {
          clearInterval(iid);
          res();
        }
      }, 10);
    });
  })().then(main);
})();
/**
 * [js-md5]{@link https://github.com/emn178/js-md5}
 *
 * @namespace md5
 * @version 0.8.3
 * @author Chen, Yi-Cyuan [emn178@gmail.com]
 * @copyright Chen, Yi-Cyuan 2014-2023
 * @license MIT
 */
//!root.JS_MD5_NO_NODE_JS && typeof process === 'object' && process.versions && process.versions.node;
