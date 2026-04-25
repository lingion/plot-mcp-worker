var __defProp = Object.defineProperty;
var __name = (target, value) => __defProp(target, "name", { value, configurable: true });

// src/constants.ts
var SERVER_NAME = "plot-mcp-worker";
var SERVER_VERSION = "0.2.0";
var SHORT_LINK_PATH_PREFIX = "/s/";
var SHORT_LINK_TOKEN_LENGTH = 8;
var SHORT_LINK_TTL_SECONDS = 60 * 60 * 24 * 30;
var MIN_POINTS = 10;
var MAX_POINTS = 2e4;
var MAX_EXPR_LENGTH = 400;
var MAX_TITLE_LENGTH = 120;
var MAX_LABEL_LENGTH = 80;
var MAX_SERIES = 12;
var MAX_MULTI_IMAGE_JOBS = 8;
var MAX_FORCE_ITEMS = 16;
var MAX_FORCE_BODIES = 8;
var MAX_FORCE_SURFACES = 6;
var MAX_FORCE_CONNECTORS = 10;
var MAX_CIRCUIT_COMPONENTS = 24;
var MAX_CIRCUIT_WIRES = 48;
var MAX_CIRCUIT_LAYOUT_ITEMS = 12;
var MAX_CIRCUIT_LAYOUT_BRANCHES = 4;
var MAX_SURFACE_SAMPLES = 80;
var MAX_3D_SURFACES = 6;
var MAX_3D_LINES = 8;
var MAX_3D_POINTS = 32;
var MAX_3D_LINE_POINTS = 96;
var DEFAULT_WIDTH = 1500;
var DEFAULT_HEIGHT = 750;
var DEFAULT_FONT_FAMILY = "PingFang SC, PingFang TC, Hiragino Sans GB, STHeiti, Microsoft YaHei, Noto Sans CJK SC, sans-serif";
var DEFAULT_FONT_SIZE = 20;
var DEFAULT_BG = "#ffffff";
var DEFAULT_AXIS = "#111827";
var DEFAULT_GRID = "#d1d5db";
var DEFAULT_PALETTE = [
  "#2563eb",
  "#dc2626",
  "#16a34a",
  "#9333ea",
  "#ea580c",
  "#0891b2",
  "#db2777",
  "#4f46e5"
];

// node_modules/expr-eval/dist/index.mjs
var INUMBER = "INUMBER";
var IOP1 = "IOP1";
var IOP2 = "IOP2";
var IOP3 = "IOP3";
var IVAR = "IVAR";
var IVARNAME = "IVARNAME";
var IFUNCALL = "IFUNCALL";
var IFUNDEF = "IFUNDEF";
var IEXPR = "IEXPR";
var IEXPREVAL = "IEXPREVAL";
var IMEMBER = "IMEMBER";
var IENDSTATEMENT = "IENDSTATEMENT";
var IARRAY = "IARRAY";
function Instruction(type, value) {
  this.type = type;
  this.value = value !== void 0 && value !== null ? value : 0;
}
__name(Instruction, "Instruction");
Instruction.prototype.toString = function() {
  switch (this.type) {
    case INUMBER:
    case IOP1:
    case IOP2:
    case IOP3:
    case IVAR:
    case IVARNAME:
    case IENDSTATEMENT:
      return this.value;
    case IFUNCALL:
      return "CALL " + this.value;
    case IFUNDEF:
      return "DEF " + this.value;
    case IARRAY:
      return "ARRAY " + this.value;
    case IMEMBER:
      return "." + this.value;
    default:
      return "Invalid Instruction";
  }
};
function unaryInstruction(value) {
  return new Instruction(IOP1, value);
}
__name(unaryInstruction, "unaryInstruction");
function binaryInstruction(value) {
  return new Instruction(IOP2, value);
}
__name(binaryInstruction, "binaryInstruction");
function ternaryInstruction(value) {
  return new Instruction(IOP3, value);
}
__name(ternaryInstruction, "ternaryInstruction");
function simplify(tokens, unaryOps, binaryOps, ternaryOps, values) {
  var nstack = [];
  var newexpression = [];
  var n1, n2, n3;
  var f;
  for (var i = 0; i < tokens.length; i++) {
    var item = tokens[i];
    var type = item.type;
    if (type === INUMBER || type === IVARNAME) {
      if (Array.isArray(item.value)) {
        nstack.push.apply(nstack, simplify(item.value.map(function(x) {
          return new Instruction(INUMBER, x);
        }).concat(new Instruction(IARRAY, item.value.length)), unaryOps, binaryOps, ternaryOps, values));
      } else {
        nstack.push(item);
      }
    } else if (type === IVAR && values.hasOwnProperty(item.value)) {
      item = new Instruction(INUMBER, values[item.value]);
      nstack.push(item);
    } else if (type === IOP2 && nstack.length > 1) {
      n2 = nstack.pop();
      n1 = nstack.pop();
      f = binaryOps[item.value];
      item = new Instruction(INUMBER, f(n1.value, n2.value));
      nstack.push(item);
    } else if (type === IOP3 && nstack.length > 2) {
      n3 = nstack.pop();
      n2 = nstack.pop();
      n1 = nstack.pop();
      if (item.value === "?") {
        nstack.push(n1.value ? n2.value : n3.value);
      } else {
        f = ternaryOps[item.value];
        item = new Instruction(INUMBER, f(n1.value, n2.value, n3.value));
        nstack.push(item);
      }
    } else if (type === IOP1 && nstack.length > 0) {
      n1 = nstack.pop();
      f = unaryOps[item.value];
      item = new Instruction(INUMBER, f(n1.value));
      nstack.push(item);
    } else if (type === IEXPR) {
      while (nstack.length > 0) {
        newexpression.push(nstack.shift());
      }
      newexpression.push(new Instruction(IEXPR, simplify(item.value, unaryOps, binaryOps, ternaryOps, values)));
    } else if (type === IMEMBER && nstack.length > 0) {
      n1 = nstack.pop();
      nstack.push(new Instruction(INUMBER, n1.value[item.value]));
    } else {
      while (nstack.length > 0) {
        newexpression.push(nstack.shift());
      }
      newexpression.push(item);
    }
  }
  while (nstack.length > 0) {
    newexpression.push(nstack.shift());
  }
  return newexpression;
}
__name(simplify, "simplify");
function substitute(tokens, variable, expr) {
  var newexpression = [];
  for (var i = 0; i < tokens.length; i++) {
    var item = tokens[i];
    var type = item.type;
    if (type === IVAR && item.value === variable) {
      for (var j = 0; j < expr.tokens.length; j++) {
        var expritem = expr.tokens[j];
        var replitem;
        if (expritem.type === IOP1) {
          replitem = unaryInstruction(expritem.value);
        } else if (expritem.type === IOP2) {
          replitem = binaryInstruction(expritem.value);
        } else if (expritem.type === IOP3) {
          replitem = ternaryInstruction(expritem.value);
        } else {
          replitem = new Instruction(expritem.type, expritem.value);
        }
        newexpression.push(replitem);
      }
    } else if (type === IEXPR) {
      newexpression.push(new Instruction(IEXPR, substitute(item.value, variable, expr)));
    } else {
      newexpression.push(item);
    }
  }
  return newexpression;
}
__name(substitute, "substitute");
function evaluate(tokens, expr, values) {
  var nstack = [];
  var n1, n2, n3;
  var f, args, argCount;
  if (isExpressionEvaluator(tokens)) {
    return resolveExpression(tokens, values);
  }
  var numTokens = tokens.length;
  for (var i = 0; i < numTokens; i++) {
    var item = tokens[i];
    var type = item.type;
    if (type === INUMBER || type === IVARNAME) {
      nstack.push(item.value);
    } else if (type === IOP2) {
      n2 = nstack.pop();
      n1 = nstack.pop();
      if (item.value === "and") {
        nstack.push(n1 ? !!evaluate(n2, expr, values) : false);
      } else if (item.value === "or") {
        nstack.push(n1 ? true : !!evaluate(n2, expr, values));
      } else if (item.value === "=") {
        f = expr.binaryOps[item.value];
        nstack.push(f(n1, evaluate(n2, expr, values), values));
      } else {
        f = expr.binaryOps[item.value];
        nstack.push(f(resolveExpression(n1, values), resolveExpression(n2, values)));
      }
    } else if (type === IOP3) {
      n3 = nstack.pop();
      n2 = nstack.pop();
      n1 = nstack.pop();
      if (item.value === "?") {
        nstack.push(evaluate(n1 ? n2 : n3, expr, values));
      } else {
        f = expr.ternaryOps[item.value];
        nstack.push(f(resolveExpression(n1, values), resolveExpression(n2, values), resolveExpression(n3, values)));
      }
    } else if (type === IVAR) {
      if (item.value in expr.functions) {
        nstack.push(expr.functions[item.value]);
      } else if (item.value in expr.unaryOps && expr.parser.isOperatorEnabled(item.value)) {
        nstack.push(expr.unaryOps[item.value]);
      } else {
        var v = values[item.value];
        if (v !== void 0) {
          nstack.push(v);
        } else {
          throw new Error("undefined variable: " + item.value);
        }
      }
    } else if (type === IOP1) {
      n1 = nstack.pop();
      f = expr.unaryOps[item.value];
      nstack.push(f(resolveExpression(n1, values)));
    } else if (type === IFUNCALL) {
      argCount = item.value;
      args = [];
      while (argCount-- > 0) {
        args.unshift(resolveExpression(nstack.pop(), values));
      }
      f = nstack.pop();
      if (f.apply && f.call) {
        nstack.push(f.apply(void 0, args));
      } else {
        throw new Error(f + " is not a function");
      }
    } else if (type === IFUNDEF) {
      nstack.push((function() {
        var n22 = nstack.pop();
        var args2 = [];
        var argCount2 = item.value;
        while (argCount2-- > 0) {
          args2.unshift(nstack.pop());
        }
        var n12 = nstack.pop();
        var f2 = /* @__PURE__ */ __name(function() {
          var scope = Object.assign({}, values);
          for (var i2 = 0, len = args2.length; i2 < len; i2++) {
            scope[args2[i2]] = arguments[i2];
          }
          return evaluate(n22, expr, scope);
        }, "f");
        Object.defineProperty(f2, "name", {
          value: n12,
          writable: false
        });
        values[n12] = f2;
        return f2;
      })());
    } else if (type === IEXPR) {
      nstack.push(createExpressionEvaluator(item, expr));
    } else if (type === IEXPREVAL) {
      nstack.push(item);
    } else if (type === IMEMBER) {
      n1 = nstack.pop();
      nstack.push(n1[item.value]);
    } else if (type === IENDSTATEMENT) {
      nstack.pop();
    } else if (type === IARRAY) {
      argCount = item.value;
      args = [];
      while (argCount-- > 0) {
        args.unshift(nstack.pop());
      }
      nstack.push(args);
    } else {
      throw new Error("invalid Expression");
    }
  }
  if (nstack.length > 1) {
    throw new Error("invalid Expression (parity)");
  }
  return nstack[0] === 0 ? 0 : resolveExpression(nstack[0], values);
}
__name(evaluate, "evaluate");
function createExpressionEvaluator(token, expr, values) {
  if (isExpressionEvaluator(token)) return token;
  return {
    type: IEXPREVAL,
    value: /* @__PURE__ */ __name(function(scope) {
      return evaluate(token.value, expr, scope);
    }, "value")
  };
}
__name(createExpressionEvaluator, "createExpressionEvaluator");
function isExpressionEvaluator(n) {
  return n && n.type === IEXPREVAL;
}
__name(isExpressionEvaluator, "isExpressionEvaluator");
function resolveExpression(n, values) {
  return isExpressionEvaluator(n) ? n.value(values) : n;
}
__name(resolveExpression, "resolveExpression");
function expressionToString(tokens, toJS) {
  var nstack = [];
  var n1, n2, n3;
  var f, args, argCount;
  for (var i = 0; i < tokens.length; i++) {
    var item = tokens[i];
    var type = item.type;
    if (type === INUMBER) {
      if (typeof item.value === "number" && item.value < 0) {
        nstack.push("(" + item.value + ")");
      } else if (Array.isArray(item.value)) {
        nstack.push("[" + item.value.map(escapeValue).join(", ") + "]");
      } else {
        nstack.push(escapeValue(item.value));
      }
    } else if (type === IOP2) {
      n2 = nstack.pop();
      n1 = nstack.pop();
      f = item.value;
      if (toJS) {
        if (f === "^") {
          nstack.push("Math.pow(" + n1 + ", " + n2 + ")");
        } else if (f === "and") {
          nstack.push("(!!" + n1 + " && !!" + n2 + ")");
        } else if (f === "or") {
          nstack.push("(!!" + n1 + " || !!" + n2 + ")");
        } else if (f === "||") {
          nstack.push("(function(a,b){ return Array.isArray(a) && Array.isArray(b) ? a.concat(b) : String(a) + String(b); }((" + n1 + "),(" + n2 + ")))");
        } else if (f === "==") {
          nstack.push("(" + n1 + " === " + n2 + ")");
        } else if (f === "!=") {
          nstack.push("(" + n1 + " !== " + n2 + ")");
        } else if (f === "[") {
          nstack.push(n1 + "[(" + n2 + ") | 0]");
        } else {
          nstack.push("(" + n1 + " " + f + " " + n2 + ")");
        }
      } else {
        if (f === "[") {
          nstack.push(n1 + "[" + n2 + "]");
        } else {
          nstack.push("(" + n1 + " " + f + " " + n2 + ")");
        }
      }
    } else if (type === IOP3) {
      n3 = nstack.pop();
      n2 = nstack.pop();
      n1 = nstack.pop();
      f = item.value;
      if (f === "?") {
        nstack.push("(" + n1 + " ? " + n2 + " : " + n3 + ")");
      } else {
        throw new Error("invalid Expression");
      }
    } else if (type === IVAR || type === IVARNAME) {
      nstack.push(item.value);
    } else if (type === IOP1) {
      n1 = nstack.pop();
      f = item.value;
      if (f === "-" || f === "+") {
        nstack.push("(" + f + n1 + ")");
      } else if (toJS) {
        if (f === "not") {
          nstack.push("(!" + n1 + ")");
        } else if (f === "!") {
          nstack.push("fac(" + n1 + ")");
        } else {
          nstack.push(f + "(" + n1 + ")");
        }
      } else if (f === "!") {
        nstack.push("(" + n1 + "!)");
      } else {
        nstack.push("(" + f + " " + n1 + ")");
      }
    } else if (type === IFUNCALL) {
      argCount = item.value;
      args = [];
      while (argCount-- > 0) {
        args.unshift(nstack.pop());
      }
      f = nstack.pop();
      nstack.push(f + "(" + args.join(", ") + ")");
    } else if (type === IFUNDEF) {
      n2 = nstack.pop();
      argCount = item.value;
      args = [];
      while (argCount-- > 0) {
        args.unshift(nstack.pop());
      }
      n1 = nstack.pop();
      if (toJS) {
        nstack.push("(" + n1 + " = function(" + args.join(", ") + ") { return " + n2 + " })");
      } else {
        nstack.push("(" + n1 + "(" + args.join(", ") + ") = " + n2 + ")");
      }
    } else if (type === IMEMBER) {
      n1 = nstack.pop();
      nstack.push(n1 + "." + item.value);
    } else if (type === IARRAY) {
      argCount = item.value;
      args = [];
      while (argCount-- > 0) {
        args.unshift(nstack.pop());
      }
      nstack.push("[" + args.join(", ") + "]");
    } else if (type === IEXPR) {
      nstack.push("(" + expressionToString(item.value, toJS) + ")");
    } else if (type === IENDSTATEMENT) ;
    else {
      throw new Error("invalid Expression");
    }
  }
  if (nstack.length > 1) {
    if (toJS) {
      nstack = [nstack.join(",")];
    } else {
      nstack = [nstack.join(";")];
    }
  }
  return String(nstack[0]);
}
__name(expressionToString, "expressionToString");
function escapeValue(v) {
  if (typeof v === "string") {
    return JSON.stringify(v).replace(/\u2028/g, "\\u2028").replace(/\u2029/g, "\\u2029");
  }
  return v;
}
__name(escapeValue, "escapeValue");
function contains(array, obj) {
  for (var i = 0; i < array.length; i++) {
    if (array[i] === obj) {
      return true;
    }
  }
  return false;
}
__name(contains, "contains");
function getSymbols(tokens, symbols, options) {
  options = options || {};
  var withMembers = !!options.withMembers;
  var prevVar = null;
  for (var i = 0; i < tokens.length; i++) {
    var item = tokens[i];
    if (item.type === IVAR || item.type === IVARNAME) {
      if (!withMembers && !contains(symbols, item.value)) {
        symbols.push(item.value);
      } else if (prevVar !== null) {
        if (!contains(symbols, prevVar)) {
          symbols.push(prevVar);
        }
        prevVar = item.value;
      } else {
        prevVar = item.value;
      }
    } else if (item.type === IMEMBER && withMembers && prevVar !== null) {
      prevVar += "." + item.value;
    } else if (item.type === IEXPR) {
      getSymbols(item.value, symbols, options);
    } else if (prevVar !== null) {
      if (!contains(symbols, prevVar)) {
        symbols.push(prevVar);
      }
      prevVar = null;
    }
  }
  if (prevVar !== null && !contains(symbols, prevVar)) {
    symbols.push(prevVar);
  }
}
__name(getSymbols, "getSymbols");
function Expression(tokens, parser2) {
  this.tokens = tokens;
  this.parser = parser2;
  this.unaryOps = parser2.unaryOps;
  this.binaryOps = parser2.binaryOps;
  this.ternaryOps = parser2.ternaryOps;
  this.functions = parser2.functions;
}
__name(Expression, "Expression");
Expression.prototype.simplify = function(values) {
  values = values || {};
  return new Expression(simplify(this.tokens, this.unaryOps, this.binaryOps, this.ternaryOps, values), this.parser);
};
Expression.prototype.substitute = function(variable, expr) {
  if (!(expr instanceof Expression)) {
    expr = this.parser.parse(String(expr));
  }
  return new Expression(substitute(this.tokens, variable, expr), this.parser);
};
Expression.prototype.evaluate = function(values) {
  values = values || {};
  return evaluate(this.tokens, this, values);
};
Expression.prototype.toString = function() {
  return expressionToString(this.tokens, false);
};
Expression.prototype.symbols = function(options) {
  options = options || {};
  var vars = [];
  getSymbols(this.tokens, vars, options);
  return vars;
};
Expression.prototype.variables = function(options) {
  options = options || {};
  var vars = [];
  getSymbols(this.tokens, vars, options);
  var functions = this.functions;
  return vars.filter(function(name) {
    return !(name in functions);
  });
};
Expression.prototype.toJSFunction = function(param, variables) {
  var expr = this;
  var f = new Function(param, "with(this.functions) with (this.ternaryOps) with (this.binaryOps) with (this.unaryOps) { return " + expressionToString(this.simplify(variables).tokens, true) + "; }");
  return function() {
    return f.apply(expr, arguments);
  };
};
var TEOF = "TEOF";
var TOP = "TOP";
var TNUMBER = "TNUMBER";
var TSTRING = "TSTRING";
var TPAREN = "TPAREN";
var TBRACKET = "TBRACKET";
var TCOMMA = "TCOMMA";
var TNAME = "TNAME";
var TSEMICOLON = "TSEMICOLON";
function Token(type, value, index) {
  this.type = type;
  this.value = value;
  this.index = index;
}
__name(Token, "Token");
Token.prototype.toString = function() {
  return this.type + ": " + this.value;
};
function TokenStream(parser2, expression) {
  this.pos = 0;
  this.current = null;
  this.unaryOps = parser2.unaryOps;
  this.binaryOps = parser2.binaryOps;
  this.ternaryOps = parser2.ternaryOps;
  this.consts = parser2.consts;
  this.expression = expression;
  this.savedPosition = 0;
  this.savedCurrent = null;
  this.options = parser2.options;
  this.parser = parser2;
}
__name(TokenStream, "TokenStream");
TokenStream.prototype.newToken = function(type, value, pos) {
  return new Token(type, value, pos != null ? pos : this.pos);
};
TokenStream.prototype.save = function() {
  this.savedPosition = this.pos;
  this.savedCurrent = this.current;
};
TokenStream.prototype.restore = function() {
  this.pos = this.savedPosition;
  this.current = this.savedCurrent;
};
TokenStream.prototype.next = function() {
  if (this.pos >= this.expression.length) {
    return this.newToken(TEOF, "EOF");
  }
  if (this.isWhitespace() || this.isComment()) {
    return this.next();
  } else if (this.isRadixInteger() || this.isNumber() || this.isOperator() || this.isString() || this.isParen() || this.isBracket() || this.isComma() || this.isSemicolon() || this.isNamedOp() || this.isConst() || this.isName()) {
    return this.current;
  } else {
    this.parseError('Unknown character "' + this.expression.charAt(this.pos) + '"');
  }
};
TokenStream.prototype.isString = function() {
  var r = false;
  var startPos = this.pos;
  var quote = this.expression.charAt(startPos);
  if (quote === "'" || quote === '"') {
    var index = this.expression.indexOf(quote, startPos + 1);
    while (index >= 0 && this.pos < this.expression.length) {
      this.pos = index + 1;
      if (this.expression.charAt(index - 1) !== "\\") {
        var rawString = this.expression.substring(startPos + 1, index);
        this.current = this.newToken(TSTRING, this.unescape(rawString), startPos);
        r = true;
        break;
      }
      index = this.expression.indexOf(quote, index + 1);
    }
  }
  return r;
};
TokenStream.prototype.isParen = function() {
  var c = this.expression.charAt(this.pos);
  if (c === "(" || c === ")") {
    this.current = this.newToken(TPAREN, c);
    this.pos++;
    return true;
  }
  return false;
};
TokenStream.prototype.isBracket = function() {
  var c = this.expression.charAt(this.pos);
  if ((c === "[" || c === "]") && this.isOperatorEnabled("[")) {
    this.current = this.newToken(TBRACKET, c);
    this.pos++;
    return true;
  }
  return false;
};
TokenStream.prototype.isComma = function() {
  var c = this.expression.charAt(this.pos);
  if (c === ",") {
    this.current = this.newToken(TCOMMA, ",");
    this.pos++;
    return true;
  }
  return false;
};
TokenStream.prototype.isSemicolon = function() {
  var c = this.expression.charAt(this.pos);
  if (c === ";") {
    this.current = this.newToken(TSEMICOLON, ";");
    this.pos++;
    return true;
  }
  return false;
};
TokenStream.prototype.isConst = function() {
  var startPos = this.pos;
  var i = startPos;
  for (; i < this.expression.length; i++) {
    var c = this.expression.charAt(i);
    if (c.toUpperCase() === c.toLowerCase()) {
      if (i === this.pos || c !== "_" && c !== "." && (c < "0" || c > "9")) {
        break;
      }
    }
  }
  if (i > startPos) {
    var str = this.expression.substring(startPos, i);
    if (str in this.consts) {
      this.current = this.newToken(TNUMBER, this.consts[str]);
      this.pos += str.length;
      return true;
    }
  }
  return false;
};
TokenStream.prototype.isNamedOp = function() {
  var startPos = this.pos;
  var i = startPos;
  for (; i < this.expression.length; i++) {
    var c = this.expression.charAt(i);
    if (c.toUpperCase() === c.toLowerCase()) {
      if (i === this.pos || c !== "_" && (c < "0" || c > "9")) {
        break;
      }
    }
  }
  if (i > startPos) {
    var str = this.expression.substring(startPos, i);
    if (this.isOperatorEnabled(str) && (str in this.binaryOps || str in this.unaryOps || str in this.ternaryOps)) {
      this.current = this.newToken(TOP, str);
      this.pos += str.length;
      return true;
    }
  }
  return false;
};
TokenStream.prototype.isName = function() {
  var startPos = this.pos;
  var i = startPos;
  var hasLetter = false;
  for (; i < this.expression.length; i++) {
    var c = this.expression.charAt(i);
    if (c.toUpperCase() === c.toLowerCase()) {
      if (i === this.pos && (c === "$" || c === "_")) {
        if (c === "_") {
          hasLetter = true;
        }
        continue;
      } else if (i === this.pos || !hasLetter || c !== "_" && (c < "0" || c > "9")) {
        break;
      }
    } else {
      hasLetter = true;
    }
  }
  if (hasLetter) {
    var str = this.expression.substring(startPos, i);
    this.current = this.newToken(TNAME, str);
    this.pos += str.length;
    return true;
  }
  return false;
};
TokenStream.prototype.isWhitespace = function() {
  var r = false;
  var c = this.expression.charAt(this.pos);
  while (c === " " || c === "	" || c === "\n" || c === "\r") {
    r = true;
    this.pos++;
    if (this.pos >= this.expression.length) {
      break;
    }
    c = this.expression.charAt(this.pos);
  }
  return r;
};
var codePointPattern = /^[0-9a-f]{4}$/i;
TokenStream.prototype.unescape = function(v) {
  var index = v.indexOf("\\");
  if (index < 0) {
    return v;
  }
  var buffer = v.substring(0, index);
  while (index >= 0) {
    var c = v.charAt(++index);
    switch (c) {
      case "'":
        buffer += "'";
        break;
      case '"':
        buffer += '"';
        break;
      case "\\":
        buffer += "\\";
        break;
      case "/":
        buffer += "/";
        break;
      case "b":
        buffer += "\b";
        break;
      case "f":
        buffer += "\f";
        break;
      case "n":
        buffer += "\n";
        break;
      case "r":
        buffer += "\r";
        break;
      case "t":
        buffer += "	";
        break;
      case "u":
        var codePoint = v.substring(index + 1, index + 5);
        if (!codePointPattern.test(codePoint)) {
          this.parseError("Illegal escape sequence: \\u" + codePoint);
        }
        buffer += String.fromCharCode(parseInt(codePoint, 16));
        index += 4;
        break;
      default:
        throw this.parseError('Illegal escape sequence: "\\' + c + '"');
    }
    ++index;
    var backslash = v.indexOf("\\", index);
    buffer += v.substring(index, backslash < 0 ? v.length : backslash);
    index = backslash;
  }
  return buffer;
};
TokenStream.prototype.isComment = function() {
  var c = this.expression.charAt(this.pos);
  if (c === "/" && this.expression.charAt(this.pos + 1) === "*") {
    this.pos = this.expression.indexOf("*/", this.pos) + 2;
    if (this.pos === 1) {
      this.pos = this.expression.length;
    }
    return true;
  }
  return false;
};
TokenStream.prototype.isRadixInteger = function() {
  var pos = this.pos;
  if (pos >= this.expression.length - 2 || this.expression.charAt(pos) !== "0") {
    return false;
  }
  ++pos;
  var radix;
  var validDigit;
  if (this.expression.charAt(pos) === "x") {
    radix = 16;
    validDigit = /^[0-9a-f]$/i;
    ++pos;
  } else if (this.expression.charAt(pos) === "b") {
    radix = 2;
    validDigit = /^[01]$/i;
    ++pos;
  } else {
    return false;
  }
  var valid = false;
  var startPos = pos;
  while (pos < this.expression.length) {
    var c = this.expression.charAt(pos);
    if (validDigit.test(c)) {
      pos++;
      valid = true;
    } else {
      break;
    }
  }
  if (valid) {
    this.current = this.newToken(TNUMBER, parseInt(this.expression.substring(startPos, pos), radix));
    this.pos = pos;
  }
  return valid;
};
TokenStream.prototype.isNumber = function() {
  var valid = false;
  var pos = this.pos;
  var startPos = pos;
  var resetPos = pos;
  var foundDot = false;
  var foundDigits = false;
  var c;
  while (pos < this.expression.length) {
    c = this.expression.charAt(pos);
    if (c >= "0" && c <= "9" || !foundDot && c === ".") {
      if (c === ".") {
        foundDot = true;
      } else {
        foundDigits = true;
      }
      pos++;
      valid = foundDigits;
    } else {
      break;
    }
  }
  if (valid) {
    resetPos = pos;
  }
  if (c === "e" || c === "E") {
    pos++;
    var acceptSign = true;
    var validExponent = false;
    while (pos < this.expression.length) {
      c = this.expression.charAt(pos);
      if (acceptSign && (c === "+" || c === "-")) {
        acceptSign = false;
      } else if (c >= "0" && c <= "9") {
        validExponent = true;
        acceptSign = false;
      } else {
        break;
      }
      pos++;
    }
    if (!validExponent) {
      pos = resetPos;
    }
  }
  if (valid) {
    this.current = this.newToken(TNUMBER, parseFloat(this.expression.substring(startPos, pos)));
    this.pos = pos;
  } else {
    this.pos = resetPos;
  }
  return valid;
};
TokenStream.prototype.isOperator = function() {
  var startPos = this.pos;
  var c = this.expression.charAt(this.pos);
  if (c === "+" || c === "-" || c === "*" || c === "/" || c === "%" || c === "^" || c === "?" || c === ":" || c === ".") {
    this.current = this.newToken(TOP, c);
  } else if (c === "\u2219" || c === "\u2022") {
    this.current = this.newToken(TOP, "*");
  } else if (c === ">") {
    if (this.expression.charAt(this.pos + 1) === "=") {
      this.current = this.newToken(TOP, ">=");
      this.pos++;
    } else {
      this.current = this.newToken(TOP, ">");
    }
  } else if (c === "<") {
    if (this.expression.charAt(this.pos + 1) === "=") {
      this.current = this.newToken(TOP, "<=");
      this.pos++;
    } else {
      this.current = this.newToken(TOP, "<");
    }
  } else if (c === "|") {
    if (this.expression.charAt(this.pos + 1) === "|") {
      this.current = this.newToken(TOP, "||");
      this.pos++;
    } else {
      return false;
    }
  } else if (c === "=") {
    if (this.expression.charAt(this.pos + 1) === "=") {
      this.current = this.newToken(TOP, "==");
      this.pos++;
    } else {
      this.current = this.newToken(TOP, c);
    }
  } else if (c === "!") {
    if (this.expression.charAt(this.pos + 1) === "=") {
      this.current = this.newToken(TOP, "!=");
      this.pos++;
    } else {
      this.current = this.newToken(TOP, c);
    }
  } else {
    return false;
  }
  this.pos++;
  if (this.isOperatorEnabled(this.current.value)) {
    return true;
  } else {
    this.pos = startPos;
    return false;
  }
};
TokenStream.prototype.isOperatorEnabled = function(op) {
  return this.parser.isOperatorEnabled(op);
};
TokenStream.prototype.getCoordinates = function() {
  var line = 0;
  var column;
  var newline = -1;
  do {
    line++;
    column = this.pos - newline;
    newline = this.expression.indexOf("\n", newline + 1);
  } while (newline >= 0 && newline < this.pos);
  return {
    line,
    column
  };
};
TokenStream.prototype.parseError = function(msg) {
  var coords = this.getCoordinates();
  throw new Error("parse error [" + coords.line + ":" + coords.column + "]: " + msg);
};
function ParserState(parser2, tokenStream, options) {
  this.parser = parser2;
  this.tokens = tokenStream;
  this.current = null;
  this.nextToken = null;
  this.next();
  this.savedCurrent = null;
  this.savedNextToken = null;
  this.allowMemberAccess = options.allowMemberAccess !== false;
}
__name(ParserState, "ParserState");
ParserState.prototype.next = function() {
  this.current = this.nextToken;
  return this.nextToken = this.tokens.next();
};
ParserState.prototype.tokenMatches = function(token, value) {
  if (typeof value === "undefined") {
    return true;
  } else if (Array.isArray(value)) {
    return contains(value, token.value);
  } else if (typeof value === "function") {
    return value(token);
  } else {
    return token.value === value;
  }
};
ParserState.prototype.save = function() {
  this.savedCurrent = this.current;
  this.savedNextToken = this.nextToken;
  this.tokens.save();
};
ParserState.prototype.restore = function() {
  this.tokens.restore();
  this.current = this.savedCurrent;
  this.nextToken = this.savedNextToken;
};
ParserState.prototype.accept = function(type, value) {
  if (this.nextToken.type === type && this.tokenMatches(this.nextToken, value)) {
    this.next();
    return true;
  }
  return false;
};
ParserState.prototype.expect = function(type, value) {
  if (!this.accept(type, value)) {
    var coords = this.tokens.getCoordinates();
    throw new Error("parse error [" + coords.line + ":" + coords.column + "]: Expected " + (value || type));
  }
};
ParserState.prototype.parseAtom = function(instr) {
  var unaryOps = this.tokens.unaryOps;
  function isPrefixOperator(token) {
    return token.value in unaryOps;
  }
  __name(isPrefixOperator, "isPrefixOperator");
  if (this.accept(TNAME) || this.accept(TOP, isPrefixOperator)) {
    instr.push(new Instruction(IVAR, this.current.value));
  } else if (this.accept(TNUMBER)) {
    instr.push(new Instruction(INUMBER, this.current.value));
  } else if (this.accept(TSTRING)) {
    instr.push(new Instruction(INUMBER, this.current.value));
  } else if (this.accept(TPAREN, "(")) {
    this.parseExpression(instr);
    this.expect(TPAREN, ")");
  } else if (this.accept(TBRACKET, "[")) {
    if (this.accept(TBRACKET, "]")) {
      instr.push(new Instruction(IARRAY, 0));
    } else {
      var argCount = this.parseArrayList(instr);
      instr.push(new Instruction(IARRAY, argCount));
    }
  } else {
    throw new Error("unexpected " + this.nextToken);
  }
};
ParserState.prototype.parseExpression = function(instr) {
  var exprInstr = [];
  if (this.parseUntilEndStatement(instr, exprInstr)) {
    return;
  }
  this.parseVariableAssignmentExpression(exprInstr);
  if (this.parseUntilEndStatement(instr, exprInstr)) {
    return;
  }
  this.pushExpression(instr, exprInstr);
};
ParserState.prototype.pushExpression = function(instr, exprInstr) {
  for (var i = 0, len = exprInstr.length; i < len; i++) {
    instr.push(exprInstr[i]);
  }
};
ParserState.prototype.parseUntilEndStatement = function(instr, exprInstr) {
  if (!this.accept(TSEMICOLON)) return false;
  if (this.nextToken && this.nextToken.type !== TEOF && !(this.nextToken.type === TPAREN && this.nextToken.value === ")")) {
    exprInstr.push(new Instruction(IENDSTATEMENT));
  }
  if (this.nextToken.type !== TEOF) {
    this.parseExpression(exprInstr);
  }
  instr.push(new Instruction(IEXPR, exprInstr));
  return true;
};
ParserState.prototype.parseArrayList = function(instr) {
  var argCount = 0;
  while (!this.accept(TBRACKET, "]")) {
    this.parseExpression(instr);
    ++argCount;
    while (this.accept(TCOMMA)) {
      this.parseExpression(instr);
      ++argCount;
    }
  }
  return argCount;
};
ParserState.prototype.parseVariableAssignmentExpression = function(instr) {
  this.parseConditionalExpression(instr);
  while (this.accept(TOP, "=")) {
    var varName = instr.pop();
    var varValue = [];
    var lastInstrIndex = instr.length - 1;
    if (varName.type === IFUNCALL) {
      if (!this.tokens.isOperatorEnabled("()=")) {
        throw new Error("function definition is not permitted");
      }
      for (var i = 0, len = varName.value + 1; i < len; i++) {
        var index = lastInstrIndex - i;
        if (instr[index].type === IVAR) {
          instr[index] = new Instruction(IVARNAME, instr[index].value);
        }
      }
      this.parseVariableAssignmentExpression(varValue);
      instr.push(new Instruction(IEXPR, varValue));
      instr.push(new Instruction(IFUNDEF, varName.value));
      continue;
    }
    if (varName.type !== IVAR && varName.type !== IMEMBER) {
      throw new Error("expected variable for assignment");
    }
    this.parseVariableAssignmentExpression(varValue);
    instr.push(new Instruction(IVARNAME, varName.value));
    instr.push(new Instruction(IEXPR, varValue));
    instr.push(binaryInstruction("="));
  }
};
ParserState.prototype.parseConditionalExpression = function(instr) {
  this.parseOrExpression(instr);
  while (this.accept(TOP, "?")) {
    var trueBranch = [];
    var falseBranch = [];
    this.parseConditionalExpression(trueBranch);
    this.expect(TOP, ":");
    this.parseConditionalExpression(falseBranch);
    instr.push(new Instruction(IEXPR, trueBranch));
    instr.push(new Instruction(IEXPR, falseBranch));
    instr.push(ternaryInstruction("?"));
  }
};
ParserState.prototype.parseOrExpression = function(instr) {
  this.parseAndExpression(instr);
  while (this.accept(TOP, "or")) {
    var falseBranch = [];
    this.parseAndExpression(falseBranch);
    instr.push(new Instruction(IEXPR, falseBranch));
    instr.push(binaryInstruction("or"));
  }
};
ParserState.prototype.parseAndExpression = function(instr) {
  this.parseComparison(instr);
  while (this.accept(TOP, "and")) {
    var trueBranch = [];
    this.parseComparison(trueBranch);
    instr.push(new Instruction(IEXPR, trueBranch));
    instr.push(binaryInstruction("and"));
  }
};
var COMPARISON_OPERATORS = ["==", "!=", "<", "<=", ">=", ">", "in"];
ParserState.prototype.parseComparison = function(instr) {
  this.parseAddSub(instr);
  while (this.accept(TOP, COMPARISON_OPERATORS)) {
    var op = this.current;
    this.parseAddSub(instr);
    instr.push(binaryInstruction(op.value));
  }
};
var ADD_SUB_OPERATORS = ["+", "-", "||"];
ParserState.prototype.parseAddSub = function(instr) {
  this.parseTerm(instr);
  while (this.accept(TOP, ADD_SUB_OPERATORS)) {
    var op = this.current;
    this.parseTerm(instr);
    instr.push(binaryInstruction(op.value));
  }
};
var TERM_OPERATORS = ["*", "/", "%"];
ParserState.prototype.parseTerm = function(instr) {
  this.parseFactor(instr);
  while (this.accept(TOP, TERM_OPERATORS)) {
    var op = this.current;
    this.parseFactor(instr);
    instr.push(binaryInstruction(op.value));
  }
};
ParserState.prototype.parseFactor = function(instr) {
  var unaryOps = this.tokens.unaryOps;
  function isPrefixOperator(token) {
    return token.value in unaryOps;
  }
  __name(isPrefixOperator, "isPrefixOperator");
  this.save();
  if (this.accept(TOP, isPrefixOperator)) {
    if (this.current.value !== "-" && this.current.value !== "+") {
      if (this.nextToken.type === TPAREN && this.nextToken.value === "(") {
        this.restore();
        this.parseExponential(instr);
        return;
      } else if (this.nextToken.type === TSEMICOLON || this.nextToken.type === TCOMMA || this.nextToken.type === TEOF || this.nextToken.type === TPAREN && this.nextToken.value === ")") {
        this.restore();
        this.parseAtom(instr);
        return;
      }
    }
    var op = this.current;
    this.parseFactor(instr);
    instr.push(unaryInstruction(op.value));
  } else {
    this.parseExponential(instr);
  }
};
ParserState.prototype.parseExponential = function(instr) {
  this.parsePostfixExpression(instr);
  while (this.accept(TOP, "^")) {
    this.parseFactor(instr);
    instr.push(binaryInstruction("^"));
  }
};
ParserState.prototype.parsePostfixExpression = function(instr) {
  this.parseFunctionCall(instr);
  while (this.accept(TOP, "!")) {
    instr.push(unaryInstruction("!"));
  }
};
ParserState.prototype.parseFunctionCall = function(instr) {
  var unaryOps = this.tokens.unaryOps;
  function isPrefixOperator(token) {
    return token.value in unaryOps;
  }
  __name(isPrefixOperator, "isPrefixOperator");
  if (this.accept(TOP, isPrefixOperator)) {
    var op = this.current;
    this.parseAtom(instr);
    instr.push(unaryInstruction(op.value));
  } else {
    this.parseMemberExpression(instr);
    while (this.accept(TPAREN, "(")) {
      if (this.accept(TPAREN, ")")) {
        instr.push(new Instruction(IFUNCALL, 0));
      } else {
        var argCount = this.parseArgumentList(instr);
        instr.push(new Instruction(IFUNCALL, argCount));
      }
    }
  }
};
ParserState.prototype.parseArgumentList = function(instr) {
  var argCount = 0;
  while (!this.accept(TPAREN, ")")) {
    this.parseExpression(instr);
    ++argCount;
    while (this.accept(TCOMMA)) {
      this.parseExpression(instr);
      ++argCount;
    }
  }
  return argCount;
};
ParserState.prototype.parseMemberExpression = function(instr) {
  this.parseAtom(instr);
  while (this.accept(TOP, ".") || this.accept(TBRACKET, "[")) {
    var op = this.current;
    if (op.value === ".") {
      if (!this.allowMemberAccess) {
        throw new Error('unexpected ".", member access is not permitted');
      }
      this.expect(TNAME);
      instr.push(new Instruction(IMEMBER, this.current.value));
    } else if (op.value === "[") {
      if (!this.tokens.isOperatorEnabled("[")) {
        throw new Error('unexpected "[]", arrays are disabled');
      }
      this.parseExpression(instr);
      this.expect(TBRACKET, "]");
      instr.push(binaryInstruction("["));
    } else {
      throw new Error("unexpected symbol: " + op.value);
    }
  }
};
function add(a, b) {
  return Number(a) + Number(b);
}
__name(add, "add");
function sub(a, b) {
  return a - b;
}
__name(sub, "sub");
function mul(a, b) {
  return a * b;
}
__name(mul, "mul");
function div(a, b) {
  return a / b;
}
__name(div, "div");
function mod(a, b) {
  return a % b;
}
__name(mod, "mod");
function concat(a, b) {
  if (Array.isArray(a) && Array.isArray(b)) {
    return a.concat(b);
  }
  return "" + a + b;
}
__name(concat, "concat");
function equal(a, b) {
  return a === b;
}
__name(equal, "equal");
function notEqual(a, b) {
  return a !== b;
}
__name(notEqual, "notEqual");
function greaterThan(a, b) {
  return a > b;
}
__name(greaterThan, "greaterThan");
function lessThan(a, b) {
  return a < b;
}
__name(lessThan, "lessThan");
function greaterThanEqual(a, b) {
  return a >= b;
}
__name(greaterThanEqual, "greaterThanEqual");
function lessThanEqual(a, b) {
  return a <= b;
}
__name(lessThanEqual, "lessThanEqual");
function andOperator(a, b) {
  return Boolean(a && b);
}
__name(andOperator, "andOperator");
function orOperator(a, b) {
  return Boolean(a || b);
}
__name(orOperator, "orOperator");
function inOperator(a, b) {
  return contains(b, a);
}
__name(inOperator, "inOperator");
function sinh(a) {
  return (Math.exp(a) - Math.exp(-a)) / 2;
}
__name(sinh, "sinh");
function cosh(a) {
  return (Math.exp(a) + Math.exp(-a)) / 2;
}
__name(cosh, "cosh");
function tanh(a) {
  if (a === Infinity) return 1;
  if (a === -Infinity) return -1;
  return (Math.exp(a) - Math.exp(-a)) / (Math.exp(a) + Math.exp(-a));
}
__name(tanh, "tanh");
function asinh(a) {
  if (a === -Infinity) return a;
  return Math.log(a + Math.sqrt(a * a + 1));
}
__name(asinh, "asinh");
function acosh(a) {
  return Math.log(a + Math.sqrt(a * a - 1));
}
__name(acosh, "acosh");
function atanh(a) {
  return Math.log((1 + a) / (1 - a)) / 2;
}
__name(atanh, "atanh");
function log10(a) {
  return Math.log(a) * Math.LOG10E;
}
__name(log10, "log10");
function neg(a) {
  return -a;
}
__name(neg, "neg");
function not(a) {
  return !a;
}
__name(not, "not");
function trunc(a) {
  return a < 0 ? Math.ceil(a) : Math.floor(a);
}
__name(trunc, "trunc");
function random(a) {
  return Math.random() * (a || 1);
}
__name(random, "random");
function factorial(a) {
  return gamma(a + 1);
}
__name(factorial, "factorial");
function isInteger(value) {
  return isFinite(value) && value === Math.round(value);
}
__name(isInteger, "isInteger");
var GAMMA_G = 4.7421875;
var GAMMA_P = [
  0.9999999999999971,
  57.15623566586292,
  -59.59796035547549,
  14.136097974741746,
  -0.4919138160976202,
  3399464998481189e-20,
  4652362892704858e-20,
  -9837447530487956e-20,
  1580887032249125e-19,
  -21026444172410488e-20,
  21743961811521265e-20,
  -1643181065367639e-19,
  8441822398385275e-20,
  -26190838401581408e-21,
  36899182659531625e-22
];
function gamma(n) {
  var t, x;
  if (isInteger(n)) {
    if (n <= 0) {
      return isFinite(n) ? Infinity : NaN;
    }
    if (n > 171) {
      return Infinity;
    }
    var value = n - 2;
    var res = n - 1;
    while (value > 1) {
      res *= value;
      value--;
    }
    if (res === 0) {
      res = 1;
    }
    return res;
  }
  if (n < 0.5) {
    return Math.PI / (Math.sin(Math.PI * n) * gamma(1 - n));
  }
  if (n >= 171.35) {
    return Infinity;
  }
  if (n > 85) {
    var twoN = n * n;
    var threeN = twoN * n;
    var fourN = threeN * n;
    var fiveN = fourN * n;
    return Math.sqrt(2 * Math.PI / n) * Math.pow(n / Math.E, n) * (1 + 1 / (12 * n) + 1 / (288 * twoN) - 139 / (51840 * threeN) - 571 / (2488320 * fourN) + 163879 / (209018880 * fiveN) + 5246819 / (75246796800 * fiveN * n));
  }
  --n;
  x = GAMMA_P[0];
  for (var i = 1; i < GAMMA_P.length; ++i) {
    x += GAMMA_P[i] / (n + i);
  }
  t = n + GAMMA_G + 0.5;
  return Math.sqrt(2 * Math.PI) * Math.pow(t, n + 0.5) * Math.exp(-t) * x;
}
__name(gamma, "gamma");
function stringOrArrayLength(s) {
  if (Array.isArray(s)) {
    return s.length;
  }
  return String(s).length;
}
__name(stringOrArrayLength, "stringOrArrayLength");
function hypot() {
  var sum = 0;
  var larg = 0;
  for (var i = 0; i < arguments.length; i++) {
    var arg = Math.abs(arguments[i]);
    var div2;
    if (larg < arg) {
      div2 = larg / arg;
      sum = sum * div2 * div2 + 1;
      larg = arg;
    } else if (arg > 0) {
      div2 = arg / larg;
      sum += div2 * div2;
    } else {
      sum += arg;
    }
  }
  return larg === Infinity ? Infinity : larg * Math.sqrt(sum);
}
__name(hypot, "hypot");
function condition(cond, yep, nope) {
  return cond ? yep : nope;
}
__name(condition, "condition");
function roundTo(value, exp) {
  if (typeof exp === "undefined" || +exp === 0) {
    return Math.round(value);
  }
  value = +value;
  exp = -+exp;
  if (isNaN(value) || !(typeof exp === "number" && exp % 1 === 0)) {
    return NaN;
  }
  value = value.toString().split("e");
  value = Math.round(+(value[0] + "e" + (value[1] ? +value[1] - exp : -exp)));
  value = value.toString().split("e");
  return +(value[0] + "e" + (value[1] ? +value[1] + exp : exp));
}
__name(roundTo, "roundTo");
function setVar(name, value, variables) {
  if (variables) variables[name] = value;
  return value;
}
__name(setVar, "setVar");
function arrayIndex(array, index) {
  return array[index | 0];
}
__name(arrayIndex, "arrayIndex");
function max(array) {
  if (arguments.length === 1 && Array.isArray(array)) {
    return Math.max.apply(Math, array);
  } else {
    return Math.max.apply(Math, arguments);
  }
}
__name(max, "max");
function min(array) {
  if (arguments.length === 1 && Array.isArray(array)) {
    return Math.min.apply(Math, array);
  } else {
    return Math.min.apply(Math, arguments);
  }
}
__name(min, "min");
function arrayMap(f, a) {
  if (typeof f !== "function") {
    throw new Error("First argument to map is not a function");
  }
  if (!Array.isArray(a)) {
    throw new Error("Second argument to map is not an array");
  }
  return a.map(function(x, i) {
    return f(x, i);
  });
}
__name(arrayMap, "arrayMap");
function arrayFold(f, init, a) {
  if (typeof f !== "function") {
    throw new Error("First argument to fold is not a function");
  }
  if (!Array.isArray(a)) {
    throw new Error("Second argument to fold is not an array");
  }
  return a.reduce(function(acc, x, i) {
    return f(acc, x, i);
  }, init);
}
__name(arrayFold, "arrayFold");
function arrayFilter(f, a) {
  if (typeof f !== "function") {
    throw new Error("First argument to filter is not a function");
  }
  if (!Array.isArray(a)) {
    throw new Error("Second argument to filter is not an array");
  }
  return a.filter(function(x, i) {
    return f(x, i);
  });
}
__name(arrayFilter, "arrayFilter");
function stringOrArrayIndexOf(target, s) {
  if (!(Array.isArray(s) || typeof s === "string")) {
    throw new Error("Second argument to indexOf is not a string or array");
  }
  return s.indexOf(target);
}
__name(stringOrArrayIndexOf, "stringOrArrayIndexOf");
function arrayJoin(sep, a) {
  if (!Array.isArray(a)) {
    throw new Error("Second argument to join is not an array");
  }
  return a.join(sep);
}
__name(arrayJoin, "arrayJoin");
function sign(x) {
  return (x > 0) - (x < 0) || +x;
}
__name(sign, "sign");
var ONE_THIRD = 1 / 3;
function cbrt(x) {
  return x < 0 ? -Math.pow(-x, ONE_THIRD) : Math.pow(x, ONE_THIRD);
}
__name(cbrt, "cbrt");
function expm1(x) {
  return Math.exp(x) - 1;
}
__name(expm1, "expm1");
function log1p(x) {
  return Math.log(1 + x);
}
__name(log1p, "log1p");
function log2(x) {
  return Math.log(x) / Math.LN2;
}
__name(log2, "log2");
function Parser(options) {
  this.options = options || {};
  this.unaryOps = {
    sin: Math.sin,
    cos: Math.cos,
    tan: Math.tan,
    asin: Math.asin,
    acos: Math.acos,
    atan: Math.atan,
    sinh: Math.sinh || sinh,
    cosh: Math.cosh || cosh,
    tanh: Math.tanh || tanh,
    asinh: Math.asinh || asinh,
    acosh: Math.acosh || acosh,
    atanh: Math.atanh || atanh,
    sqrt: Math.sqrt,
    cbrt: Math.cbrt || cbrt,
    log: Math.log,
    log2: Math.log2 || log2,
    ln: Math.log,
    lg: Math.log10 || log10,
    log10: Math.log10 || log10,
    expm1: Math.expm1 || expm1,
    log1p: Math.log1p || log1p,
    abs: Math.abs,
    ceil: Math.ceil,
    floor: Math.floor,
    round: Math.round,
    trunc: Math.trunc || trunc,
    "-": neg,
    "+": Number,
    exp: Math.exp,
    not,
    length: stringOrArrayLength,
    "!": factorial,
    sign: Math.sign || sign
  };
  this.binaryOps = {
    "+": add,
    "-": sub,
    "*": mul,
    "/": div,
    "%": mod,
    "^": Math.pow,
    "||": concat,
    "==": equal,
    "!=": notEqual,
    ">": greaterThan,
    "<": lessThan,
    ">=": greaterThanEqual,
    "<=": lessThanEqual,
    and: andOperator,
    or: orOperator,
    "in": inOperator,
    "=": setVar,
    "[": arrayIndex
  };
  this.ternaryOps = {
    "?": condition
  };
  this.functions = {
    random,
    fac: factorial,
    min,
    max,
    hypot: Math.hypot || hypot,
    pyt: Math.hypot || hypot,
    // backward compat
    pow: Math.pow,
    atan2: Math.atan2,
    "if": condition,
    gamma,
    roundTo,
    map: arrayMap,
    fold: arrayFold,
    filter: arrayFilter,
    indexOf: stringOrArrayIndexOf,
    join: arrayJoin
  };
  this.consts = {
    E: Math.E,
    PI: Math.PI,
    "true": true,
    "false": false
  };
}
__name(Parser, "Parser");
Parser.prototype.parse = function(expr) {
  var instr = [];
  var parserState = new ParserState(
    this,
    new TokenStream(this, expr),
    { allowMemberAccess: this.options.allowMemberAccess }
  );
  parserState.parseExpression(instr);
  parserState.expect(TEOF, "EOF");
  return new Expression(instr, this);
};
Parser.prototype.evaluate = function(expr, variables) {
  return this.parse(expr).evaluate(variables);
};
var sharedParser = new Parser();
Parser.parse = function(expr) {
  return sharedParser.parse(expr);
};
Parser.evaluate = function(expr, variables) {
  return sharedParser.parse(expr).evaluate(variables);
};
var optionNameMap = {
  "+": "add",
  "-": "subtract",
  "*": "multiply",
  "/": "divide",
  "%": "remainder",
  "^": "power",
  "!": "factorial",
  "<": "comparison",
  ">": "comparison",
  "<=": "comparison",
  ">=": "comparison",
  "==": "comparison",
  "!=": "comparison",
  "||": "concatenate",
  "and": "logical",
  "or": "logical",
  "not": "logical",
  "?": "conditional",
  ":": "conditional",
  "=": "assignment",
  "[": "array",
  "()=": "fndef"
};
function getOptionName(op) {
  return optionNameMap.hasOwnProperty(op) ? optionNameMap[op] : op;
}
__name(getOptionName, "getOptionName");
Parser.prototype.isOperatorEnabled = function(op) {
  var optionName = getOptionName(op);
  var operators = this.options.operators || {};
  return !(optionName in operators) || !!operators[optionName];
};

// src/utils.ts
function toBase64(bytes) {
  let binary = "";
  const chunkSize = 32768;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
  }
  return btoa(binary);
}
__name(toBase64, "toBase64");
function fromBase64(base64) {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}
__name(fromBase64, "fromBase64");
function toBase64Url(bytes) {
  return toBase64(bytes).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}
__name(toBase64Url, "toBase64Url");
function fromBase64Url(packed) {
  const normalized = packed.replace(/-/g, "+").replace(/_/g, "/");
  const pad = normalized.length % 4 === 0 ? "" : "=".repeat(4 - normalized.length % 4);
  return fromBase64(normalized + pad);
}
__name(fromBase64Url, "fromBase64Url");
async function toCompressedBase64UrlFromJson(value) {
  const json = JSON.stringify(value);
  const bytes = new TextEncoder().encode(json);
  const stream = new Blob([bytes]).stream().pipeThrough(new CompressionStream("gzip"));
  const compressed = new Uint8Array(await new Response(stream).arrayBuffer());
  return toBase64Url(compressed);
}
__name(toCompressedBase64UrlFromJson, "toCompressedBase64UrlFromJson");
async function parseCompressedBase64UrlJson(packed) {
  const bytes = fromBase64Url(packed);
  const buffer = new ArrayBuffer(bytes.byteLength);
  new Uint8Array(buffer).set(bytes);
  const stream = new Blob([buffer]).stream().pipeThrough(new DecompressionStream("gzip"));
  const json = await new Response(stream).text();
  return JSON.parse(json);
}
__name(parseCompressedBase64UrlJson, "parseCompressedBase64UrlJson");
function escapeXml(value) {
  return String(value).replace(/[&<>\"']/g, (ch) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  })[ch] || ch);
}
__name(escapeXml, "escapeXml");
function clamp(value, min2, max2) {
  return Math.min(max2, Math.max(min2, value));
}
__name(clamp, "clamp");
function parseNumber(value, fallback) {
  if (value === null || value === void 0 || value === "") return fallback;
  const num = Number(value);
  return Number.isFinite(num) ? num : fallback;
}
__name(parseNumber, "parseNumber");
function parseInteger(value, fallback) {
  if (value === null || value === void 0 || value === "") return fallback;
  const num = Number.parseInt(String(value), 10);
  return Number.isFinite(num) ? num : fallback;
}
__name(parseInteger, "parseInteger");
function limitText(value, fallback, maxLength) {
  const text = String(value ?? fallback).trim();
  return (text || fallback).slice(0, maxLength);
}
__name(limitText, "limitText");
function ensureArray(value) {
  return Array.isArray(value) ? value : [];
}
__name(ensureArray, "ensureArray");

// src/plot.ts
var parser = new Parser({
  allowMemberAccess: false,
  operators: {
    assignment: false,
    concatenate: false,
    conditional: false,
    logical: false,
    comparison: false,
    in: false,
    random: false,
    fndef: false
  }
});
function normalizePoints(rawPoints) {
  if (!Array.isArray(rawPoints) || rawPoints.length === 0) {
    throw new Error("series points must be a non-empty array");
  }
  return rawPoints.map((pair, index) => {
    let x;
    let y;
    if (Array.isArray(pair)) {
      if (pair.length < 2) {
        throw new Error(`series point at index ${index} is invalid`);
      }
      x = Number(pair[0]);
      y = Number(pair[1]);
    } else if (pair && typeof pair === "object") {
      x = Number(pair.x);
      y = Number(pair.y);
    } else {
      throw new Error(`series point at index ${index} is invalid`);
    }
    if (!Number.isFinite(x) || !Number.isFinite(y)) {
      throw new Error(`series point at index ${index} must contain finite numbers`);
    }
    return { x, y };
  });
}
__name(normalizePoints, "normalizePoints");
function safeLabel(value, fallback, maxLength = MAX_LABEL_LENGTH) {
  return limitText(value, fallback, maxLength);
}
__name(safeLabel, "safeLabel");
function safeTitle(value, fallback) {
  return limitText(value, fallback, MAX_TITLE_LENGTH);
}
__name(safeTitle, "safeTitle");
function normalizeAnnotations(rawAnnotations) {
  return ensureArray(rawAnnotations).slice(0, 24).map((item) => {
    const record = item && typeof item === "object" ? item : {};
    const kind = String(record.kind || record.type || "label");
    const color = safeLabel(record.color, "#7c3aed", 32);
    if (kind === "vertical_line") {
      return { kind, x: parseNumber(record.x, 0), label: safeLabel(record.label, ""), color };
    }
    if (kind === "point") {
      return { kind, x: parseNumber(record.x, 0), y: parseNumber(record.y, 0), label: safeLabel(record.label, ""), color };
    }
    if (kind === "area") {
      const xA = parseNumber(record.x_min, 0);
      const xB = parseNumber(record.x_max, 1);
      return {
        kind,
        x_min: Math.min(xA, xB),
        x_max: Math.max(xA, xB),
        label: safeLabel(record.label, ""),
        color,
        opacity: clamp(parseNumber(record.opacity, 0.18), 0.05, 0.5)
      };
    }
    return { kind: "label", x: parseNumber(record.x, 0), y: parseNumber(record.y, 0), text: safeLabel(record.text ?? record.label, ""), color };
  });
}
__name(normalizeAnnotations, "normalizeAnnotations");
function calculateBounds(series, annotations = []) {
  const all = series.flatMap((item) => item.points);
  const pointAnnotations = annotations.filter((item) => item.kind === "point" || item.kind === "label");
  const verticalAnnotations = annotations.filter((item) => item.kind === "vertical_line");
  const areaAnnotations = annotations.filter((item) => item.kind === "area");
  const xs = [
    ...all.map((item) => item.x),
    ...pointAnnotations.map((item) => item.x),
    ...verticalAnnotations.map((item) => item.x),
    ...areaAnnotations.flatMap((item) => [item.x_min, item.x_max])
  ];
  const ys = [...all.map((item) => item.y), ...pointAnnotations.map((item) => item.y)];
  let xMin = Math.min(...xs);
  let xMax = Math.max(...xs);
  let yMin = Math.min(...ys);
  let yMax = Math.max(...ys);
  if (xMin === xMax) {
    xMin -= 1;
    xMax += 1;
  }
  if (yMin === yMax) {
    yMin -= 1;
    yMax += 1;
  }
  const xPad = (xMax - xMin) * 0.05;
  const yPad = (yMax - yMin) * 0.1;
  return {
    xMin: xMin - xPad,
    xMax: xMax + xPad,
    yMin: yMin - yPad,
    yMax: yMax + yPad
  };
}
__name(calculateBounds, "calculateBounds");
function parseExpression(expr) {
  const normalizedExpr = String(expr).trim();
  if (!normalizedExpr) throw new Error("expr is required");
  if (normalizedExpr.length > MAX_EXPR_LENGTH) throw new Error(`expr is too long (max ${MAX_EXPR_LENGTH})`);
  try {
    return { normalizedExpr, parsed: parser.parse(normalizedExpr) };
  } catch (error) {
    const message = String(error?.message || error);
    throw new Error(`invalid expression syntax: ${message}`);
  }
}
__name(parseExpression, "parseExpression");
function buildFunctionPoints(parsed, normalizedExpr, points, xMin, xMax) {
  const safePoints = clamp(parseInteger(points, 1e3), MIN_POINTS, MAX_POINTS);
  const step = safePoints <= 1 ? 0 : (xMax - xMin) / (safePoints - 1);
  const result = [];
  for (let i = 0; i < safePoints; i += 1) {
    const x = safePoints <= 1 ? xMin : xMin + step * i;
    let y;
    try {
      y = Number(parsed.evaluate({ x }));
    } catch (error) {
      const message = String(error?.message || error);
      throw new Error(`failed to evaluate expression ${normalizedExpr} at x=${x}: ${message}`);
    }
    if (!Number.isFinite(y)) continue;
    result.push({ x, y });
  }
  return result;
}
__name(buildFunctionPoints, "buildFunctionPoints");
function makeFunctionSeries(expr, points, xMin, xMax, color, name) {
  const { normalizedExpr, parsed } = parseExpression(expr);
  const result = buildFunctionPoints(parsed, normalizedExpr, points, xMin, xMax);
  if (result.length === 0) {
    throw new Error(`expression ${normalizedExpr} produced no plottable points`);
  }
  return {
    name: safeLabel(name, normalizedExpr),
    type: "line",
    color,
    points: result
  };
}
__name(makeFunctionSeries, "makeFunctionSeries");
function normalizePiecewiseSegments(rawPieces, globalXMin, globalXMax) {
  const pieces = ensureArray(rawPieces).map((item, index) => {
    const record = item && typeof item === "object" ? item : {};
    const expr = String(record.expr || "").trim();
    const xA = parseNumber(record.x_min, globalXMin);
    const xB = parseNumber(record.x_max, globalXMax);
    return {
      expr,
      xMin: Math.min(xA, xB),
      xMax: Math.max(xA, xB),
      name: record.label === void 0 ? record.name === void 0 ? `Piece ${index + 1}` : String(record.name) : String(record.label),
      color: typeof record.color === "string" ? record.color : void 0
    };
  }).filter((piece) => piece.expr);
  if (pieces.length === 0) return [];
  if (pieces.length > MAX_SERIES) throw new Error(`too many piecewise segments (max ${MAX_SERIES})`);
  pieces.forEach((piece, index) => {
    if (!(piece.xMax > piece.xMin)) {
      throw new Error(`piece ${index + 1} must satisfy x_max > x_min`);
    }
  });
  return pieces;
}
__name(normalizePiecewiseSegments, "normalizePiecewiseSegments");
function buildPiecewiseSeries(rawPieces, points, globalXMin, globalXMax) {
  const pieces = normalizePiecewiseSegments(rawPieces, globalXMin, globalXMax);
  if (pieces.length === 0) {
    throw new Error("pieces is required when expr is empty");
  }
  const totalSpan = pieces.reduce((sum, piece) => sum + (piece.xMax - piece.xMin), 0);
  const safePoints = clamp(parseInteger(points, 1e3), MIN_POINTS, MAX_POINTS);
  const series = pieces.map((piece, index) => {
    const span = piece.xMax - piece.xMin;
    const share = totalSpan <= 0 ? 1 / pieces.length : span / totalSpan;
    const piecePoints = Math.max(2, Math.round(safePoints * share));
    return makeFunctionSeries(piece.expr, piecePoints, piece.xMin, piece.xMax, piece.color || DEFAULT_PALETTE[index % DEFAULT_PALETTE.length], piece.name || piece.expr);
  });
  if (series.every((item) => item.points.length === 0)) {
    throw new Error("piecewise function produced no plottable points");
  }
  return series;
}
__name(buildPiecewiseSeries, "buildPiecewiseSeries");
function buildSinglePlot(args) {
  const expr = String(args.expr || "").trim();
  const xMin = parseNumber(args.x_min, -10);
  const xMax = parseNumber(args.x_max, 10);
  if (!(xMax > xMin)) throw new Error("x_max must be greater than x_min");
  const annotations = normalizeAnnotations(args.annotations);
  const series = expr ? [makeFunctionSeries(expr, parseInteger(args.points, 1e3), xMin, xMax, DEFAULT_PALETTE[0], expr)] : buildPiecewiseSeries(args.pieces, parseInteger(args.points, 1e3), xMin, xMax);
  return {
    title: safeTitle(args.title, expr ? "Function Plot" : "Piecewise Function Plot"),
    xlabel: safeLabel(args.xlabel, "x"),
    ylabel: safeLabel(args.ylabel, "y"),
    grid: args.grid === void 0 ? true : Boolean(args.grid),
    series,
    annotations,
    ...calculateBounds(series, annotations)
  };
}
__name(buildSinglePlot, "buildSinglePlot");
function buildMultiPlot(args) {
  const exprs = ensureArray(args.exprs).map((item) => String(item).trim()).filter(Boolean);
  if (exprs.length === 0) throw new Error("exprs is required");
  if (exprs.length > MAX_SERIES) throw new Error(`too many expressions (max ${MAX_SERIES})`);
  const labels = ensureArray(args.labels).map((item) => safeLabel(item, ""));
  const xMin = parseNumber(args.x_min, -10);
  const xMax = parseNumber(args.x_max, 10);
  if (!(xMax > xMin)) throw new Error("x_max must be greater than x_min");
  const points = parseInteger(args.points, 1e3);
  const annotations = normalizeAnnotations(args.annotations);
  const series = exprs.map((expr, index) => makeFunctionSeries(expr, points, xMin, xMax, DEFAULT_PALETTE[index % DEFAULT_PALETTE.length], labels[index] || expr));
  return {
    title: safeTitle(args.title, "Multi Function Plot"),
    xlabel: safeLabel(args.xlabel, "x"),
    ylabel: safeLabel(args.ylabel, "y"),
    grid: args.grid === void 0 ? true : Boolean(args.grid),
    series,
    annotations,
    ...calculateBounds(series, annotations)
  };
}
__name(buildMultiPlot, "buildMultiPlot");
function buildSeriesPlot(args) {
  const input = ensureArray(args.series);
  if (input.length === 0) throw new Error("series is required");
  if (input.length > MAX_SERIES) throw new Error(`too many series (max ${MAX_SERIES})`);
  const annotations = normalizeAnnotations(args.annotations);
  const series = input.map((item, index) => {
    const record = item && typeof item === "object" ? item : {};
    const type = record.type === "scatter" || record.type === "line+scatter" ? record.type : "line";
    return {
      name: safeLabel(record.name, `Series ${index + 1}`),
      type,
      color: typeof record.color === "string" && record.color ? record.color : DEFAULT_PALETTE[index % DEFAULT_PALETTE.length],
      points: normalizePoints(Array.isArray(record.points) ? record.points : [])
    };
  });
  return {
    title: safeTitle(args.title, "Series Plot"),
    xlabel: safeLabel(args.xlabel, "x"),
    ylabel: safeLabel(args.ylabel, "y"),
    grid: args.grid === void 0 ? true : Boolean(args.grid),
    series,
    annotations,
    ...calculateBounds(series, annotations)
  };
}
__name(buildSeriesPlot, "buildSeriesPlot");
function buildBarChart(args) {
  const categories = ensureArray(args.categories).map((item) => safeLabel(item, "", 32));
  const values = ensureArray(args.values).map((item) => Number(item));
  if (categories.length === 0 || values.length !== categories.length) {
    throw new Error("categories and values are required with matching lengths");
  }
  if (categories.length > MAX_SERIES) {
    throw new Error(`too many categories (max ${MAX_SERIES})`);
  }
  if (values.some((value) => !Number.isFinite(value))) {
    throw new Error("values must all be finite numbers");
  }
  const points = values.map((value, index) => ({ x: index, y: value }));
  const series = [{
    name: safeLabel(args.series_name, "Bars"),
    type: "line+scatter",
    color: DEFAULT_PALETTE[0],
    points
  }];
  const bounds = calculateBounds(series);
  return {
    title: safeTitle(args.title, "Bar Chart"),
    xlabel: safeLabel(args.xlabel, "Category"),
    ylabel: safeLabel(args.ylabel, "Value"),
    grid: args.grid === void 0 ? true : Boolean(args.grid),
    series,
    categories,
    barMode: true,
    xMin: -0.5,
    xMax: categories.length - 0.5,
    yMin: Math.min(0, bounds.yMin),
    yMax: bounds.yMax
  };
}
__name(buildBarChart, "buildBarChart");

// src/mcp.ts
function corsHeaders(extra = {}) {
  return {
    "content-type": "application/json; charset=utf-8",
    "access-control-allow-origin": "*",
    "access-control-allow-methods": "GET, POST, OPTIONS",
    "access-control-allow-headers": "content-type, mcp-session-id",
    ...extra
  };
}
__name(corsHeaders, "corsHeaders");
function jsonRpc(id, result) {
  return Response.json({ jsonrpc: "2.0", id, result }, { headers: corsHeaders() });
}
__name(jsonRpc, "jsonRpc");
function jsonRpcError(id, code, message, data) {
  return Response.json({ jsonrpc: "2.0", id, error: { code, message, data } }, { status: 200, headers: corsHeaders() });
}
__name(jsonRpcError, "jsonRpcError");
function toolResultPayload(result) {
  return {
    content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
    structuredContent: result
  };
}
__name(toolResultPayload, "toolResultPayload");

// src/extras.ts
var DIAGRAM_COLORS = {
  primary: "#111827",
  secondary: "#475569",
  tertiary: "#94a3b8",
  faint: "#e2e8f0",
  ultraFaint: "#f1f5f9",
  paper: "#fbfdff"
};
var DIAGRAM_TYPE = {
  title: 20,
  body: 13,
  small: 11.5
};
var DIAGRAM_STROKES = {
  primary: 1.9,
  heavy: 2.3,
  helper: 0.8,
  faint: 0.7
};
var DIAGRAM_OPACITY = {
  helper: 0.22,
  frame: 0.95
};
var FORCE_LABEL_CHIP = {
  fill: "rgba(251,253,255,0.9)",
  stroke: "rgba(226,232,240,0.95)",
  shadow: "rgba(148,163,184,0.16)",
  sheen: "rgba(255,255,255,0.72)",
  paddingX: 7,
  paddingY: 4,
  radius: 8,
  leaderInset: 3
};
function makeSvgShell(width, height, title, body) {
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
  <style>text { font-family: ${DEFAULT_FONT_FAMILY}; }</style>
  <defs>
    <marker id="forceArrow" markerWidth="4.8" markerHeight="4.8" refX="4.2" refY="2" orient="auto" markerUnits="strokeWidth">
      <path d="M0,0 L0,4 L4.2,2 z" fill="#1f2937" />
    </marker>
    <marker id="resultantArrow" markerWidth="5.4" markerHeight="5.4" refX="4.8" refY="2.2" orient="auto" markerUnits="strokeWidth">
      <path d="M0,0 L0,4.4 L4.8,2.2 z" fill="#111827" />
    </marker>
    <marker id="circuitArrow" markerWidth="5" markerHeight="5" refX="4.4" refY="2.2" orient="auto" markerUnits="strokeWidth">
      <path d="M0,0 L0,4.4 L4.4,2.2 z" fill="#111827" />
    </marker>
  </defs>
  <rect width="100%" height="100%" fill="white"/>
  <text x="24" y="32" font-size="${DIAGRAM_TYPE.title}" font-weight="600" fill="${DIAGRAM_COLORS.primary}">${escapeXml(title)}</text>
  ${body}
</svg>`;
}
__name(makeSvgShell, "makeSvgShell");
function polarPoint(cx, cy, radius, angleDeg) {
  const angle = angleDeg * Math.PI / 180;
  return {
    x: cx + Math.cos(angle) * radius,
    y: cy - Math.sin(angle) * radius
  };
}
__name(polarPoint, "polarPoint");
function vectorLabelPosition(x, y, dx, dy, index, groupIndex = 0, groupSize = 1, radialPadding = 0, ringIndex = 0, ringCount = 1) {
  const length = Math.hypot(dx, dy) || 1;
  const nx = dx / length;
  const ny = dy / length;
  const spread = groupSize > 1 ? 18 : 12;
  const normalDirection = groupIndex - (groupSize - 1) / 2;
  const ringOffset = ringCount > 1 ? (ringIndex - (ringCount - 1) / 2) * 16 : 0;
  const lateralOffset = spread * normalDirection + ringOffset + (index % 2 === 0 ? 4 : -4);
  const alongOffset = radialPadding + (groupSize > 1 ? 20 : 14) + ringIndex * 10;
  return {
    x: x + dx + nx * alongOffset + -ny * lateralOffset,
    y: y - dy - ny * alongOffset + nx * lateralOffset
  };
}
__name(vectorLabelPosition, "vectorLabelPosition");
function vectorLabelAnchor(dx, dy) {
  if (Math.abs(dx) > Math.abs(dy) * 1.2) return dx >= 0 ? "start" : "end";
  return "middle";
}
__name(vectorLabelAnchor, "vectorLabelAnchor");
function linePoint(x1, y1, x2, y2, t) {
  return {
    x: x1 + (x2 - x1) * t,
    y: y1 + (y2 - y1) * t
  };
}
__name(linePoint, "linePoint");
function estimateTextWidth(text, fontSize, weight = 1) {
  const plain = String(text || "");
  return plain.length * fontSize * (0.56 + (weight - 1) * 0.03);
}
__name(estimateTextWidth, "estimateTextWidth");
function wrapDiagramText(text, maxWidth, fontSize, bullet = "") {
  const content = String(text || "").trim();
  if (!content) return bullet ? [bullet] : [];
  const lines = [];
  const continuation = bullet ? "  " : "";
  let current = bullet;
  const pushCurrent = /* @__PURE__ */ __name(() => {
    if (current.trim()) lines.push(current.trimEnd());
  }, "pushCurrent");
  Array.from(content).forEach((char) => {
    const next = `${current}${char}`;
    if (current.trim() && estimateTextWidth(next, fontSize) > maxWidth) {
      pushCurrent();
      current = `${continuation}${char.trimStart()}`;
      return;
    }
    current = next;
  });
  pushCurrent();
  return lines;
}
__name(wrapDiagramText, "wrapDiagramText");
function makeBounds(minX, minY, maxX, maxY) {
  return { minX, minY, maxX, maxY };
}
__name(makeBounds, "makeBounds");
function expandBounds(bounds, padding) {
  return makeBounds(bounds.minX - padding, bounds.minY - padding, bounds.maxX + padding, bounds.maxY + padding);
}
__name(expandBounds, "expandBounds");
function mergeBounds(base, next) {
  return makeBounds(
    Math.min(base.minX, next.minX),
    Math.min(base.minY, next.minY),
    Math.max(base.maxX, next.maxX),
    Math.max(base.maxY, next.maxY)
  );
}
__name(mergeBounds, "mergeBounds");
function normalizeVector(dx, dy) {
  const length = Math.hypot(dx, dy) || 1;
  return { x: dx / length, y: dy / length };
}
__name(normalizeVector, "normalizeVector");
function rotateIntoBodyLocal(dx, dy, angleDeg) {
  const angle = angleDeg * Math.PI / 180;
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  return {
    x: dx * cos + dy * sin,
    y: -dx * sin + dy * cos
  };
}
__name(rotateIntoBodyLocal, "rotateIntoBodyLocal");
function bodyContactDistance(body, direction) {
  const kind = String(body.kind || "block");
  const unit = normalizeVector(direction.x, direction.y);
  if (kind === "particle" || kind === "pulley") {
    return Number(body.radius || 22);
  }
  const width = Number(body.width || (kind === "support" ? 140 : kind === "hanging_mass" ? 62 : 72));
  const height = Number(body.height || (kind === "support" ? 10 : kind === "hanging_mass" ? 78 : 48));
  const angleDeg = kind === "block" ? Number(body.angle_deg || 0) : 0;
  const local = rotateIntoBodyLocal(unit.x, -unit.y, angleDeg);
  return Math.abs(local.x) * width / 2 + Math.abs(local.y) * height / 2;
}
__name(bodyContactDistance, "bodyContactDistance");
function surfaceFrame(surface, side = -1) {
  const x1 = Number(surface.x1 || 0);
  const y1 = Number(surface.y1 || 0);
  const x2 = Number(surface.x2 || 0);
  const y2 = Number(surface.y2 || 0);
  const tangent = normalizeVector(x2 - x1, y2 - y1);
  return {
    tangent,
    normal: normalizeVector(-tangent.y * side, tangent.x * side)
  };
}
__name(surfaceFrame, "surfaceFrame");
function placeBodyOnSurface(body, surface, t, side = -1, gap = 0) {
  const anchor = linePoint(
    Number(surface.x1 || 0),
    Number(surface.y1 || 0),
    Number(surface.x2 || 0),
    Number(surface.y2 || 0),
    Math.max(0, Math.min(1, t))
  );
  const frame = surfaceFrame(surface, side);
  const distance = bodyContactDistance(body, frame.normal) + gap;
  return {
    x: anchor.x + frame.normal.x * distance,
    y: anchor.y + frame.normal.y * distance,
    tangent: frame.tangent,
    normal: frame.normal,
    distance
  };
}
__name(placeBodyOnSurface, "placeBodyOnSurface");
function renderForceBody(body) {
  const kind = String(body.kind || "block");
  const x = Number(body.x || 320);
  const y = Number(body.y || 260);
  const width = Number(body.width || 72);
  const height = Number(body.height || 48);
  const radius = Number(body.radius || 22);
  const label = escapeXml(String(body.label || "m"));
  const angle = Number(body.angle_deg || 0);
  if (kind === "pulley") {
    return `<g>
      <line x1="${x}" y1="${y - radius - 22}" x2="${x}" y2="${y - radius}" stroke="#475569" stroke-width="1.8" />
      <rect x="${x - 24}" y="${y - radius - 30}" width="48" height="8" rx="3" fill="#e2e8f0" stroke="#94a3b8" stroke-width="0.9" />
      <circle cx="${x}" cy="${y}" r="${radius}" fill="#ffffff" stroke="#111827" stroke-width="2.1" />
      <circle cx="${x}" cy="${y}" r="4" fill="#111827" />
      <text x="${x}" y="${y + radius + 22}" text-anchor="middle" font-size="14" font-weight="600" fill="#111827">${label}</text>
    </g>`;
  }
  if (kind === "hanging_mass") {
    return `<g>
      <line x1="${x}" y1="${y - height / 2 - 24}" x2="${x}" y2="${y - height / 2}" stroke="#475569" stroke-width="1.8" />
      <rect x="${x - 30}" y="${y - height / 2 - 32}" width="60" height="8" rx="3" fill="#e2e8f0" stroke="#94a3b8" stroke-width="0.9" />
      <rect x="${x - width / 2}" y="${y - height / 2}" width="${width}" height="${height}" rx="7" fill="#fbfdff" stroke="#111827" stroke-width="1.9" />
      <text x="${x}" y="${y + 5}" text-anchor="middle" font-size="16" font-weight="600" fill="#111827">${label}</text>
    </g>`;
  }
  if (kind === "support") {
    return `<g>
      <rect x="${x - width / 2}" y="${y - 5}" width="${width}" height="10" rx="4" fill="#e2e8f0" stroke="#94a3b8" stroke-width="0.9" />
      <line x1="${x - width / 2 + 8}" y1="${y + 6}" x2="${x - width / 2 + 16}" y2="${y + 16}" stroke="#cbd5e1" stroke-width="1" />
      <line x1="${x}" y1="${y + 6}" x2="${x + 8}" y2="${y + 16}" stroke="#cbd5e1" stroke-width="1" />
      <line x1="${x + width / 2 - 16}" y1="${y + 6}" x2="${x + width / 2 - 8}" y2="${y + 16}" stroke="#cbd5e1" stroke-width="1" />
    </g>`;
  }
  if (kind === "particle") {
    return `<g>
      <circle cx="${x}" cy="${y}" r="${radius}" fill="#fbfdff" stroke="#111827" stroke-width="1.8" />
      <circle cx="${x}" cy="${y}" r="${Math.max(4, radius * 0.18)}" fill="#e2e8f0" stroke="#cbd5e1" stroke-width="0.8" />
      <text x="${x}" y="${y + 5}" text-anchor="middle" font-size="16" font-weight="600" fill="#111827">${label}</text>
    </g>`;
  }
  return `<g transform="translate(${x} ${y}) rotate(${-angle})">
    <rect x="${-width / 2}" y="${-height / 2}" width="${width}" height="${height}" rx="5" fill="#fbfdff" stroke="#111827" stroke-width="1.9" />
    <rect x="${-width / 2 + 7}" y="${-height / 2 + 7}" width="${Math.max(14, width - 14)}" height="${Math.max(14, height - 14)}" rx="4" fill="#ffffff" stroke="#e2e8f0" stroke-width="0.9" />
    <text x="0" y="5" text-anchor="middle" font-size="16" font-weight="600" fill="#111827" transform="rotate(${angle})">${label}</text>
  </g>`;
}
__name(renderForceBody, "renderForceBody");
function renderForceSurface(surface) {
  const kind = String(surface.kind || "ground");
  const x1 = Number(surface.x1 || 80);
  const y1 = Number(surface.y1 || 340);
  const x2 = Number(surface.x2 || 560);
  const y2 = Number(surface.y2 || 340);
  const label = escapeXml(String(surface.label || ""));
  const parts = [];
  if (kind === "ground" || kind === "incline") {
    parts.push(`<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${DIAGRAM_COLORS.secondary}" stroke-width="${DIAGRAM_STROKES.heavy}" stroke-linecap="round" />`);
    for (let i = 0; i < 9; i += 1) {
      const p = linePoint(x1, y1, x2, y2, i / 8);
      parts.push(`<line x1="${p.x}" y1="${p.y}" x2="${p.x - 8}" y2="${p.y + 10}" stroke="${DIAGRAM_COLORS.faint}" stroke-width="${DIAGRAM_STROKES.helper}" />`);
    }
  } else if (kind === "wall") {
    parts.push(`<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${DIAGRAM_COLORS.secondary}" stroke-width="${DIAGRAM_STROKES.heavy}" stroke-linecap="round" />`);
    for (let i = 0; i < 8; i += 1) {
      const p = linePoint(x1, y1, x2, y2, i / 7);
      parts.push(`<line x1="${p.x}" y1="${p.y}" x2="${p.x + 10}" y2="${p.y + 8}" stroke="${DIAGRAM_COLORS.faint}" stroke-width="${DIAGRAM_STROKES.helper}" />`);
    }
  } else if (kind === "ceiling") {
    parts.push(`<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${DIAGRAM_COLORS.secondary}" stroke-width="${DIAGRAM_STROKES.heavy}" stroke-linecap="round" />`);
    for (let i = 0; i < 8; i += 1) {
      const p = linePoint(x1, y1, x2, y2, i / 7);
      parts.push(`<line x1="${p.x}" y1="${p.y}" x2="${p.x - 8}" y2="${p.y - 8}" stroke="${DIAGRAM_COLORS.faint}" stroke-width="${DIAGRAM_STROKES.helper}" />`);
    }
  } else {
    parts.push(`<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${DIAGRAM_COLORS.secondary}" stroke-width="${DIAGRAM_STROKES.primary}" stroke-linecap="round" />`);
  }
  if (label) {
    parts.push(`<text x="${(x1 + x2) / 2}" y="${(y1 + y2) / 2 - 10}" text-anchor="middle" font-size="${DIAGRAM_TYPE.small}" font-weight="600" fill="${DIAGRAM_COLORS.secondary}">${label}</text>`);
  }
  return parts.join("\n");
}
__name(renderForceSurface, "renderForceSurface");
function renderForceConnector(connector) {
  const kind = String(connector.kind || "rope");
  const x1 = Number(connector.x1 || 0);
  const y1 = Number(connector.y1 || 0);
  const x2 = Number(connector.x2 || 0);
  const y2 = Number(connector.y2 || 0);
  const label = escapeXml(String(connector.label || ""));
  if (kind === "spring") {
    const turns = 7;
    const dx = (x2 - x1) / (turns * 2 + 2);
    const dy = (y2 - y1) / (turns * 2 + 2);
    let path = `M ${x1} ${y1} `;
    for (let i = 1; i <= turns * 2; i += 1) {
      const px = x1 + dx * i;
      const py = y1 + dy * i + (i % 2 === 0 ? -8 : 8);
      path += `L ${px} ${py} `;
    }
    path += `L ${x2} ${y2}`;
    return `<path d="${path}" fill="none" stroke="${DIAGRAM_COLORS.secondary}" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" />${label ? `<text x="${(x1 + x2) / 2}" y="${(y1 + y2) / 2 - 14}" text-anchor="middle" font-size="${DIAGRAM_TYPE.small}" font-weight="600" fill="${DIAGRAM_COLORS.secondary}">${label}</text>` : ""}`;
  }
  if (kind === "rope") {
    return `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${DIAGRAM_COLORS.secondary}" stroke-width="2.2" stroke-linecap="round" />${label ? `<text x="${(x1 + x2) / 2}" y="${(y1 + y2) / 2 - 10}" text-anchor="middle" font-size="${DIAGRAM_TYPE.small}" font-weight="600" fill="${DIAGRAM_COLORS.secondary}">${label}</text>` : ""}`;
  }
  return `<path d="M ${x1} ${y1} Q ${(x1 + x2) / 2} ${Math.min(y1, y2) - 22} ${x2} ${y2}" fill="none" stroke="${DIAGRAM_COLORS.secondary}" stroke-width="1.8" stroke-linecap="round" />${label ? `<text x="${(x1 + x2) / 2}" y="${Math.min(y1, y2) - 16}" text-anchor="middle" font-size="${DIAGRAM_TYPE.small}" font-weight="600" fill="${DIAGRAM_COLORS.secondary}">${label}</text>` : ""}`;
}
__name(renderForceConnector, "renderForceConnector");
function renderAngleAnnotation(cx, cy, startDeg, endDeg, radius, label, options = {}) {
  const start = polarPoint(cx, cy, radius, startDeg);
  const end = polarPoint(cx, cy, radius, endDeg);
  const delta = ((endDeg - startDeg) % 360 + 360) % 360;
  const effectiveDelta = delta > 180 ? 360 - delta : delta;
  const largeArc = delta > 180 ? 1 : 0;
  const sweep = delta <= 180 ? 0 : 1;
  const midDeg = startDeg + delta / 2;
  const labelPoint = polarPoint(cx, cy, radius + (effectiveDelta < 20 ? 20 : 14), midDeg);
  const stroke = escapeXml(options.stroke || DIAGRAM_COLORS.secondary);
  const textColor = escapeXml(options.textColor || stroke);
  const textSize = Math.max(10, Number(options.textSize || 12));
  const strokeOpacity = effectiveDelta < 20 ? 0.72 : 0.9;
  return `<path d="M ${start.x} ${start.y} A ${radius} ${radius} 0 ${largeArc} ${sweep} ${end.x} ${end.y}" fill="none" stroke="${stroke}" stroke-width="1.2" opacity="${strokeOpacity}" />
  <text x="${labelPoint.x}" y="${labelPoint.y}" text-anchor="middle" font-size="${textSize}" font-weight="600" fill="${textColor}">${escapeXml(label)}</text>`;
}
__name(renderAngleAnnotation, "renderAngleAnnotation");
function vectorLengthScale(magnitude, maxMagnitude) {
  const ratio = maxMagnitude <= 0 ? 1 : Math.max(0, Math.min(1, magnitude / maxMagnitude));
  return 54 + ratio * 46;
}
__name(vectorLengthScale, "vectorLengthScale");
function compactForceLabelText(text, maxWidth) {
  const plain = String(text || "").trim();
  if (!plain) return "";
  if (estimateTextWidth(plain, DIAGRAM_TYPE.body, 1.1) <= maxWidth) return plain;
  let compact = plain;
  while (compact.length > 1 && estimateTextWidth(`${compact}\u2026`, DIAGRAM_TYPE.body, 1.1) > maxWidth) {
    compact = compact.slice(0, -1).trimEnd();
  }
  return `${compact || plain[0]}\u2026`;
}
__name(compactForceLabelText, "compactForceLabelText");
function forceLabelMaxWidth(side) {
  if (side === "left") return 88;
  if (side === "right") return 96;
  return 84;
}
__name(forceLabelMaxWidth, "forceLabelMaxWidth");
function forceLabelChipPadding(item) {
  if (item.side === "left") return { left: 6, right: 9, top: 4, bottom: 4 };
  if (item.side === "right") return { left: 9, right: 6, top: 4, bottom: 4 };
  return { left: 7, right: 7, top: 4, bottom: 4 };
}
__name(forceLabelChipPadding, "forceLabelChipPadding");
function forceLabelChipRect(item) {
  const padding = forceLabelChipPadding(item);
  const textWidth = estimateTextWidth(item.labelText, DIAGRAM_TYPE.body, 1.1);
  const width = textWidth + padding.left + padding.right;
  const height = DIAGRAM_TYPE.body + padding.top + padding.bottom;
  const anchorX = item.labelAnchor === "start" ? item.labelX - padding.left : item.labelAnchor === "end" ? item.labelX - textWidth - padding.right : item.labelX - width / 2;
  const x = anchorX;
  const y = item.labelY - DIAGRAM_TYPE.body + 1 - padding.top;
  return { x, y, width, height };
}
__name(forceLabelChipRect, "forceLabelChipRect");
function forceLabelLeaderAnchor(item) {
  const rect = forceLabelChipRect(item);
  const centerY = rect.y + rect.height / 2;
  if (item.labelAnchor === "start") {
    return { x: rect.x - FORCE_LABEL_CHIP.leaderInset, y: centerY };
  }
  if (item.labelAnchor === "end") {
    return { x: rect.x + rect.width + FORCE_LABEL_CHIP.leaderInset, y: centerY };
  }
  const dx = item.endX - item.labelX;
  const dy = item.endY - item.labelY;
  if (item.side === "center") {
    const prefersTopExit = dy < 0;
    return {
      x: rect.x + rect.width / 2,
      y: prefersTopExit ? rect.y - FORCE_LABEL_CHIP.leaderInset : rect.y + rect.height + FORCE_LABEL_CHIP.leaderInset
    };
  }
  if (Math.abs(dx) >= Math.abs(dy)) {
    return {
      x: dx >= 0 ? rect.x + rect.width + FORCE_LABEL_CHIP.leaderInset : rect.x - FORCE_LABEL_CHIP.leaderInset,
      y: centerY
    };
  }
  return {
    x: rect.x + rect.width / 2,
    y: dy >= 0 ? rect.y + rect.height + FORCE_LABEL_CHIP.leaderInset : rect.y - FORCE_LABEL_CHIP.leaderInset
  };
}
__name(forceLabelLeaderAnchor, "forceLabelLeaderAnchor");
function renderForceLabelChip(item) {
  const rect = forceLabelChipRect(item);
  const innerWidth = Math.max(10, rect.width - 4);
  const innerHeight = Math.max(8, Math.min(rect.height - 7, rect.height * 0.42));
  const widthTightness = Math.max(0, Math.min(1, (rect.width - 54) / 46));
  const shadowOffsetX = (item.side === "left" ? -1.2 : item.side === "right" ? 1.8 : 0.8) + widthTightness * 0.5;
  const shadowOffsetY = (item.side === "center" ? 2.4 : 1.8) + widthTightness * 0.35;
  const sheenOffsetX = (item.side === "left" ? 1.2 : item.side === "right" ? 2.8 : 1.8) + widthTightness * 0.3;
  const sheenOffsetY = (item.side === "center" ? 1.1 : 1.5) + widthTightness * 0.15;
  const sheenInset = 2 + widthTightness * 1.4;
  const sheenWidth = Math.max(9, innerWidth - (item.side === "center" ? 6 : item.side === "left" ? 8 : 2) - widthTightness * 4);
  const sheenHeight = Math.max(7, innerHeight - (item.side === "center" ? 1 : 0) - widthTightness * 0.8);
  const sheenRadius = Math.max(4, FORCE_LABEL_CHIP.radius - 3 - widthTightness * 0.6);
  return [
    `<rect x="${rect.x + shadowOffsetX}" y="${rect.y + shadowOffsetY}" width="${rect.width}" height="${rect.height}" rx="${FORCE_LABEL_CHIP.radius}" fill="${FORCE_LABEL_CHIP.shadow}" opacity="0.9" />`,
    `<rect x="${rect.x}" y="${rect.y}" width="${rect.width}" height="${rect.height}" rx="${FORCE_LABEL_CHIP.radius}" fill="${FORCE_LABEL_CHIP.fill}" stroke="${FORCE_LABEL_CHIP.stroke}" stroke-width="0.9" />`,
    `<rect x="${rect.x + sheenOffsetX + sheenInset * 0.15}" y="${rect.y + sheenOffsetY}" width="${sheenWidth}" height="${sheenHeight}" rx="${sheenRadius}" fill="${FORCE_LABEL_CHIP.sheen}" opacity="0.85" />`
  ].join("");
}
__name(renderForceLabelChip, "renderForceLabelChip");
function renderForceLabelConnector(item, anchorX, anchorY) {
  const rect = forceLabelChipRect(item);
  const dx = anchorX - item.endX;
  const dy = anchorY - item.endY;
  const distance = Math.hypot(dx, dy);
  if (distance <= 10) return "";
  const widthTightness = Math.max(0, Math.min(1, (rect.width - 54) / 46));
  const boundCompression = Math.max(0, Math.min(1, Math.abs(item.columnBoundShift) / 24));
  const centerRhythm = item.side === "center" ? Math.min(1, item.connectorLane / 3) : 0;
  const step = Math.min(16 + widthTightness * 4 - boundCompression * 2.2 + centerRhythm * 1.6, Math.max(8, distance * (0.18 + widthTightness * 0.04 - boundCompression * 0.03 + centerRhythm * 0.02)));
  const laneOffset = item.side === "center" ? item.connectorLane * (4.5 + widthTightness * 1.2) : item.connectorLane * (7 + widthTightness * 2.5 - boundCompression * 1.8);
  const exitX = item.endX + (Math.abs(dx) >= Math.abs(dy) ? Math.sign(dx || 1) * step : 0);
  const exitY = item.endY + (Math.abs(dy) > Math.abs(dx) ? Math.sign(dy || 1) * step : 0);
  const midX = item.side === "center" ? anchorX + (item.connectorLane % 2 === 0 ? -1 : 1) * laneOffset : exitX + (item.side === "right" ? laneOffset : -laneOffset);
  const midY = item.side === "center" ? exitY + laneOffset * (0.55 + centerRhythm * 0.18) : anchorY - laneOffset * (0.35 - widthTightness * 0.08 + boundCompression * 0.05);
  const tailDx = anchorX - midX;
  const tailDy = anchorY - midY;
  const tailLength = Math.hypot(tailDx, tailDy) || 1;
  const connectorGap = Math.min(7 + widthTightness - boundCompression * 0.6, Math.max(3.5, tailLength * (0.18 - widthTightness * 0.04 + boundCompression * 0.02)));
  const endX = anchorX - tailDx / tailLength * connectorGap;
  const endY = anchorY - tailDy / tailLength * connectorGap;
  return `<polyline points="${item.endX},${item.endY} ${midX},${midY} ${endX},${endY}" fill="none" stroke="${item.color}" stroke-width="1" stroke-dasharray="3 3" stroke-linecap="round" stroke-linejoin="round" opacity="0.4" />`;
}
__name(renderForceLabelConnector, "renderForceLabelConnector");
function assignForceConnectorLanes(items) {
  const laneCountBySide = /* @__PURE__ */ new Map();
  return items.map((item) => {
    const lane = laneCountBySide.get(item.side) || 0;
    laneCountBySide.set(item.side, lane + 1);
    return { ...item, connectorLane: lane };
  });
}
__name(assignForceConnectorLanes, "assignForceConnectorLanes");
function coordinateForceLabelColumns(items) {
  const widthTargetBySide = /* @__PURE__ */ new Map();
  ["left", "right"].forEach((side) => {
    const sideItems = items.filter((item) => item.side === side);
    if (sideItems.length < 2) return;
    const widths = sideItems.map((item) => estimateTextWidth(item.labelText, DIAGRAM_TYPE.body, 1.1));
    const target = Math.min(Math.max(...widths), Math.max(...widths.slice().sort((a, b) => a - b).slice(0, Math.max(1, widths.length - 1))) + 10);
    widthTargetBySide.set(side, target);
  });
  return items.map((item) => {
    const target = widthTargetBySide.get(item.side);
    if (!target) return item;
    const compactLabel = compactForceLabelText(item.rawLabel, target);
    return { ...item, labelText: escapeXml(compactLabel) };
  });
}
__name(coordinateForceLabelColumns, "coordinateForceLabelColumns");
function adjustForceLabelPositions(items) {
  const minGap = 8;
  const adjustedBySide = /* @__PURE__ */ new Map();
  ["left", "center", "right"].forEach((side) => {
    const sorted = items.filter((item) => item.side === side).sort((a, b) => a.labelY - b.labelY);
    const adjusted = [];
    const columnLimit = side === "left" ? 214 : side === "right" ? 426 : null;
    sorted.forEach((item) => {
      const previous = adjusted[adjusted.length - 1];
      let nextY = item.labelY;
      let nextX = item.labelX;
      if (previous) {
        const previousRect = forceLabelChipRect(previous);
        let nextRect = forceLabelChipRect({ ...item, labelX: nextX, labelY: nextY });
        const horizontalOverlap = Math.min(previousRect.x + previousRect.width, nextRect.x + nextRect.width) - Math.max(previousRect.x, nextRect.x);
        const verticalOverlap = Math.min(previousRect.y + previousRect.height, nextRect.y + nextRect.height) - Math.max(previousRect.y, nextRect.y);
        const sideMinGap = side === "center" ? 12 : minGap;
        if (verticalOverlap > -sideMinGap && horizontalOverlap > 0) {
          nextY += verticalOverlap + sideMinGap;
          if (side === "center") {
            nextY += Math.min(8, 2 + adjusted.length * 0.8);
          } else {
            const horizontalBump = 12 + Math.min(22, nextRect.width * 0.12);
            nextX += side === "right" ? horizontalBump : -horizontalBump;
          }
          nextRect = forceLabelChipRect({ ...item, labelX: nextX, labelY: nextY });
          const secondHorizontalOverlap = Math.min(previousRect.x + previousRect.width, nextRect.x + nextRect.width) - Math.max(previousRect.x, nextRect.x);
          const secondVerticalOverlap = Math.min(previousRect.y + previousRect.height, nextRect.y + nextRect.height) - Math.max(previousRect.y, nextRect.y);
          if (secondHorizontalOverlap > 0 && secondVerticalOverlap > -sideMinGap) {
            nextY += secondVerticalOverlap + sideMinGap;
          }
        }
      }
      let boundShift = 0;
      if (columnLimit !== null) {
        const boundedRect = forceLabelChipRect({ ...item, labelX: nextX, labelY: nextY });
        if (side === "left") {
          const overflow = boundedRect.x - columnLimit;
          if (overflow > 0) {
            nextX -= overflow;
            boundShift = overflow;
          }
        } else {
          const overflow = columnLimit - (boundedRect.x + boundedRect.width);
          if (overflow > 0) {
            nextX += overflow;
            boundShift = overflow;
          }
        }
      }
      adjusted.push({ ...item, labelX: nextX, labelY: nextY, columnBoundShift: boundShift });
    });
    adjustedBySide.set(side, adjusted);
  });
  const indexBySignature = /* @__PURE__ */ new Map();
  adjustedBySide.forEach((group) => {
    group.forEach((item) => {
      indexBySignature.set(`${item.endX}:${item.endY}:${item.labelText}`, item);
    });
  });
  return items.map((item) => indexBySignature.get(`${item.endX}:${item.endY}:${item.labelText}`) || item);
}
__name(adjustForceLabelPositions, "adjustForceLabelPositions");
function forceReferenceAngle(angleDeg, inclineDeg) {
  const tangent = 180 - inclineDeg;
  const normal = 90 - inclineDeg;
  const normalize = /* @__PURE__ */ __name((value) => (value % 360 + 360) % 360, "normalize");
  const difference = /* @__PURE__ */ __name((a, b) => {
    const diff = normalize(a - b);
    return diff > 180 ? 360 - diff : diff;
  }, "difference");
  const tangentDiff = difference(angleDeg, tangent);
  const normalDiff = difference(angleDeg, normal);
  if (tangentDiff <= normalDiff) {
    return {
      startDeg: tangent,
      label: `${Math.round(difference(angleDeg, tangent))}\xB0`
    };
  }
  return {
    startDeg: normal,
    label: `${Math.round(difference(angleDeg, normal))}\xB0`
  };
}
__name(forceReferenceAngle, "forceReferenceAngle");
function buildAngleGroups(forces) {
  const groups = /* @__PURE__ */ new Map();
  forces.forEach((force, index) => {
    const angleDeg = Number(force.angle_deg || 0);
    const normalized = (angleDeg % 360 + 360) % 360;
    const key = Math.round(normalized / 12);
    const items = groups.get(key) || [];
    items.push(index);
    groups.set(key, items);
  });
  return groups;
}
__name(buildAngleGroups, "buildAngleGroups");
function renderBodyForces(body, showComponents, showAngleLabels, context = {}) {
  const x = Number(body.x || 320);
  const y = Number(body.y || 250);
  const forces = Array.isArray(body.forces) ? body.forces : [];
  const vectorLines = [];
  const helperLines = [];
  const annotationLines = [];
  let sumX = 0;
  let sumY = 0;
  const maxMagnitude = Math.max(...forces.map((force) => Math.max(0.5, Number(force.magnitude || 1))), 1);
  const componentOpacity = context.preferLocalAngles ? 0.08 : 0.12;
  const angleGroups = buildAngleGroups(forces);
  const groupOrder = /* @__PURE__ */ new Map();
  const metaByIndex = /* @__PURE__ */ new Map();
  const pendingLabels = [];
  const compactMode = Boolean(context.compactMode);
  const bodyCenter = compactMode ? { x, y } : null;
  const ringCount = compactMode ? Math.max(1, Math.ceil(forces.length / 2)) : 1;
  forces.forEach((force, index) => {
    const angleDeg = Number(force.angle_deg || 0);
    const angle = angleDeg * Math.PI / 180;
    const magnitude = Math.max(0.5, Number(force.magnitude || 1));
    const color = escapeXml(String(force.color || "#1d4ed8"));
    const rawLabel = String(force.label || "F");
    const normalized = (angleDeg % 360 + 360) % 360;
    const groupKey = Math.round(normalized / 12);
    const group = angleGroups.get(groupKey) || [index];
    const groupIndex = groupOrder.get(groupKey) || 0;
    groupOrder.set(groupKey, groupIndex + 1);
    const ringIndex = compactMode ? Math.floor(index / 2) : 0;
    const lateralBase = context.preferLocalAngles ? 16 : 12;
    const lateralShift = group.length > 1 ? (groupIndex - (group.length - 1) / 2) * lateralBase : 0;
    const unitX = Math.cos(angle);
    const unitY = Math.sin(angle);
    const normalX = -Math.sin(angle);
    const normalY = -Math.cos(angle);
    const contactRadius = compactMode ? bodyContactDistance(body, { x: unitX, y: unitY }) + 6 : 0;
    const startX = x + unitX * contactRadius + normalX * lateralShift;
    const startY = y - unitY * contactRadius + normalY * lateralShift;
    const length = vectorLengthScale(magnitude, maxMagnitude);
    const dx = Math.cos(angle) * length;
    const dy = Math.sin(angle) * length;
    const x2 = startX + dx;
    const y2 = startY - dy;
    const labelPos = vectorLabelPosition(
      startX,
      startY,
      dx,
      dy,
      index,
      groupIndex,
      group.length,
      contactRadius,
      ringIndex,
      ringCount
    );
    const labelAnchor = vectorLabelAnchor(dx, dy);
    const side = labelAnchor === "start" ? "right" : labelAnchor === "end" ? "left" : "center";
    const label = escapeXml(compactMode ? compactForceLabelText(rawLabel, forceLabelMaxWidth(side)) : rawLabel);
    sumX += dx;
    sumY += dy;
    const meta = { groupIndex, groupSize: group.length, startX, startY, dx, dy, rawLabel, labelX: labelPos.x, labelY: labelPos.y, labelText: label, labelAnchor, color, side, endX: x2, endY: y2, connectorLane: 0, columnBoundShift: 0 };
    metaByIndex.set(index, meta);
    pendingLabels.push(meta);
    if (bodyCenter) {
      vectorLines.push(`<line x1="${bodyCenter.x}" y1="${bodyCenter.y}" x2="${startX}" y2="${startY}" stroke="${color}" stroke-width="1.2" opacity="0.28" />`);
    }
    vectorLines.push(`<line x1="${startX}" y1="${startY}" x2="${x2}" y2="${y2}" stroke="${color}" stroke-width="2.1" marker-end="url(#forceArrow)" stroke-linecap="round" />`);
    if (showComponents && (group.length === 1 || groupIndex === 0)) {
      helperLines.push(`<line x1="${startX}" y1="${startY}" x2="${x2}" y2="${startY}" stroke="${color}" stroke-width="${DIAGRAM_STROKES.helper}" stroke-dasharray="4 4" opacity="${componentOpacity}" />`);
      helperLines.push(`<line x1="${x2}" y1="${startY}" x2="${x2}" y2="${y2}" stroke="${color}" stroke-width="${DIAGRAM_STROKES.helper}" stroke-dasharray="4 4" opacity="${componentOpacity}" />`);
    }
  });
  const placedLabels = compactMode ? assignForceConnectorLanes(adjustForceLabelPositions(coordinateForceLabelColumns(pendingLabels))) : pendingLabels;
  placedLabels.forEach((item) => {
    const chipAnchor = compactMode ? forceLabelLeaderAnchor(item) : null;
    const anchorX = chipAnchor ? chipAnchor.x : item.labelAnchor === "start" ? item.labelX - 4 : item.labelAnchor === "end" ? item.labelX + 4 : item.labelX;
    const anchorY = chipAnchor ? chipAnchor.y : item.labelY - 5;
    if (compactMode && (Math.abs(anchorX - item.endX) > 10 || Math.abs(anchorY - item.endY) > 10)) {
      vectorLines.push(renderForceLabelConnector(item, anchorX, anchorY));
    }
    if (compactMode) {
      vectorLines.push(renderForceLabelChip(item));
    }
    vectorLines.push(`<text x="${item.labelX}" y="${item.labelY}" text-anchor="${item.labelAnchor}" font-size="${DIAGRAM_TYPE.body}" font-weight="600" fill="${item.color}">${item.labelText}</text>`);
  });
  if (showAngleLabels) {
    const inclineDeg = Number(context.inclineDeg || 0);
    const preferLocalAngles = Boolean(context.preferLocalAngles);
    const meaningfulAngles = forces.map((force, index) => ({ force, index })).filter(({ force }) => {
      const label = String(force.label || "");
      if (!label) return false;
      if (!preferLocalAngles) return true;
      return /支持|摩擦|拉力|重力|弹力|推力/.test(label);
    }).filter(({ force }) => {
      if (!preferLocalAngles) return true;
      const angleDeg = Number(force.angle_deg || 0);
      const reference = forceReferenceAngle(angleDeg, inclineDeg);
      const delta = Math.abs(((angleDeg - reference.startDeg) % 360 + 540) % 360 - 180);
      return delta >= 12;
    }).slice(0, preferLocalAngles ? 1 : 2);
    meaningfulAngles.forEach(({ force, index }, annotationIndex) => {
      const angleDeg = Number(force.angle_deg || 0);
      const meta = metaByIndex.get(index);
      if (!meta || meta.groupSize > 1 && meta.groupIndex > 0) return;
      const angleOriginX = compactMode ? meta.startX : x;
      const angleOriginY = compactMode ? meta.startY : y;
      if (preferLocalAngles) {
        const reference = forceReferenceAngle(angleDeg, inclineDeg);
        annotationLines.push(renderAngleAnnotation(
          angleOriginX,
          angleOriginY,
          reference.startDeg,
          angleDeg,
          30 + annotationIndex * 12,
          reference.label,
          { stroke: String(force.color || DIAGRAM_COLORS.secondary), textColor: String(force.color || DIAGRAM_COLORS.secondary), textSize: 11 }
        ));
        return;
      }
      annotationLines.push(renderAngleAnnotation(
        angleOriginX,
        angleOriginY,
        0,
        angleDeg,
        28 + annotationIndex * 12,
        `${Math.round(angleDeg)}\xB0`,
        { stroke: String(force.color || DIAGRAM_COLORS.secondary), textColor: String(force.color || DIAGRAM_COLORS.secondary), textSize: 11 }
      ));
    });
  }
  return { vectorLines, helperLines, annotationLines, sumX, sumY, x, y };
}
__name(renderBodyForces, "renderBodyForces");
function renderForceDiagramSvg(payload) {
  const bodyLabel = escapeXml(String(payload.body_label || "m"));
  const forces = Array.isArray(payload.forces) ? payload.forces : [];
  const showComponents = payload.show_components !== false;
  const cx = 260;
  const cy = 220;
  const scale = 38;
  const lines = [];
  const componentLines = [];
  forces.forEach((force, index) => {
    const angle = Number(force.angle_deg || 0) * Math.PI / 180;
    const magnitude = Math.max(0.5, Number(force.magnitude || 1));
    const color = escapeXml(String(force.color || "#c2410c"));
    const dx = Math.cos(angle) * magnitude * scale;
    const dy = Math.sin(angle) * magnitude * scale;
    const x2 = cx + dx;
    const y2 = cy - dy;
    const labelPos = vectorLabelPosition(cx, cy, dx, dy, index);
    lines.push(`<line x1="${cx}" y1="${cy}" x2="${x2}" y2="${y2}" stroke="${color}" stroke-width="1.9" marker-end="url(#forceArrow)" stroke-linecap="round" />`);
    lines.push(`<text x="${labelPos.x}" y="${labelPos.y}" font-size="${DIAGRAM_TYPE.body}" font-weight="600" fill="${color}">${escapeXml(String(force.label || "F"))}</text>`);
    if (showComponents) {
      componentLines.push(`<line x1="${cx}" y1="${cy}" x2="${x2}" y2="${cy}" stroke="${color}" stroke-width="${DIAGRAM_STROKES.helper}" stroke-dasharray="4 4" opacity="${DIAGRAM_OPACITY.helper}" />`);
      componentLines.push(`<line x1="${x2}" y1="${cy}" x2="${x2}" y2="${y2}" stroke="${color}" stroke-width="${DIAGRAM_STROKES.helper}" stroke-dasharray="4 4" opacity="${DIAGRAM_OPACITY.helper}" />`);
    }
  });
  return makeSvgShell(520, 420, "Free-body / force diagram", `
  <line x1="40" y1="220" x2="480" y2="220" stroke="${DIAGRAM_COLORS.ultraFaint}" stroke-width="${DIAGRAM_STROKES.faint}" />
  <line x1="260" y1="40" x2="260" y2="380" stroke="${DIAGRAM_COLORS.ultraFaint}" stroke-width="${DIAGRAM_STROKES.faint}" />
  <circle cx="${cx}" cy="${cy}" r="20" fill="${DIAGRAM_COLORS.paper}" stroke="${DIAGRAM_COLORS.primary}" stroke-width="1.6" />
  <text x="${cx}" y="${cy + 5}" text-anchor="middle" font-size="17" font-weight="600" fill="${DIAGRAM_COLORS.primary}">${bodyLabel}</text>
  ${componentLines.join("\n")}
  ${lines.join("\n")}
  `);
}
__name(renderForceDiagramSvg, "renderForceDiagramSvg");
function renderForceAnalysisSvg(payload) {
  const title = String(payload.title || "Force analysis");
  const showComponents = payload.show_components !== false;
  const showAxes = payload.show_axes !== false;
  const showResultant = payload.show_resultant !== false;
  const showAngleLabels = Boolean(payload.show_angle_labels);
  const incline = Number(payload.incline_deg || 0);
  const preferLocalAngles = Math.abs(incline) > 0.01;
  const bodies = Array.isArray(payload.bodies) && payload.bodies.length > 0 ? payload.bodies : [{ x: 320, y: 250, label: String(payload.body_label || "m"), kind: "particle", forces: Array.isArray(payload.forces) ? payload.forces : [] }];
  const surfaces = Array.isArray(payload.surfaces) ? payload.surfaces : [];
  const connectors = Array.isArray(payload.connectors) ? payload.connectors : [];
  const totalForces = bodies.reduce((sum, body) => sum + (Array.isArray(body.forces) ? body.forces.length : 0), 0);
  const compactMode = totalForces >= 5 || preferLocalAngles && bodies.some((body) => Array.isArray(body.forces) && body.forces.length >= 4);
  const backgroundParts = [];
  const sceneParts = [];
  const helperLines = [];
  const annotationLines = [];
  const vectorLines = [];
  const width = 700;
  const height = 520;
  const axisX = 340;
  const axisY = 290;
  if (showAxes && !preferLocalAngles) {
    backgroundParts.push(`<line x1="80" y1="${axisY}" x2="620" y2="${axisY}" stroke="${DIAGRAM_COLORS.ultraFaint}" stroke-width="${DIAGRAM_STROKES.faint}" />`);
    backgroundParts.push(`<line x1="${axisX}" y1="80" x2="${axisX}" y2="470" stroke="${DIAGRAM_COLORS.ultraFaint}" stroke-width="${DIAGRAM_STROKES.faint}" />`);
    backgroundParts.push(`<text x="625" y="${axisY - 5}" font-size="${DIAGRAM_TYPE.small}" font-weight="600" fill="${DIAGRAM_COLORS.tertiary}">x</text>`);
    backgroundParts.push(`<text x="${axisX + 6}" y="75" font-size="${DIAGRAM_TYPE.small}" font-weight="600" fill="${DIAGRAM_COLORS.tertiary}">y</text>`);
  }
  if (Math.abs(incline) > 0.01 && surfaces.length === 0) {
    const inclineRad = incline * Math.PI / 180;
    const x1 = 180;
    const y1 = 380;
    const x2 = 500;
    const y2 = 380 - Math.tan(inclineRad) * 300;
    sceneParts.push(renderForceSurface({ kind: "incline", x1, y1, x2, y2, label: "" }));
    if (showAngleLabels) {
      annotationLines.push(renderAngleAnnotation(x1, y1, 0, incline, compactMode ? 26 : 32, `${Math.round(incline)}\xB0`, { stroke: DIAGRAM_COLORS.secondary, textColor: DIAGRAM_COLORS.secondary }));
    }
  }
  surfaces.forEach((surface) => {
    sceneParts.push(renderForceSurface(surface));
    if (showAngleLabels && preferLocalAngles && String(surface.kind || "") === "incline") {
      const x1 = Number(surface.x1 || 0);
      const y1 = Number(surface.y1 || 0);
      annotationLines.push(renderAngleAnnotation(x1, y1, 0, incline, compactMode ? 24 : 30, `${Math.round(incline)}\xB0`, { stroke: DIAGRAM_COLORS.secondary, textColor: DIAGRAM_COLORS.secondary, textSize: 11.5 }));
    }
  });
  connectors.forEach((connector) => {
    sceneParts.push(renderForceConnector(connector));
  });
  let resultantAnchor = null;
  for (const body of bodies) {
    sceneParts.push(renderForceBody(body));
    const rendered = renderBodyForces(body, showComponents, showAngleLabels, {
      inclineDeg: incline,
      preferLocalAngles,
      annotateIncline: preferLocalAngles,
      suppressGlobalAxes: preferLocalAngles,
      compactMode
    });
    helperLines.push(...rendered.helperLines);
    annotationLines.push(...rendered.annotationLines);
    vectorLines.push(...rendered.vectorLines);
    if (!resultantAnchor && Array.isArray(body.forces) && body.forces.length > 0) {
      resultantAnchor = rendered;
    }
  }
  if (showResultant && resultantAnchor && (Math.abs(resultantAnchor.sumX) > 1 || Math.abs(resultantAnchor.sumY) > 1)) {
    const rx = resultantAnchor.x + resultantAnchor.sumX;
    const ry = resultantAnchor.y - resultantAnchor.sumY;
    vectorLines.push(`<line x1="${resultantAnchor.x}" y1="${resultantAnchor.y}" x2="${rx}" y2="${ry}" stroke="${DIAGRAM_COLORS.primary}" stroke-width="2.3" marker-end="url(#resultantArrow)" stroke-linecap="round" />`);
    vectorLines.push(`<text x="${rx + 10}" y="${ry - 10}" font-size="14" font-weight="700" fill="${DIAGRAM_COLORS.primary}">R</text>`);
  }
  const warning = String(payload.warning || "").trim();
  const warningLines = compactMode && warning ? wrapDiagramText(`\u5DF2\u81EA\u52A8\u7B80\u5316\uFF1A${warning}`, width - 136, DIAGRAM_TYPE.small) : [];
  const warningPanel = warningLines.length > 0 ? `<rect x="24" y="452" width="652" height="${28 + warningLines.length * 16}" fill="#fff7ed" stroke="#fdba74" stroke-width="0.9" rx="5" />
      ${warningLines.map((line, index) => `<text x="38" y="${472 + index * 16}" font-size="${DIAGRAM_TYPE.small}" font-weight="${index === 0 ? 600 : 500}" fill="#9a3412">${escapeXml(line)}</text>`).join("\n")}` : "";
  return makeSvgShell(width, height, title, `
  ${backgroundParts.join("\n")}
  ${sceneParts.join("\n")}
  ${helperLines.join("\n")}
  ${annotationLines.join("\n")}
  ${vectorLines.join("\n")}
  ${warningPanel}
  `);
}
__name(renderForceAnalysisSvg, "renderForceAnalysisSvg");
function circuitComponentMetrics(type, orientation = "horizontal") {
  const vertical = orientation === "vertical";
  if (type === "battery") {
    return vertical ? { left: 24, right: 24, top: 34, bottom: 34, labelY: -44 } : { left: 34, right: 34, top: 24, bottom: 24, labelY: -34 };
  }
  if (type === "source" || type === "current_source" || type === "voltage_source") {
    return vertical ? { left: 20, right: 20, top: 36, bottom: 36, labelY: -44 } : { left: 36, right: 36, top: 20, bottom: 20, labelY: -34 };
  }
  if (type === "resistor") {
    return vertical ? { left: 14, right: 14, top: 36, bottom: 36, labelY: -42 } : { left: 36, right: 36, top: 14, bottom: 14, labelY: -30 };
  }
  if (type === "capacitor") {
    return vertical ? { left: 22, right: 22, top: 30, bottom: 30, labelY: -40 } : { left: 30, right: 30, top: 22, bottom: 22, labelY: -30 };
  }
  if (type === "inductor") {
    return vertical ? { left: 12, right: 12, top: 34, bottom: 34, labelY: -42 } : { left: 34, right: 34, top: 12, bottom: 12, labelY: -30 };
  }
  if (type === "switch") {
    return vertical ? { left: 14, right: 14, top: 36, bottom: 36, labelY: -42 } : { left: 36, right: 36, top: 14, bottom: 14, labelY: -30 };
  }
  if (type === "diode" || type === "led") {
    return vertical ? { left: 18, right: 18, top: 34, bottom: 34, labelY: -42 } : { left: 34, right: 34, top: 18, bottom: 18, labelY: -30 };
  }
  if (type === "ammeter" || type === "voltmeter" || type === "lamp" || type === "load" || type === "pulley") {
    return vertical ? { left: 18, right: 18, top: 36, bottom: 36, labelY: -44 } : { left: 36, right: 36, top: 18, bottom: 18, labelY: -32 };
  }
  if (type === "transistor") {
    return vertical ? { left: 24, right: 24, top: 36, bottom: 30, labelY: -44 } : { left: 36, right: 24, top: 24, bottom: 24, labelY: -34 };
  }
  if (type === "relay") {
    return vertical ? { left: 20, right: 20, top: 40, bottom: 36, labelY: -46 } : { left: 36, right: 40, top: 18, bottom: 20, labelY: -32 };
  }
  if (type === "buzzer") {
    return vertical ? { left: 18, right: 18, top: 36, bottom: 34, labelY: -44 } : { left: 36, right: 34, top: 18, bottom: 18, labelY: -32 };
  }
  if (type === "opamp") {
    return { left: 40, right: 38, top: 24, bottom: 24, labelY: -34 };
  }
  if (type === "ground") {
    return vertical ? { left: 12, right: 16, top: 16, bottom: 16, labelY: 34 } : { left: 16, right: 16, top: 16, bottom: 12, labelY: 32 };
  }
  return { left: 6, right: 6, top: 6, bottom: 6, labelY: -22 };
}
__name(circuitComponentMetrics, "circuitComponentMetrics");
function componentAnchor(component) {
  const type = String(component.type || "node");
  const orientation = String(component.orientation || "horizontal") === "vertical" ? "vertical" : "horizontal";
  const x = Number(component.x || 0);
  const y = Number(component.y || 0);
  const labelText = String(component.label || "");
  const label = escapeXml(labelText);
  const metrics = circuitComponentMetrics(type, orientation);
  return {
    id: String(component.id || ""),
    x,
    y,
    label,
    labelText,
    type,
    orientation,
    metrics,
    anchors: {
      left: { x: x - metrics.left, y },
      right: { x: x + metrics.right, y },
      top: { x, y: y - metrics.top },
      bottom: { x, y: y + metrics.bottom },
      base: orientation === "vertical" ? { x, y: y - metrics.top } : { x: x - metrics.left, y },
      collector: orientation === "vertical" ? { x: x - 10, y: y + metrics.bottom } : { x: x + 10, y: y - metrics.top },
      emitter: orientation === "vertical" ? { x: x + 10, y: y + metrics.bottom } : { x: x + 10, y: y + metrics.bottom },
      plus: orientation === "vertical" ? { x, y: y - metrics.top } : { x: x - metrics.left, y: y - 10 },
      minus: orientation === "vertical" ? { x, y: y + metrics.bottom } : { x: x - metrics.left, y: y + 10 },
      out: orientation === "vertical" ? { x, y: y + metrics.bottom } : { x: x + metrics.right, y }
    }
  };
}
__name(componentAnchor, "componentAnchor");
function circuitLabelPosition(type, x, y, label = "", orientation = "horizontal") {
  const metrics = circuitComponentMetrics(type, orientation);
  const labelWidth = estimateTextWidth(label, DIAGRAM_TYPE.body, 1.1);
  return {
    x,
    y: y + metrics.labelY,
    width: labelWidth,
    height: DIAGRAM_TYPE.body + 4
  };
}
__name(circuitLabelPosition, "circuitLabelPosition");
function circuitWireLabelPosition(x1, y1, x2, y2, label = "") {
  const midX = (x1 + x2) / 2;
  const midY = (y1 + y2) / 2;
  const horizontal = Math.abs(x2 - x1) >= Math.abs(y2 - y1);
  const x = horizontal ? midX : midX + 12;
  const y = horizontal ? midY - 10 : midY - 3;
  return {
    x,
    y,
    width: estimateTextWidth(label, DIAGRAM_TYPE.small, 1.05),
    height: DIAGRAM_TYPE.small + 4
  };
}
__name(circuitWireLabelPosition, "circuitWireLabelPosition");
function circuitComponentBounds(component) {
  const anchor = componentAnchor(component);
  let bounds = makeBounds(
    anchor.x - anchor.metrics.left,
    anchor.y - anchor.metrics.top,
    anchor.x + anchor.metrics.right,
    anchor.y + anchor.metrics.bottom
  );
  if (anchor.labelText) {
    const labelPos = circuitLabelPosition(anchor.type, anchor.x, anchor.y, anchor.labelText, anchor.orientation);
    bounds = mergeBounds(bounds, makeBounds(
      labelPos.x - labelPos.width / 2 - 6,
      labelPos.y - labelPos.height,
      labelPos.x + labelPos.width / 2 + 6,
      labelPos.y + 6
    ));
  }
  return expandBounds(bounds, 4);
}
__name(circuitComponentBounds, "circuitComponentBounds");
function circuitWireBounds(wire) {
  const x1 = Number(wire.x1 || 0);
  const y1 = Number(wire.y1 || 0);
  const x2 = Number(wire.x2 || 0);
  const y2 = Number(wire.y2 || 0);
  let bounds = makeBounds(Math.min(x1, x2), Math.min(y1, y2), Math.max(x1, x2), Math.max(y1, y2));
  const labelText = String(wire.label || "");
  if (labelText) {
    const labelPos = circuitWireLabelPosition(x1, y1, x2, y2, labelText);
    bounds = mergeBounds(bounds, makeBounds(
      labelPos.x - labelPos.width / 2 - 5,
      labelPos.y - labelPos.height,
      labelPos.x + labelPos.width / 2 + 5,
      labelPos.y + 5
    ));
  }
  return expandBounds(bounds, 3);
}
__name(circuitWireBounds, "circuitWireBounds");
function renderCircuitComponent(component) {
  const { x, y, label, labelText, type, orientation } = componentAnchor(component);
  const stroke = escapeXml(String(component.color || "#111827"));
  const vertical = orientation === "vertical";
  const parts = [];
  if (type === "battery") {
    if (vertical) {
      parts.push(`<line x1="${x - 12}" y1="${y - 24}" x2="${x + 12}" y2="${y - 24}" stroke="${stroke}" stroke-width="1.8" />`);
      parts.push(`<line x1="${x - 20}" y1="${y - 10}" x2="${x + 20}" y2="${y - 10}" stroke="${stroke}" stroke-width="2.6" />`);
      parts.push(`<line x1="${x - 12}" y1="${y + 10}" x2="${x + 12}" y2="${y + 10}" stroke="${stroke}" stroke-width="1.8" />`);
      parts.push(`<line x1="${x - 20}" y1="${y + 24}" x2="${x + 20}" y2="${y + 24}" stroke="${stroke}" stroke-width="2.6" />`);
      parts.push(`<line x1="${x}" y1="${y - 36}" x2="${x}" y2="${y - 24}" stroke="${stroke}" stroke-width="1.9" />`);
      parts.push(`<line x1="${x}" y1="${y + 24}" x2="${x}" y2="${y + 36}" stroke="${stroke}" stroke-width="1.9" />`);
    } else {
      parts.push(`<line x1="${x - 24}" y1="${y - 12}" x2="${x - 24}" y2="${y + 12}" stroke="${stroke}" stroke-width="1.8" />`);
      parts.push(`<line x1="${x - 10}" y1="${y - 20}" x2="${x - 10}" y2="${y + 20}" stroke="${stroke}" stroke-width="2.6" />`);
      parts.push(`<line x1="${x + 10}" y1="${y - 12}" x2="${x + 10}" y2="${y + 12}" stroke="${stroke}" stroke-width="1.8" />`);
      parts.push(`<line x1="${x + 24}" y1="${y - 20}" x2="${x + 24}" y2="${y + 20}" stroke="${stroke}" stroke-width="2.6" />`);
    }
  } else if (type === "source" || type === "current_source" || type === "voltage_source") {
    const sourceLabel = type === "current_source" ? "I" : "V";
    if (vertical) {
      parts.push(`<line x1="${x}" y1="${y - 36}" x2="${x}" y2="${y - 18}" stroke="${stroke}" stroke-width="1.9" />`);
      parts.push(`<circle cx="${x}" cy="${y}" r="18" fill="#ffffff" stroke="${stroke}" stroke-width="1.9" />`);
      if (type === "current_source") {
        parts.push(`<line x1="${x}" y1="${y + 8}" x2="${x}" y2="${y - 9}" stroke="${stroke}" stroke-width="1.6" marker-end="url(#circuitArrow)" />`);
      } else {
        parts.push(`<text x="${x}" y="${y - 4}" text-anchor="middle" font-size="11" font-weight="700" fill="${stroke}">+</text>`);
        parts.push(`<text x="${x}" y="${y + 13}" text-anchor="middle" font-size="13" font-weight="700" fill="${stroke}">\u2212</text>`);
      }
      parts.push(`<text x="${x + 26}" y="${y - 12}" text-anchor="middle" font-size="10.5" font-weight="700" fill="${DIAGRAM_COLORS.tertiary}">${sourceLabel}</text>`);
      parts.push(`<line x1="${x}" y1="${y + 18}" x2="${x}" y2="${y + 36}" stroke="${stroke}" stroke-width="1.9" />`);
    } else {
      parts.push(`<line x1="${x - 36}" y1="${y}" x2="${x - 18}" y2="${y}" stroke="${stroke}" stroke-width="1.9" />`);
      parts.push(`<circle cx="${x}" cy="${y}" r="18" fill="#ffffff" stroke="${stroke}" stroke-width="1.9" />`);
      if (type === "current_source") {
        parts.push(`<line x1="${x}" y1="${y + 9}" x2="${x}" y2="${y - 8}" stroke="${stroke}" stroke-width="1.6" marker-end="url(#circuitArrow)" />`);
      } else {
        parts.push(`<text x="${x}" y="${y - 4}" text-anchor="middle" font-size="11" font-weight="700" fill="${stroke}">+</text>`);
        parts.push(`<text x="${x}" y="${y + 13}" text-anchor="middle" font-size="13" font-weight="700" fill="${stroke}">\u2212</text>`);
      }
      parts.push(`<text x="${x + 24}" y="${y - 12}" text-anchor="middle" font-size="10.5" font-weight="700" fill="${DIAGRAM_COLORS.tertiary}">${sourceLabel}</text>`);
      parts.push(`<line x1="${x + 18}" y1="${y}" x2="${x + 36}" y2="${y}" stroke="${stroke}" stroke-width="1.9" />`);
    }
  } else if (type === "resistor") {
    if (vertical) {
      parts.push(`<line x1="${x}" y1="${y - 36}" x2="${x}" y2="${y - 22}" stroke="${stroke}" stroke-width="1.9" />`);
      parts.push(`<rect x="${x - 9}" y="${y - 22}" width="18" height="44" fill="#ffffff" stroke="${stroke}" stroke-width="1.9" />`);
      parts.push(`<line x1="${x}" y1="${y + 22}" x2="${x}" y2="${y + 36}" stroke="${stroke}" stroke-width="1.9" />`);
    } else {
      parts.push(`<line x1="${x - 36}" y1="${y}" x2="${x - 22}" y2="${y}" stroke="${stroke}" stroke-width="1.9" />`);
      parts.push(`<rect x="${x - 22}" y="${y - 9}" width="44" height="18" fill="#ffffff" stroke="${stroke}" stroke-width="1.9" />`);
      parts.push(`<line x1="${x + 22}" y1="${y}" x2="${x + 36}" y2="${y}" stroke="${stroke}" stroke-width="1.9" />`);
    }
  } else if (type === "capacitor") {
    if (vertical) {
      parts.push(`<line x1="${x}" y1="${y - 30}" x2="${x}" y2="${y - 8}" stroke="${stroke}" stroke-width="1.9" />`);
      parts.push(`<line x1="${x - 18}" y1="${y - 8}" x2="${x + 18}" y2="${y - 8}" stroke="${stroke}" stroke-width="2.1" />`);
      parts.push(`<line x1="${x - 18}" y1="${y + 8}" x2="${x + 18}" y2="${y + 8}" stroke="${stroke}" stroke-width="2.1" />`);
      parts.push(`<line x1="${x}" y1="${y + 8}" x2="${x}" y2="${y + 30}" stroke="${stroke}" stroke-width="1.9" />`);
    } else {
      parts.push(`<line x1="${x - 30}" y1="${y}" x2="${x - 8}" y2="${y}" stroke="${stroke}" stroke-width="1.9" />`);
      parts.push(`<line x1="${x - 8}" y1="${y - 18}" x2="${x - 8}" y2="${y + 18}" stroke="${stroke}" stroke-width="2.1" />`);
      parts.push(`<line x1="${x + 8}" y1="${y - 18}" x2="${x + 8}" y2="${y + 18}" stroke="${stroke}" stroke-width="2.1" />`);
      parts.push(`<line x1="${x + 8}" y1="${y}" x2="${x + 30}" y2="${y}" stroke="${stroke}" stroke-width="1.9" />`);
    }
  } else if (type === "inductor") {
    if (vertical) {
      parts.push(`<line x1="${x}" y1="${y - 34}" x2="${x}" y2="${y - 24}" stroke="${stroke}" stroke-width="1.9" />`);
      parts.push(`<path d="M ${x} ${y - 24} a 6 6 0 0 1 0 12 a 6 6 0 0 1 0 12 a 6 6 0 0 1 0 12 a 6 6 0 0 1 0 12" fill="none" stroke="${stroke}" stroke-width="1.9" />`);
      parts.push(`<line x1="${x}" y1="${y + 24}" x2="${x}" y2="${y + 34}" stroke="${stroke}" stroke-width="1.9" />`);
    } else {
      parts.push(`<line x1="${x - 34}" y1="${y}" x2="${x - 24}" y2="${y}" stroke="${stroke}" stroke-width="1.9" />`);
      parts.push(`<path d="M ${x - 24} ${y} a 6 6 0 0 1 12 0 a 6 6 0 0 1 12 0 a 6 6 0 0 1 12 0 a 6 6 0 0 1 12 0" fill="none" stroke="${stroke}" stroke-width="1.9" />`);
      parts.push(`<line x1="${x + 24}" y1="${y}" x2="${x + 34}" y2="${y}" stroke="${stroke}" stroke-width="1.9" />`);
    }
  } else if (type === "switch") {
    if (vertical) {
      parts.push(`<line x1="${x}" y1="${y - 36}" x2="${x}" y2="${y - 18}" stroke="${stroke}" stroke-width="1.9" />`);
      parts.push(`<circle cx="${x}" cy="${y - 18}" r="2.8" fill="${stroke}" />`);
      parts.push(`<circle cx="${x}" cy="${y + 18}" r="2.8" fill="${stroke}" />`);
      parts.push(`<line x1="${x}" y1="${y - 18}" x2="${x + 11}" y2="${y + 10}" stroke="${stroke}" stroke-width="1.9" stroke-linecap="round" />`);
      parts.push(`<line x1="${x}" y1="${y + 18}" x2="${x}" y2="${y + 36}" stroke="${stroke}" stroke-width="1.9" />`);
    } else {
      parts.push(`<line x1="${x - 36}" y1="${y}" x2="${x - 18}" y2="${y}" stroke="${stroke}" stroke-width="1.9" />`);
      parts.push(`<circle cx="${x - 18}" cy="${y}" r="2.8" fill="${stroke}" />`);
      parts.push(`<circle cx="${x + 18}" cy="${y}" r="2.8" fill="${stroke}" />`);
      parts.push(`<line x1="${x - 18}" y1="${y}" x2="${x + 10}" y2="${y - 11}" stroke="${stroke}" stroke-width="1.9" stroke-linecap="round" />`);
      parts.push(`<line x1="${x + 18}" y1="${y}" x2="${x + 36}" y2="${y}" stroke="${stroke}" stroke-width="1.9" />`);
    }
  } else if (type === "diode" || type === "led") {
    if (vertical) {
      parts.push(`<line x1="${x}" y1="${y - 34}" x2="${x}" y2="${y - 16}" stroke="${stroke}" stroke-width="1.9" />`);
      parts.push(`<polygon points="${x - 13},${y - 16} ${x + 13},${y - 16} ${x},${y + 6}" fill="#ffffff" stroke="${stroke}" stroke-width="1.9" />`);
      parts.push(`<line x1="${x - 17}" y1="${y + 10}" x2="${x + 17}" y2="${y + 10}" stroke="${stroke}" stroke-width="1.9" />`);
      parts.push(`<line x1="${x}" y1="${y + 10}" x2="${x}" y2="${y + 34}" stroke="${stroke}" stroke-width="1.9" />`);
      if (type === "led") {
        parts.push(`<line x1="${x + 14}" y1="${y - 14}" x2="${x + 26}" y2="${y - 26}" stroke="${stroke}" stroke-width="1.2" marker-end="url(#circuitArrow)" />`);
        parts.push(`<line x1="${x + 4}" y1="${y - 8}" x2="${x + 16}" y2="${y - 20}" stroke="${stroke}" stroke-width="1.2" marker-end="url(#circuitArrow)" />`);
      }
    } else {
      parts.push(`<line x1="${x - 34}" y1="${y}" x2="${x - 16}" y2="${y}" stroke="${stroke}" stroke-width="1.9" />`);
      parts.push(`<polygon points="${x - 16},${y - 13} ${x - 16},${y + 13} ${x + 6},${y}" fill="#ffffff" stroke="${stroke}" stroke-width="1.9" />`);
      parts.push(`<line x1="${x + 10}" y1="${y - 17}" x2="${x + 10}" y2="${y + 17}" stroke="${stroke}" stroke-width="1.9" />`);
      parts.push(`<line x1="${x + 10}" y1="${y}" x2="${x + 34}" y2="${y}" stroke="${stroke}" stroke-width="1.9" />`);
      if (type === "led") {
        parts.push(`<line x1="${x + 14}" y1="${y - 15}" x2="${x + 26}" y2="${y - 27}" stroke="${stroke}" stroke-width="1.2" marker-end="url(#circuitArrow)" />`);
        parts.push(`<line x1="${x + 8}" y1="${y - 5}" x2="${x + 20}" y2="${y - 17}" stroke="${stroke}" stroke-width="1.2" marker-end="url(#circuitArrow)" />`);
      }
    }
  } else if (type === "ammeter" || type === "voltmeter") {
    const meterLabel = type === "ammeter" ? "A" : "V";
    if (vertical) {
      parts.push(`<line x1="${x}" y1="${y - 36}" x2="${x}" y2="${y - 18}" stroke="${stroke}" stroke-width="1.9" />`);
      parts.push(`<circle cx="${x}" cy="${y}" r="18" fill="#ffffff" stroke="${stroke}" stroke-width="1.9" />`);
      parts.push(`<text x="${x}" y="${y + 5}" text-anchor="middle" font-size="14" font-weight="700" fill="${stroke}">${meterLabel}</text>`);
      parts.push(`<line x1="${x}" y1="${y + 18}" x2="${x}" y2="${y + 36}" stroke="${stroke}" stroke-width="1.9" />`);
    } else {
      parts.push(`<line x1="${x - 36}" y1="${y}" x2="${x - 18}" y2="${y}" stroke="${stroke}" stroke-width="1.9" />`);
      parts.push(`<circle cx="${x}" cy="${y}" r="18" fill="#ffffff" stroke="${stroke}" stroke-width="1.9" />`);
      parts.push(`<text x="${x}" y="${y + 5}" text-anchor="middle" font-size="14" font-weight="700" fill="${stroke}">${meterLabel}</text>`);
      parts.push(`<line x1="${x + 18}" y1="${y}" x2="${x + 36}" y2="${y}" stroke="${stroke}" stroke-width="1.9" />`);
    }
  } else if (type === "transistor") {
    if (vertical) {
      parts.push(`<circle cx="${x}" cy="${y}" r="16" fill="#ffffff" stroke="${stroke}" stroke-width="1.8" />`);
      parts.push(`<line x1="${x - 11}" y1="${y + 12}" x2="${x + 11}" y2="${y + 12}" stroke="${stroke}" stroke-width="1.8" />`);
      parts.push(`<line x1="${x}" y1="${y - 16}" x2="${x}" y2="${y - 36}" stroke="${stroke}" stroke-width="1.8" />`);
      parts.push(`<line x1="${x - 6}" y1="${y + 2}" x2="${x - 22}" y2="${y + 24}" stroke="${stroke}" stroke-width="1.8" />`);
      parts.push(`<line x1="${x + 6}" y1="${y + 2}" x2="${x + 22}" y2="${y + 24}" stroke="${stroke}" stroke-width="1.8" />`);
      parts.push(`<line x1="${x + 10}" y1="${y + 12}" x2="${x + 22}" y2="${y + 24}" stroke="${stroke}" stroke-width="1.3" marker-end="url(#circuitArrow)" />`);
    } else {
      parts.push(`<circle cx="${x}" cy="${y}" r="16" fill="#ffffff" stroke="${stroke}" stroke-width="1.8" />`);
      parts.push(`<line x1="${x - 12}" y1="${y - 11}" x2="${x - 12}" y2="${y + 11}" stroke="${stroke}" stroke-width="1.8" />`);
      parts.push(`<line x1="${x - 12}" y1="${y}" x2="${x - 36}" y2="${y}" stroke="${stroke}" stroke-width="1.8" />`);
      parts.push(`<line x1="${x - 2}" y1="${y - 6}" x2="${x + 22}" y2="${y - 24}" stroke="${stroke}" stroke-width="1.8" />`);
      parts.push(`<line x1="${x - 2}" y1="${y + 6}" x2="${x + 22}" y2="${y + 24}" stroke="${stroke}" stroke-width="1.8" />`);
      parts.push(`<line x1="${x + 10}" y1="${y + 13}" x2="${x + 22}" y2="${y + 24}" stroke="${stroke}" stroke-width="1.3" marker-end="url(#circuitArrow)" />`);
    }
  } else if (type === "relay") {
    if (vertical) {
      parts.push(`<line x1="${x}" y1="${y - 40}" x2="${x}" y2="${y - 20}" stroke="${stroke}" stroke-width="1.9" />`);
      parts.push(`<rect x="${x - 13}" y="${y - 20}" width="26" height="28" fill="#ffffff" stroke="${stroke}" stroke-width="1.8" />`);
      parts.push(`<path d="M ${x - 6} ${y - 14} q 11 4 0 8 q 11 4 0 8" fill="none" stroke="${stroke}" stroke-width="1.5" />`);
      parts.push(`<line x1="${x - 10}" y1="${y + 14}" x2="${x - 20}" y2="${y + 30}" stroke="${stroke}" stroke-width="1.8" />`);
      parts.push(`<circle cx="${x + 8}" cy="${y + 34}" r="2.8" fill="${stroke}" />`);
      parts.push(`<line x1="${x}" y1="${y + 8}" x2="${x}" y2="${y + 36}" stroke="${stroke}" stroke-width="1.9" />`);
    } else {
      parts.push(`<line x1="${x - 36}" y1="${y}" x2="${x - 18}" y2="${y}" stroke="${stroke}" stroke-width="1.9" />`);
      parts.push(`<rect x="${x - 18}" y="${y - 13}" width="28" height="26" fill="#ffffff" stroke="${stroke}" stroke-width="1.8" />`);
      parts.push(`<path d="M ${x - 12} ${y + 6} q 4 -11 8 0 q 4 -11 8 0" fill="none" stroke="${stroke}" stroke-width="1.5" />`);
      parts.push(`<line x1="${x + 16}" y1="${y - 10}" x2="${x + 34}" y2="${y - 18}" stroke="${stroke}" stroke-width="1.8" />`);
      parts.push(`<circle cx="${x + 38}" cy="${y + 8}" r="2.8" fill="${stroke}" />`);
    }
  } else if (type === "buzzer") {
    if (vertical) {
      parts.push(`<line x1="${x}" y1="${y - 36}" x2="${x}" y2="${y - 18}" stroke="${stroke}" stroke-width="1.9" />`);
      parts.push(`<path d="M ${x - 11} ${y - 18} L ${x + 11} ${y - 18} L ${x + 8} ${y} L ${x - 8} ${y} Z" fill="#ffffff" stroke="${stroke}" stroke-width="1.8" />`);
      parts.push(`<path d="M ${x - 9} ${y + 8} q 9 10 18 0" fill="none" stroke="${stroke}" stroke-width="1.4" />`);
      parts.push(`<path d="M ${x - 13} ${y + 14} q 13 15 26 0" fill="none" stroke="${stroke}" stroke-width="1.2" />`);
      parts.push(`<line x1="${x}" y1="${y}" x2="${x}" y2="${y + 34}" stroke="${stroke}" stroke-width="1.9" />`);
    } else {
      parts.push(`<line x1="${x - 36}" y1="${y}" x2="${x - 18}" y2="${y}" stroke="${stroke}" stroke-width="1.9" />`);
      parts.push(`<path d="M ${x - 18} ${y - 11} L ${x - 18} ${y + 11} L ${x} ${y + 8} L ${x} ${y - 8} Z" fill="#ffffff" stroke="${stroke}" stroke-width="1.8" />`);
      parts.push(`<path d="M ${x + 8} ${y - 9} q 10 9 0 18" fill="none" stroke="${stroke}" stroke-width="1.4" />`);
      parts.push(`<path d="M ${x + 14} ${y - 13} q 15 13 0 26" fill="none" stroke="${stroke}" stroke-width="1.2" />`);
    }
  } else if (type === "opamp") {
    if (vertical) {
      parts.push(`<polygon points="${x - 24},${y - 26} ${x + 24},${y - 26} ${x},${y + 24}" fill="#ffffff" stroke="${stroke}" stroke-width="1.9" />`);
      parts.push(`<text x="${x - 8}" y="${y - 12}" text-anchor="middle" font-size="11" font-weight="700" fill="${stroke}">+</text>`);
      parts.push(`<text x="${x + 8}" y="${y - 12}" text-anchor="middle" font-size="11" font-weight="700" fill="${stroke}">\u2212</text>`);
      parts.push(`<line x1="${x - 10}" y1="${y - 40}" x2="${x - 10}" y2="${y - 26}" stroke="${stroke}" stroke-width="1.8" />`);
      parts.push(`<line x1="${x + 10}" y1="${y - 40}" x2="${x + 10}" y2="${y - 26}" stroke="${stroke}" stroke-width="1.8" />`);
      parts.push(`<line x1="${x}" y1="${y + 24}" x2="${x}" y2="${y + 38}" stroke="${stroke}" stroke-width="1.8" />`);
    } else {
      parts.push(`<polygon points="${x - 26},${y - 24} ${x - 26},${y + 24} ${x + 24},${y}" fill="#ffffff" stroke="${stroke}" stroke-width="1.9" />`);
      parts.push(`<text x="${x - 14}" y="${y - 6}" text-anchor="middle" font-size="11" font-weight="700" fill="${stroke}">+</text>`);
      parts.push(`<text x="${x - 14}" y="${y + 13}" text-anchor="middle" font-size="11" font-weight="700" fill="${stroke}">\u2212</text>`);
      parts.push(`<line x1="${x - 40}" y1="${y - 10}" x2="${x - 26}" y2="${y - 10}" stroke="${stroke}" stroke-width="1.8" />`);
      parts.push(`<line x1="${x - 40}" y1="${y + 10}" x2="${x - 26}" y2="${y + 10}" stroke="${stroke}" stroke-width="1.8" />`);
      parts.push(`<line x1="${x + 24}" y1="${y}" x2="${x + 38}" y2="${y}" stroke="${stroke}" stroke-width="1.8" />`);
    }
  } else if (type === "pulley") {
    parts.push(`<circle cx="${x}" cy="${y}" r="18" fill="#ffffff" stroke="${stroke}" stroke-width="1.9" />`);
    parts.push(`<circle cx="${x}" cy="${y}" r="4" fill="${stroke}" />`);
  } else if (type === "lamp" || type === "load") {
    if (vertical) {
      parts.push(`<line x1="${x}" y1="${y - 36}" x2="${x}" y2="${y - 18}" stroke="${stroke}" stroke-width="1.9" />`);
      parts.push(`<circle cx="${x}" cy="${y}" r="18" fill="#ffffff" stroke="${stroke}" stroke-width="1.9" />`);
      parts.push(`<line x1="${x - 10}" y1="${y - 10}" x2="${x + 10}" y2="${y + 10}" stroke="${stroke}" stroke-width="1.7" />`);
      parts.push(`<line x1="${x - 10}" y1="${y + 10}" x2="${x + 10}" y2="${y - 10}" stroke="${stroke}" stroke-width="1.7" />`);
      parts.push(`<line x1="${x}" y1="${y + 18}" x2="${x}" y2="${y + 36}" stroke="${stroke}" stroke-width="1.9" />`);
    } else {
      parts.push(`<line x1="${x - 36}" y1="${y}" x2="${x - 18}" y2="${y}" stroke="${stroke}" stroke-width="1.9" />`);
      parts.push(`<circle cx="${x}" cy="${y}" r="18" fill="#ffffff" stroke="${stroke}" stroke-width="1.9" />`);
      parts.push(`<line x1="${x - 10}" y1="${y - 10}" x2="${x + 10}" y2="${y + 10}" stroke="${stroke}" stroke-width="1.7" />`);
      parts.push(`<line x1="${x - 10}" y1="${y + 10}" x2="${x + 10}" y2="${y - 10}" stroke="${stroke}" stroke-width="1.7" />`);
      parts.push(`<line x1="${x + 18}" y1="${y}" x2="${x + 36}" y2="${y}" stroke="${stroke}" stroke-width="1.9" />`);
    }
  } else if (type === "ground") {
    if (vertical) {
      parts.push(`<line x1="${x - 14}" y1="${y}" x2="${x - 2}" y2="${y}" stroke="${stroke}" stroke-width="1.8" />`);
      parts.push(`<line x1="${x}" y1="${y - 14}" x2="${x}" y2="${y + 14}" stroke="${stroke}" stroke-width="1.8" />`);
      parts.push(`<line x1="${x + 5}" y1="${y - 9}" x2="${x + 5}" y2="${y + 9}" stroke="${stroke}" stroke-width="1.8" />`);
      parts.push(`<line x1="${x + 10}" y1="${y - 4}" x2="${x + 10}" y2="${y + 4}" stroke="${stroke}" stroke-width="1.8" />`);
    } else {
      parts.push(`<line x1="${x}" y1="${y - 14}" x2="${x}" y2="${y - 2}" stroke="${stroke}" stroke-width="1.8" />`);
      parts.push(`<line x1="${x - 14}" y1="${y}" x2="${x + 14}" y2="${y}" stroke="${stroke}" stroke-width="1.8" />`);
      parts.push(`<line x1="${x - 9}" y1="${y + 5}" x2="${x + 9}" y2="${y + 5}" stroke="${stroke}" stroke-width="1.8" />`);
      parts.push(`<line x1="${x - 4}" y1="${y + 10}" x2="${x + 4}" y2="${y + 10}" stroke="${stroke}" stroke-width="1.8" />`);
    }
  } else {
    parts.push(`<circle cx="${x}" cy="${y}" r="4.5" fill="${stroke}" />`);
  }
  if (label) {
    const labelPos = circuitLabelPosition(type, x, y, labelText, orientation);
    parts.push(`<text x="${labelPos.x}" y="${labelPos.y}" text-anchor="middle" font-size="${DIAGRAM_TYPE.body}" font-weight="600" fill="${DIAGRAM_COLORS.secondary}">${label}</text>`);
  }
  return parts.join("\n");
}
__name(renderCircuitComponent, "renderCircuitComponent");
function renderVennDiagramSvg(payload) {
  const title = String(payload.title || "Venn diagram");
  const sets = Array.isArray(payload.sets) ? payload.sets : [];
  const labels = sets.length > 0 ? sets.slice(0, 3).map((set, index) => escapeXml(String(set.label || String.fromCharCode(65 + index)))) : ["A", "B", "C"];
  const colors = sets.length > 0 ? sets.slice(0, 3).map((set, index) => escapeXml(String(set.color || DEFAULT_PALETTE[index % DEFAULT_PALETTE.length]))) : [DEFAULT_PALETTE[0], DEFAULT_PALETTE[1], DEFAULT_PALETTE[2]];
  const regions = payload.regions && typeof payload.regions === "object" ? payload.regions : {};
  const mode = labels.length >= 3 ? 3 : 2;
  const width = 720;
  const height = 460;
  const regionText = /* @__PURE__ */ __name((key, fallback = "") => escapeXml(String(regions[key] ?? fallback)), "regionText");
  if (mode === 2) {
    return makeSvgShell(width, height, title, `
    <g opacity="0.55">
      <circle cx="300" cy="245" r="118" fill="${colors[0]}" />
      <circle cx="420" cy="245" r="118" fill="${colors[1]}" />
    </g>
    <circle cx="300" cy="245" r="118" fill="none" stroke="${colors[0]}" stroke-width="2" />
    <circle cx="420" cy="245" r="118" fill="none" stroke="${colors[1]}" stroke-width="2" />
    <text x="242" y="140" text-anchor="middle" font-size="18" font-weight="700" fill="${DIAGRAM_COLORS.primary}">${labels[0]}</text>
    <text x="478" y="140" text-anchor="middle" font-size="18" font-weight="700" fill="${DIAGRAM_COLORS.primary}">${labels[1]}</text>
    <text x="255" y="250" text-anchor="middle" font-size="20" font-weight="600" fill="${DIAGRAM_COLORS.primary}">${regionText("A_only")}</text>
    <text x="360" y="250" text-anchor="middle" font-size="20" font-weight="700" fill="${DIAGRAM_COLORS.primary}">${regionText("A_B")}</text>
    <text x="465" y="250" text-anchor="middle" font-size="20" font-weight="600" fill="${DIAGRAM_COLORS.primary}">${regionText("B_only")}</text>
    <text x="108" y="248" text-anchor="middle" font-size="18" fill="${DIAGRAM_COLORS.secondary}">${regionText("outside")}</text>
    `);
  }
  return makeSvgShell(width, height, title, `
  <g opacity="0.5">
    <circle cx="300" cy="228" r="108" fill="${colors[0]}" />
    <circle cx="420" cy="228" r="108" fill="${colors[1]}" />
    <circle cx="360" cy="324" r="108" fill="${colors[2]}" />
  </g>
  <circle cx="300" cy="228" r="108" fill="none" stroke="${colors[0]}" stroke-width="2" />
  <circle cx="420" cy="228" r="108" fill="none" stroke="${colors[1]}" stroke-width="2" />
  <circle cx="360" cy="324" r="108" fill="none" stroke="${colors[2]}" stroke-width="2" />
  <text x="236" y="118" text-anchor="middle" font-size="18" font-weight="700" fill="${DIAGRAM_COLORS.primary}">${labels[0]}</text>
  <text x="484" y="118" text-anchor="middle" font-size="18" font-weight="700" fill="${DIAGRAM_COLORS.primary}">${labels[1]}</text>
  <text x="360" y="452" text-anchor="middle" font-size="18" font-weight="700" fill="${DIAGRAM_COLORS.primary}">${labels[2]}</text>
  <text x="250" y="225" text-anchor="middle" font-size="18" font-weight="600" fill="${DIAGRAM_COLORS.primary}">${regionText("A_only")}</text>
  <text x="470" y="225" text-anchor="middle" font-size="18" font-weight="600" fill="${DIAGRAM_COLORS.primary}">${regionText("B_only")}</text>
  <text x="360" y="378" text-anchor="middle" font-size="18" font-weight="600" fill="${DIAGRAM_COLORS.primary}">${regionText("C_only")}</text>
  <text x="360" y="212" text-anchor="middle" font-size="18" font-weight="700" fill="${DIAGRAM_COLORS.primary}">${regionText("A_B")}</text>
  <text x="304" y="294" text-anchor="middle" font-size="17" font-weight="700" fill="${DIAGRAM_COLORS.primary}">${regionText("A_C")}</text>
  <text x="416" y="294" text-anchor="middle" font-size="17" font-weight="700" fill="${DIAGRAM_COLORS.primary}">${regionText("B_C")}</text>
  <text x="360" y="268" text-anchor="middle" font-size="18" font-weight="800" fill="${DIAGRAM_COLORS.primary}">${regionText("A_B_C")}</text>
  <text x="104" y="250" text-anchor="middle" font-size="18" fill="${DIAGRAM_COLORS.secondary}">${regionText("outside")}</text>
  `);
}
__name(renderVennDiagramSvg, "renderVennDiagramSvg");
function renderCMemoryDiagramSvg(payload) {
  const title = String(payload.title || "C memory layout");
  const blocks = Array.isArray(payload.blocks) ? payload.blocks : [];
  const width = 860;
  const rowHeight = 56;
  const top = 96;
  const left = 84;
  const cellWidth = 112;
  const totalRows = Math.max(1, blocks.length);
  const height = top + totalRows * rowHeight + 72;
  const parts = [];
  blocks.forEach((block, index) => {
    const y = top + index * rowHeight;
    const name = escapeXml(String(block.name || `slot_${index}`));
    const type = escapeXml(String(block.type || ""));
    const value = escapeXml(String(block.value || ""));
    const address = escapeXml(String(block.address || `0x${(4096 + index * 4).toString(16)}`));
    const bytes = Array.isArray(block.bytes) ? block.bytes.slice(0, 8).map((byte) => escapeXml(String(byte))) : [];
    const note = escapeXml(String(block.note || ""));
    parts.push(`<text x="${left - 16}" y="${y + 34}" text-anchor="end" font-size="14" font-weight="600" fill="${DIAGRAM_COLORS.secondary}">${address}</text>`);
    parts.push(`<rect x="${left}" y="${y}" width="120" height="34" rx="6" fill="#f8fafc" stroke="#cbd5e1" stroke-width="1.2" />`);
    parts.push(`<text x="${left + 60}" y="${y + 23}" text-anchor="middle" font-size="15" font-weight="700" fill="${DIAGRAM_COLORS.primary}">${name}</text>`);
    parts.push(`<rect x="${left + 132}" y="${y}" width="110" height="34" rx="6" fill="#ffffff" stroke="#cbd5e1" stroke-width="1.2" />`);
    parts.push(`<text x="${left + 187}" y="${y + 23}" text-anchor="middle" font-size="14" fill="${DIAGRAM_COLORS.secondary}">${type}</text>`);
    parts.push(`<rect x="${left + 254}" y="${y}" width="146" height="34" rx="6" fill="#eff6ff" stroke="#93c5fd" stroke-width="1.2" />`);
    parts.push(`<text x="${left + 327}" y="${y + 23}" text-anchor="middle" font-size="15" font-weight="600" fill="#1d4ed8">${value}</text>`);
    bytes.forEach((byte, byteIndex) => {
      const x = left + 420 + byteIndex * cellWidth * 0.58;
      parts.push(`<rect x="${x}" y="${y}" width="58" height="34" rx="5" fill="#ffffff" stroke="#cbd5e1" stroke-width="1" />`);
      parts.push(`<text x="${x + 29}" y="${y + 23}" text-anchor="middle" font-size="13" fill="${DIAGRAM_COLORS.primary}">${byte}</text>`);
    });
    if (note) {
      parts.push(`<text x="${left + 420}" y="${y + 52}" font-size="12.5" fill="${DIAGRAM_COLORS.secondary}">${note}</text>`);
    }
  });
  return makeSvgShell(width, height, title, `
  <text x="${left + 60}" y="78" text-anchor="middle" font-size="12" font-weight="600" fill="${DIAGRAM_COLORS.tertiary}">\u53D8\u91CF</text>
  <text x="${left + 187}" y="78" text-anchor="middle" font-size="12" font-weight="600" fill="${DIAGRAM_COLORS.tertiary}">\u7C7B\u578B</text>
  <text x="${left + 327}" y="78" text-anchor="middle" font-size="12" font-weight="600" fill="${DIAGRAM_COLORS.tertiary}">\u503C</text>
  <text x="${left + 510}" y="78" text-anchor="middle" font-size="12" font-weight="600" fill="${DIAGRAM_COLORS.tertiary}">\u5185\u5B58\u5185\u5BB9</text>
  ${parts.join("\n")}
  `);
}
__name(renderCMemoryDiagramSvg, "renderCMemoryDiagramSvg");
function renderCircuitDiagramSvg(payload) {
  const title = String(payload.title || "Circuit diagram");
  const components = Array.isArray(payload.components) ? payload.components : [];
  const wires = Array.isArray(payload.wires) ? payload.wires : [];
  const notes = Array.isArray(payload.notes) ? payload.notes : [];
  const contentBounds = [...components.map((component) => circuitComponentBounds(component)), ...wires.map((wire) => circuitWireBounds(wire))].reduce((acc, bounds) => acc ? mergeBounds(acc, bounds) : bounds, null) ?? makeBounds(80, 120, 620, 360);
  const padX = 36;
  const padY = 26;
  const frameX = Math.max(20, Math.floor(contentBounds.minX - padX));
  const frameY = Math.max(52, Math.floor(contentBounds.minY - padY));
  const frameWidth = Math.max(420, Math.ceil(contentBounds.maxX - contentBounds.minX + padX * 2));
  const frameHeight = Math.max(240, Math.ceil(contentBounds.maxY - contentBounds.minY + padY * 2));
  const noteWrapWidth = 150;
  const wrappedNotes = notes.map((note) => wrapDiagramText(note, noteWrapWidth, DIAGRAM_TYPE.small, "\u2022 "));
  const noteLines = wrappedNotes.flat();
  const noteTextWidth = noteLines.length > 0 ? Math.max(...noteLines.map((note) => estimateTextWidth(note, DIAGRAM_TYPE.small))) : 0;
  const notesWidth = noteLines.length > 0 ? Math.max(196, Math.ceil(noteTextWidth + 36)) : 0;
  const noteLineHeight = 16;
  const notesHeight = noteLines.length > 0 ? Math.max(76, 28 + noteLines.length * noteLineHeight + 10) : 0;
  const notesX = frameX + frameWidth + 18;
  const wireParts = wires.map((wire) => {
    const x1 = Number(wire.x1 || 0);
    const y1 = Number(wire.y1 || 0);
    const x2 = Number(wire.x2 || 0);
    const y2 = Number(wire.y2 || 0);
    const labelText = String(wire.label || "");
    const label = escapeXml(labelText);
    const labelPos = circuitWireLabelPosition(x1, y1, x2, y2, labelText);
    const path = `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${DIAGRAM_COLORS.primary}" stroke-width="${DIAGRAM_STROKES.primary}" stroke-linecap="square" />`;
    const text = label ? `<text x="${labelPos.x}" y="${labelPos.y}" text-anchor="middle" font-size="${DIAGRAM_TYPE.small}" font-weight="600" fill="${DIAGRAM_COLORS.secondary}">${label}</text>` : "";
    return `${path}${text}`;
  });
  const componentParts = components.map((component) => renderCircuitComponent(component));
  const noteParts = noteLines.map((note, index) => `<text x="${notesX + 14}" y="${frameY + 33 + index * noteLineHeight}" font-size="${DIAGRAM_TYPE.small}" fill="${DIAGRAM_COLORS.secondary}">${escapeXml(note)}</text>`);
  return makeSvgShell(Math.max(756, notesX + notesWidth + 18), Math.max(468, Math.max(frameY + frameHeight + 32, frameY + notesHeight + 24)), title, `
  <rect x="${frameX}" y="${frameY}" width="${frameWidth}" height="${frameHeight}" fill="#ffffff" stroke="${DIAGRAM_COLORS.ultraFaint}" stroke-width="${DIAGRAM_STROKES.faint}" rx="4" opacity="${DIAGRAM_OPACITY.frame}" />
  ${noteLines.length > 0 ? `<rect x="${notesX}" y="${frameY}" width="${notesWidth}" height="${notesHeight}" fill="#ffffff" stroke="${DIAGRAM_COLORS.ultraFaint}" stroke-width="${DIAGRAM_STROKES.faint}" rx="4" />` : ""}
  ${noteLines.length > 0 ? `<text x="${notesX + 14}" y="${frameY + 19}" font-size="12" font-weight="600" fill="${DIAGRAM_COLORS.secondary}">Notes</text>` : ""}
  ${wireParts.join("\n")}
  ${componentParts.join("\n")}
  ${noteParts.join("\n")}
  `);
}
__name(renderCircuitDiagramSvg, "renderCircuitDiagramSvg");

function renderSurfacePreviewSvg(payload) {
  const title = escapeXml(String(payload.title || "3D Surface"));
  const color = escapeXml(String(payload.color || "#4f46e5"));
  const width = 720;
  const height = 480;
  const cx = width / 2;
  const cy = height / 2;
  // Generate isometric grid lines as visual hint
  let gridLines = "";
  for (let i = -5; i <= 5; i++) {
    const x = cx + i * 30;
    gridLines += `<line x1="${x}" y1="${cy - 150}" x2="${x}" y2="${cy + 150}" stroke="#e5e7eb" stroke-width="0.5" />`;
    gridLines += `<line x1="${cx - 250}" y1="${cy + i * 25}" x2="${cx + 250}" y2="${cy + i * 25}" stroke="#e5e7eb" stroke-width="0.5" />`;
  }
  // Draw a stylized 3D surface representation
  let surfacePath = "";
  for (let row = -4; row <= 4; row++) {
    let path = "";
    for (let col = -6; col <= 6; col++) {
      const px = cx + col * 28;
      const py = cy + row * 22 - Math.sin(col * 0.5) * Math.cos(row * 0.7) * 40;
      path += (col === -6 ? "M" : "L") + `${px},${py} `;
    }
    surfacePath += `<path d="${path}" fill="none" stroke="${color}" stroke-width="1.2" opacity="${0.3 + Math.abs(row) * 0.08}" />`;
  }
  for (let col = -6; col <= 6; col += 2) {
    let path = "";
    for (let row = -4; row <= 4; row++) {
      const px = cx + col * 28;
      const py = cy + row * 22 - Math.sin(col * 0.5) * Math.cos(row * 0.7) * 40;
      path += (row === -4 ? "M" : "L") + `${px},${py} `;
    }
    surfacePath += `<path d="${path}" fill="none" stroke="${color}" stroke-width="0.8" opacity="0.25" />`;
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
  <defs><style>text{font-family:system-ui,-apple-system,sans-serif}</style></defs>
  <rect width="${width}" height="${height}" fill="#fafbfc" rx="8"/>
  <text x="${cx}" y="36" text-anchor="middle" font-size="20" font-weight="600" fill="#111827">${title}</text>
  <text x="${cx}" y="56" text-anchor="middle" font-size="12" fill="#6b7280">Interactive 3D preview - click html_url for full Plotly rendering</text>
  ${gridLines}${surfacePath}
  <text x="${cx}" y="${height - 16}" text-anchor="middle" font-size="11" fill="#9ca3af">Surface preview (static)</text>
  </svg>`;
}
__name(renderSurfacePreviewSvg, "renderSurfacePreviewSvg");

function renderShape3DHtml(payload) {
  const shape = String(payload.shape || "cube");
  const title = escapeXml(String(payload.title || "3D Shape"));
  const color = escapeXml(String(payload.color || "#4f46e5"));
  const size = Number(payload.size || 1);
  const radius = Number(payload.radius || 1);
  const height = Number(payload.height || 2);
  const vector = Array.isArray(payload.vector) && payload.vector.length === 3 ? payload.vector.map((value) => Number(value)) : [1, 1, 1];
  const scenePayload = JSON.stringify({
    expr: String(payload.expr || "sin(x) * cos(y)"),
    x_min: Number(payload.x_min ?? -3),
    x_max: Number(payload.x_max ?? 3),
    y_min: Number(payload.y_min ?? -3),
    y_max: Number(payload.y_max ?? 3),
    samples: Math.max(8, Number(payload.samples || 36)),
    colorscale: String(payload.colorscale || "Viridis"),
    show_scale: payload.show_scale !== false,
    show_contours: Boolean(payload.show_contours),
    z_min: payload.z_min === null || payload.z_min === void 0 ? null : Number(payload.z_min),
    z_max: payload.z_max === null || payload.z_max === void 0 ? null : Number(payload.z_max),
    surfaces: Array.isArray(payload.surfaces) ? payload.surfaces : [],
    lines: Array.isArray(payload.lines) ? payload.lines : [],
    points: Array.isArray(payload.points) ? payload.points : [],
    palette: DEFAULT_PALETTE
  });
  return `<!doctype html>
<html><head><meta charset="utf-8"><title>${title}</title>
<script src="https://cdn.plot.ly/plotly-2.35.2.min.js"><\/script>
<script src="https://cdn.jsdelivr.net/npm/expr-eval@2.0.2/dist/bundle.min.js"><\/script>
<style>body{font-family:${DEFAULT_FONT_FAMILY};margin:0;padding:24px;background:#fff;color:#111827}h2{margin:0 0 16px;font-size:24px;font-weight:600}#plot{width:100%;height:80vh}</style>
</head><body><h2>${title}</h2><div id="plot"></div>
<script>
const color='${color}';
const shape='${shape}';
const scene=${scenePayload};
const parser = new exprEval.Parser({
  allowMemberAccess:false,
  operators:{assignment:false,concatenate:false,conditional:false,logical:false,comparison:false,in:false,random:false,fndef:false}
});
const pickColor = (index, fallback) => fallback || scene.palette[index % scene.palette.length] || color;
const surfaceCount = Array.isArray(scene.surfaces) ? scene.surfaces.length : 0;
const shouldShowScale = (surface, count) => {
  if (surface.show_scale === true) return true;
  if (surface.show_scale === false) return false;
  return count <= 1 && scene.show_scale !== false;
};
const makeSurfaceTrace = (surface, index, count) => {
  let compiled;
  try {
    compiled = parser.parse(String(surface.expr || 'sin(x) * cos(y)'));
  } catch (error) {
    throw new Error('surface ' + (index + 1) + ' expression error: ' + error.message);
  }
  const samples = Math.max(8, Number(surface.samples || scene.samples || 36));
  const xMin = Number(surface.x_min ?? scene.x_min ?? -3);
  const xMax = Number(surface.x_max ?? scene.x_max ?? 3);
  const yMin = Number(surface.y_min ?? scene.y_min ?? -3);
  const yMax = Number(surface.y_max ?? scene.y_max ?? 3);
  const xs=[], ys=[], zs=[];
  for(let iy=0; iy<samples; iy++){ ys.push(yMin + (yMax - yMin) * iy / (samples - 1)); }
  for(let ix=0; ix<samples; ix++){ xs.push(xMin + (xMax - xMin) * ix / (samples - 1)); }
  for(let iy=0; iy<ys.length; iy++){
    const row=[];
    for(let ix=0; ix<xs.length; ix++){
      let z;
      try {
        z = Number(compiled.evaluate({x: xs[ix], y: ys[iy]}));
      } catch (error) {
        throw new Error('surface ' + (index + 1) + ' evaluation error: ' + error.message);
      }
      row.push(Number.isFinite(z) ? z : null);
    }
    zs.push(row);
  }
  return {
    type:'surface',
    name:String(surface.label || ('surface ' + (index + 1))),
    x:xs,
    y:ys,
    z:zs,
    colorscale:String(surface.colorscale || scene.colorscale || 'Viridis'),
    showscale:shouldShowScale(surface, count),
    opacity:Math.max(0.15, Math.min(1, Number(surface.opacity ?? (count > 1 ? 0.8 : 0.88)))),
    contours:surface.show_contours ? {z:{show:true,usecolormap:true,highlightcolor:'#111827',project:{z:true}}} : {},
    cmin:surface.z_min === null || surface.z_min === undefined ? undefined : Number(surface.z_min),
    cmax:surface.z_max === null || surface.z_max === undefined ? undefined : Number(surface.z_max),
    hovertemplate:'x=%{x}<br>y=%{y}<br>z=%{z}<extra>%{fullData.name}</extra>'
  };
};
const makeLineTrace = (line, index) => ({
  type:'scatter3d',
  mode:'lines',
  name:String(line.label || ('line ' + (index + 1))),
  x:(line.points || []).map((point) => Number(point.x)),
  y:(line.points || []).map((point) => Number(point.y)),
  z:(line.points || []).map((point) => Number(point.z)),
  line:{color:String(line.color || pickColor(index + 2, '')), width:Math.max(1.5, Number(line.width || 5))},
  hovertemplate:'x=%{x}<br>y=%{y}<br>z=%{z}<extra>%{fullData.name}</extra>'
});
const makePointTrace = (pointSet, index) => {
  const pts = Array.isArray(pointSet.points) ? pointSet.points : [];
  const labels = pts.map((point, pointIndex) => String(point.label || ('P' + (pointIndex + 1))));
  const showLabels = Boolean(pointSet.labels) || pts.some((point) => point.label);
  return {
    type:'scatter3d',
    mode:showLabels ? 'markers+text' : 'markers',
    name:String(pointSet.label || ('points ' + (index + 1))),
    x:pts.map((point) => Number(point.x)),
    y:pts.map((point) => Number(point.y)),
    z:pts.map((point) => Number(point.z)),
    text:showLabels ? labels : undefined,
    customdata:labels,
    textposition:'top center',
    marker:{size:Math.max(2, Number(pointSet.size || 5)), color:String(pointSet.color || pickColor(index + 4, '')), line:{color:'#ffffff', width:0.5}},
    hovertemplate:'%{customdata}<br>x=%{x}<br>y=%{y}<br>z=%{z}<extra>%{fullData.name}</extra>'
  };
};
let data=[];
if(shape==='cube'){
  const s=${size};
  data=[{type:'mesh3d',x:[0,s,s,0,0,s,s,0],y:[0,0,s,s,0,0,s,s],z:[0,0,0,0,s,s,s,s],i:[0,0,0,1,4,4,5,5,0,1,2,3],j:[1,2,3,2,5,6,6,7,4,5,6,7],k:[2,3,1,0,6,7,4,4,5,6,7,4],opacity:0.62,color:color,name:'cube'}];
} else if(shape==='sphere'){
  const r=${radius}; const x=[], y=[], z=[]; for(let i=0;i<=20;i++){for(let j=0;j<=20;j++){const th=Math.PI*i/20, ph=2*Math.PI*j/20; x.push(r*Math.sin(th)*Math.cos(ph)); y.push(r*Math.sin(th)*Math.sin(ph)); z.push(r*Math.cos(th));}}
  data=[{type:'scatter3d',mode:'markers',x,y,z,marker:{size:2,color:color},name:'sphere'}];
} else if(shape==='cylinder' || shape==='cone'){
  const r=${radius}, h=${height}; const x=[],y=[],z=[]; for(let i=0;i<=40;i++){const a=2*Math.PI*i/40; for(let j=0;j<=20;j++){const zz=h*j/20; const rr=shape==='cone'?r*(1-j/20):r; x.push(rr*Math.cos(a)); y.push(rr*Math.sin(a)); z.push(zz);}}
  data=[{type:'scatter3d',mode:'markers',x,y,z,marker:{size:2,color:color},name:shape}];
} else if(shape==='vector3d'){
  data=[{type:'scatter3d',mode:'lines+markers+text',x:[0,${vector[0]}],y:[0,${vector[1]}],z:[0,${vector[2]}],text:['O','v'],textposition:'top center',line:{width:6,color:color},marker:{size:4,color:color},name:'vector'}];
} else {
  const surfaces = surfaceCount > 0 ? scene.surfaces : [{
    expr: scene.expr,
    label: 'surface',
    colorscale: scene.colorscale,
    show_scale: scene.show_scale,
    show_contours: scene.show_contours,
    x_min: scene.x_min,
    x_max: scene.x_max,
    y_min: scene.y_min,
    y_max: scene.y_max,
    z_min: scene.z_min,
    z_max: scene.z_max,
    samples: scene.samples,
    opacity: 0.88,
  }];
  data = surfaces.map((surface, index) => makeSurfaceTrace(surface, index, surfaces.length));
  data.push(...(Array.isArray(scene.lines) ? scene.lines : []).map((line, index) => makeLineTrace(line, index)));
  data.push(...(Array.isArray(scene.points) ? scene.points : []).map((pointSet, index) => makePointTrace(pointSet, index)));
}
Plotly.newPlot('plot', data, {
  margin:{l:0,r:0,b:0,t:0},
  showlegend:data.length > 1,
  legend:{bgcolor:'rgba(255,255,255,0.82)', bordercolor:'#e5e7eb', borderwidth:1},
  scene:{
    aspectmode:'data',
    xaxis:{title:'x',backgroundcolor:'#ffffff',gridcolor:'#e5e7eb',zerolinecolor:'#cbd5e1'},
    yaxis:{title:'y',backgroundcolor:'#ffffff',gridcolor:'#e5e7eb',zerolinecolor:'#cbd5e1'},
    zaxis:{title:'z',backgroundcolor:'#ffffff',gridcolor:'#e5e7eb',zerolinecolor:'#cbd5e1'}
  }
}).catch((error) => {
  document.getElementById('plot').innerHTML = '<pre style="white-space:pre-wrap;font:14px/1.5 ' + '${DEFAULT_FONT_FAMILY}' + ';color:#991b1b;background:#fef2f2;border:1px solid #fecaca;border-radius:12px;padding:16px">' + String(error && error.message ? error.message : error) + '</pre>';
});
<\/script></body></html>`;
}
__name(renderShape3DHtml, "renderShape3DHtml");

// node_modules/@resvg/resvg-wasm/index.mjs
var wasm;
var heap = new Array(128).fill(void 0);
heap.push(void 0, null, true, false);
var heap_next = heap.length;
function addHeapObject(obj) {
  if (heap_next === heap.length)
    heap.push(heap.length + 1);
  const idx = heap_next;
  heap_next = heap[idx];
  heap[idx] = obj;
  return idx;
}
__name(addHeapObject, "addHeapObject");
function getObject(idx) {
  return heap[idx];
}
__name(getObject, "getObject");
function dropObject(idx) {
  if (idx < 132)
    return;
  heap[idx] = heap_next;
  heap_next = idx;
}
__name(dropObject, "dropObject");
function takeObject(idx) {
  const ret = getObject(idx);
  dropObject(idx);
  return ret;
}
__name(takeObject, "takeObject");
var WASM_VECTOR_LEN = 0;
var cachedUint8Memory0 = null;
function getUint8Memory0() {
  if (cachedUint8Memory0 === null || cachedUint8Memory0.byteLength === 0) {
    cachedUint8Memory0 = new Uint8Array(wasm.memory.buffer);
  }
  return cachedUint8Memory0;
}
__name(getUint8Memory0, "getUint8Memory0");
var cachedTextEncoder = typeof TextEncoder !== "undefined" ? new TextEncoder("utf-8") : { encode: /* @__PURE__ */ __name(() => {
  throw Error("TextEncoder not available");
}, "encode") };
var encodeString = typeof cachedTextEncoder.encodeInto === "function" ? function(arg, view) {
  return cachedTextEncoder.encodeInto(arg, view);
} : function(arg, view) {
  const buf = cachedTextEncoder.encode(arg);
  view.set(buf);
  return {
    read: arg.length,
    written: buf.length
  };
};
function passStringToWasm0(arg, malloc, realloc) {
  if (realloc === void 0) {
    const buf = cachedTextEncoder.encode(arg);
    const ptr2 = malloc(buf.length, 1) >>> 0;
    getUint8Memory0().subarray(ptr2, ptr2 + buf.length).set(buf);
    WASM_VECTOR_LEN = buf.length;
    return ptr2;
  }
  let len = arg.length;
  let ptr = malloc(len, 1) >>> 0;
  const mem = getUint8Memory0();
  let offset = 0;
  for (; offset < len; offset++) {
    const code = arg.charCodeAt(offset);
    if (code > 127)
      break;
    mem[ptr + offset] = code;
  }
  if (offset !== len) {
    if (offset !== 0) {
      arg = arg.slice(offset);
    }
    ptr = realloc(ptr, len, len = offset + arg.length * 3, 1) >>> 0;
    const view = getUint8Memory0().subarray(ptr + offset, ptr + len);
    const ret = encodeString(arg, view);
    offset += ret.written;
    ptr = realloc(ptr, len, offset, 1) >>> 0;
  }
  WASM_VECTOR_LEN = offset;
  return ptr;
}
__name(passStringToWasm0, "passStringToWasm0");
function isLikeNone(x) {
  return x === void 0 || x === null;
}
__name(isLikeNone, "isLikeNone");
var cachedInt32Memory0 = null;
function getInt32Memory0() {
  if (cachedInt32Memory0 === null || cachedInt32Memory0.byteLength === 0) {
    cachedInt32Memory0 = new Int32Array(wasm.memory.buffer);
  }
  return cachedInt32Memory0;
}
__name(getInt32Memory0, "getInt32Memory0");
var cachedTextDecoder = typeof TextDecoder !== "undefined" ? new TextDecoder("utf-8", { ignoreBOM: true, fatal: true }) : { decode: /* @__PURE__ */ __name(() => {
  throw Error("TextDecoder not available");
}, "decode") };
if (typeof TextDecoder !== "undefined") {
  cachedTextDecoder.decode();
}
function getStringFromWasm0(ptr, len) {
  ptr = ptr >>> 0;
  return cachedTextDecoder.decode(getUint8Memory0().subarray(ptr, ptr + len));
}
__name(getStringFromWasm0, "getStringFromWasm0");
function _assertClass(instance, klass) {
  if (!(instance instanceof klass)) {
    throw new Error(`expected instance of ${klass.name}`);
  }
  return instance.ptr;
}
__name(_assertClass, "_assertClass");
function handleError(f, args) {
  try {
    return f.apply(this, args);
  } catch (e) {
    wasm.__wbindgen_exn_store(addHeapObject(e));
  }
}
__name(handleError, "handleError");
var BBoxFinalization = typeof FinalizationRegistry === "undefined" ? { register: /* @__PURE__ */ __name(() => {
}, "register"), unregister: /* @__PURE__ */ __name(() => {
}, "unregister") } : new FinalizationRegistry((ptr) => wasm.__wbg_bbox_free(ptr >>> 0));
var BBox = class _BBox {
  static {
    __name(this, "_BBox");
  }
  static __wrap(ptr) {
    ptr = ptr >>> 0;
    const obj = Object.create(_BBox.prototype);
    obj.__wbg_ptr = ptr;
    BBoxFinalization.register(obj, obj.__wbg_ptr, obj);
    return obj;
  }
  __destroy_into_raw() {
    const ptr = this.__wbg_ptr;
    this.__wbg_ptr = 0;
    BBoxFinalization.unregister(this);
    return ptr;
  }
  free() {
    const ptr = this.__destroy_into_raw();
    wasm.__wbg_bbox_free(ptr);
  }
  /**
  * @returns {number}
  */
  get x() {
    const ret = wasm.__wbg_get_bbox_x(this.__wbg_ptr);
    return ret;
  }
  /**
  * @param {number} arg0
  */
  set x(arg0) {
    wasm.__wbg_set_bbox_x(this.__wbg_ptr, arg0);
  }
  /**
  * @returns {number}
  */
  get y() {
    const ret = wasm.__wbg_get_bbox_y(this.__wbg_ptr);
    return ret;
  }
  /**
  * @param {number} arg0
  */
  set y(arg0) {
    wasm.__wbg_set_bbox_y(this.__wbg_ptr, arg0);
  }
  /**
  * @returns {number}
  */
  get width() {
    const ret = wasm.__wbg_get_bbox_width(this.__wbg_ptr);
    return ret;
  }
  /**
  * @param {number} arg0
  */
  set width(arg0) {
    wasm.__wbg_set_bbox_width(this.__wbg_ptr, arg0);
  }
  /**
  * @returns {number}
  */
  get height() {
    const ret = wasm.__wbg_get_bbox_height(this.__wbg_ptr);
    return ret;
  }
  /**
  * @param {number} arg0
  */
  set height(arg0) {
    wasm.__wbg_set_bbox_height(this.__wbg_ptr, arg0);
  }
};
var RenderedImageFinalization = typeof FinalizationRegistry === "undefined" ? { register: /* @__PURE__ */ __name(() => {
}, "register"), unregister: /* @__PURE__ */ __name(() => {
}, "unregister") } : new FinalizationRegistry((ptr) => wasm.__wbg_renderedimage_free(ptr >>> 0));
var RenderedImage = class _RenderedImage {
  static {
    __name(this, "_RenderedImage");
  }
  static __wrap(ptr) {
    ptr = ptr >>> 0;
    const obj = Object.create(_RenderedImage.prototype);
    obj.__wbg_ptr = ptr;
    RenderedImageFinalization.register(obj, obj.__wbg_ptr, obj);
    return obj;
  }
  __destroy_into_raw() {
    const ptr = this.__wbg_ptr;
    this.__wbg_ptr = 0;
    RenderedImageFinalization.unregister(this);
    return ptr;
  }
  free() {
    const ptr = this.__destroy_into_raw();
    wasm.__wbg_renderedimage_free(ptr);
  }
  /**
  * Get the PNG width
  * @returns {number}
  */
  get width() {
    const ret = wasm.renderedimage_width(this.__wbg_ptr);
    return ret >>> 0;
  }
  /**
  * Get the PNG height
  * @returns {number}
  */
  get height() {
    const ret = wasm.renderedimage_height(this.__wbg_ptr);
    return ret >>> 0;
  }
  /**
  * Write the image data to Uint8Array
  * @returns {Uint8Array}
  */
  asPng() {
    try {
      const retptr = wasm.__wbindgen_add_to_stack_pointer(-16);
      wasm.renderedimage_asPng(retptr, this.__wbg_ptr);
      var r0 = getInt32Memory0()[retptr / 4 + 0];
      var r1 = getInt32Memory0()[retptr / 4 + 1];
      var r2 = getInt32Memory0()[retptr / 4 + 2];
      if (r2) {
        throw takeObject(r1);
      }
      return takeObject(r0);
    } finally {
      wasm.__wbindgen_add_to_stack_pointer(16);
    }
  }
  /**
  * Get the RGBA pixels of the image
  * @returns {Uint8Array}
  */
  get pixels() {
    const ret = wasm.renderedimage_pixels(this.__wbg_ptr);
    return takeObject(ret);
  }
};
var ResvgFinalization = typeof FinalizationRegistry === "undefined" ? { register: /* @__PURE__ */ __name(() => {
}, "register"), unregister: /* @__PURE__ */ __name(() => {
}, "unregister") } : new FinalizationRegistry((ptr) => wasm.__wbg_resvg_free(ptr >>> 0));
var Resvg = class {
  static {
    __name(this, "Resvg");
  }
  __destroy_into_raw() {
    const ptr = this.__wbg_ptr;
    this.__wbg_ptr = 0;
    ResvgFinalization.unregister(this);
    return ptr;
  }
  free() {
    const ptr = this.__destroy_into_raw();
    wasm.__wbg_resvg_free(ptr);
  }
  /**
  * @param {Uint8Array | string} svg
  * @param {string | undefined} [options]
  * @param {Array<any> | undefined} [custom_font_buffers]
  */
  constructor(svg, options, custom_font_buffers) {
    try {
      const retptr = wasm.__wbindgen_add_to_stack_pointer(-16);
      var ptr0 = isLikeNone(options) ? 0 : passStringToWasm0(options, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
      var len0 = WASM_VECTOR_LEN;
      wasm.resvg_new(retptr, addHeapObject(svg), ptr0, len0, isLikeNone(custom_font_buffers) ? 0 : addHeapObject(custom_font_buffers));
      var r0 = getInt32Memory0()[retptr / 4 + 0];
      var r1 = getInt32Memory0()[retptr / 4 + 1];
      var r2 = getInt32Memory0()[retptr / 4 + 2];
      if (r2) {
        throw takeObject(r1);
      }
      this.__wbg_ptr = r0 >>> 0;
      return this;
    } finally {
      wasm.__wbindgen_add_to_stack_pointer(16);
    }
  }
  /**
  * Get the SVG width
  * @returns {number}
  */
  get width() {
    const ret = wasm.resvg_width(this.__wbg_ptr);
    return ret;
  }
  /**
  * Get the SVG height
  * @returns {number}
  */
  get height() {
    const ret = wasm.resvg_height(this.__wbg_ptr);
    return ret;
  }
  /**
  * Renders an SVG in Wasm
  * @returns {RenderedImage}
  */
  render() {
    try {
      const retptr = wasm.__wbindgen_add_to_stack_pointer(-16);
      wasm.resvg_render(retptr, this.__wbg_ptr);
      var r0 = getInt32Memory0()[retptr / 4 + 0];
      var r1 = getInt32Memory0()[retptr / 4 + 1];
      var r2 = getInt32Memory0()[retptr / 4 + 2];
      if (r2) {
        throw takeObject(r1);
      }
      return RenderedImage.__wrap(r0);
    } finally {
      wasm.__wbindgen_add_to_stack_pointer(16);
    }
  }
  /**
  * Output usvg-simplified SVG string
  * @returns {string}
  */
  toString() {
    let deferred1_0;
    let deferred1_1;
    try {
      const retptr = wasm.__wbindgen_add_to_stack_pointer(-16);
      wasm.resvg_toString(retptr, this.__wbg_ptr);
      var r0 = getInt32Memory0()[retptr / 4 + 0];
      var r1 = getInt32Memory0()[retptr / 4 + 1];
      deferred1_0 = r0;
      deferred1_1 = r1;
      return getStringFromWasm0(r0, r1);
    } finally {
      wasm.__wbindgen_add_to_stack_pointer(16);
      wasm.__wbindgen_free(deferred1_0, deferred1_1, 1);
    }
  }
  /**
  * Calculate a maximum bounding box of all visible elements in this SVG.
  *
  * Note: path bounding box are approx values.
  * @returns {BBox | undefined}
  */
  innerBBox() {
    const ret = wasm.resvg_innerBBox(this.__wbg_ptr);
    return ret === 0 ? void 0 : BBox.__wrap(ret);
  }
  /**
  * Calculate a maximum bounding box of all visible elements in this SVG.
  * This will first apply transform.
  * Similar to `SVGGraphicsElement.getBBox()` DOM API.
  * @returns {BBox | undefined}
  */
  getBBox() {
    const ret = wasm.resvg_getBBox(this.__wbg_ptr);
    return ret === 0 ? void 0 : BBox.__wrap(ret);
  }
  /**
  * Use a given `BBox` to crop the svg. Currently this method simply changes
  * the viewbox/size of the svg and do not move the elements for simplicity
  * @param {BBox} bbox
  */
  cropByBBox(bbox) {
    _assertClass(bbox, BBox);
    wasm.resvg_cropByBBox(this.__wbg_ptr, bbox.__wbg_ptr);
  }
  /**
  * @returns {Array<any>}
  */
  imagesToResolve() {
    try {
      const retptr = wasm.__wbindgen_add_to_stack_pointer(-16);
      wasm.resvg_imagesToResolve(retptr, this.__wbg_ptr);
      var r0 = getInt32Memory0()[retptr / 4 + 0];
      var r1 = getInt32Memory0()[retptr / 4 + 1];
      var r2 = getInt32Memory0()[retptr / 4 + 2];
      if (r2) {
        throw takeObject(r1);
      }
      return takeObject(r0);
    } finally {
      wasm.__wbindgen_add_to_stack_pointer(16);
    }
  }
  /**
  * @param {string} href
  * @param {Uint8Array} buffer
  */
  resolveImage(href, buffer) {
    try {
      const retptr = wasm.__wbindgen_add_to_stack_pointer(-16);
      const ptr0 = passStringToWasm0(href, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
      const len0 = WASM_VECTOR_LEN;
      wasm.resvg_resolveImage(retptr, this.__wbg_ptr, ptr0, len0, addHeapObject(buffer));
      var r0 = getInt32Memory0()[retptr / 4 + 0];
      var r1 = getInt32Memory0()[retptr / 4 + 1];
      if (r1) {
        throw takeObject(r0);
      }
    } finally {
      wasm.__wbindgen_add_to_stack_pointer(16);
    }
  }
};
async function __wbg_load(module, imports) {
  if (typeof Response === "function" && module instanceof Response) {
    if (typeof WebAssembly.instantiateStreaming === "function") {
      try {
        return await WebAssembly.instantiateStreaming(module, imports);
      } catch (e) {
        if (module.headers.get("Content-Type") != "application/wasm") {
          console.warn("`WebAssembly.instantiateStreaming` failed because your server does not serve wasm with `application/wasm` MIME type. Falling back to `WebAssembly.instantiate` which is slower. Original error:\n", e);
        } else {
          throw e;
        }
      }
    }
    const bytes = await module.arrayBuffer();
    return await WebAssembly.instantiate(bytes, imports);
  } else {
    const instance = await WebAssembly.instantiate(module, imports);
    if (instance instanceof WebAssembly.Instance) {
      return { instance, module };
    } else {
      return instance;
    }
  }
}
__name(__wbg_load, "__wbg_load");
function __wbg_get_imports() {
  const imports = {};
  imports.wbg = {};
  imports.wbg.__wbg_new_28c511d9baebfa89 = function(arg0, arg1) {
    const ret = new Error(getStringFromWasm0(arg0, arg1));
    return addHeapObject(ret);
  };
  imports.wbg.__wbindgen_memory = function() {
    const ret = wasm.memory;
    return addHeapObject(ret);
  };
  imports.wbg.__wbg_buffer_12d079cc21e14bdb = function(arg0) {
    const ret = getObject(arg0).buffer;
    return addHeapObject(ret);
  };
  imports.wbg.__wbg_newwithbyteoffsetandlength_aa4a17c33a06e5cb = function(arg0, arg1, arg2) {
    const ret = new Uint8Array(getObject(arg0), arg1 >>> 0, arg2 >>> 0);
    return addHeapObject(ret);
  };
  imports.wbg.__wbindgen_object_drop_ref = function(arg0) {
    takeObject(arg0);
  };
  imports.wbg.__wbg_new_63b92bc8671ed464 = function(arg0) {
    const ret = new Uint8Array(getObject(arg0));
    return addHeapObject(ret);
  };
  imports.wbg.__wbg_values_839f3396d5aac002 = function(arg0) {
    const ret = getObject(arg0).values();
    return addHeapObject(ret);
  };
  imports.wbg.__wbg_next_196c84450b364254 = function() {
    return handleError(function(arg0) {
      const ret = getObject(arg0).next();
      return addHeapObject(ret);
    }, arguments);
  };
  imports.wbg.__wbg_done_298b57d23c0fc80c = function(arg0) {
    const ret = getObject(arg0).done;
    return ret;
  };
  imports.wbg.__wbg_value_d93c65011f51a456 = function(arg0) {
    const ret = getObject(arg0).value;
    return addHeapObject(ret);
  };
  imports.wbg.__wbg_instanceof_Uint8Array_2b3bbecd033d19f6 = function(arg0) {
    let result;
    try {
      result = getObject(arg0) instanceof Uint8Array;
    } catch (_) {
      result = false;
    }
    const ret = result;
    return ret;
  };
  imports.wbg.__wbindgen_string_get = function(arg0, arg1) {
    const obj = getObject(arg1);
    const ret = typeof obj === "string" ? obj : void 0;
    var ptr1 = isLikeNone(ret) ? 0 : passStringToWasm0(ret, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
    var len1 = WASM_VECTOR_LEN;
    getInt32Memory0()[arg0 / 4 + 1] = len1;
    getInt32Memory0()[arg0 / 4 + 0] = ptr1;
  };
  imports.wbg.__wbg_new_16b304a2cfa7ff4a = function() {
    const ret = new Array();
    return addHeapObject(ret);
  };
  imports.wbg.__wbindgen_string_new = function(arg0, arg1) {
    const ret = getStringFromWasm0(arg0, arg1);
    return addHeapObject(ret);
  };
  imports.wbg.__wbg_push_a5b05aedc7234f9f = function(arg0, arg1) {
    const ret = getObject(arg0).push(getObject(arg1));
    return ret;
  };
  imports.wbg.__wbg_length_c20a40f15020d68a = function(arg0) {
    const ret = getObject(arg0).length;
    return ret;
  };
  imports.wbg.__wbg_set_a47bac70306a19a7 = function(arg0, arg1, arg2) {
    getObject(arg0).set(getObject(arg1), arg2 >>> 0);
  };
  imports.wbg.__wbindgen_throw = function(arg0, arg1) {
    throw new Error(getStringFromWasm0(arg0, arg1));
  };
  return imports;
}
__name(__wbg_get_imports, "__wbg_get_imports");
function __wbg_init_memory(imports, maybe_memory) {
}
__name(__wbg_init_memory, "__wbg_init_memory");
function __wbg_finalize_init(instance, module) {
  wasm = instance.exports;
  __wbg_init.__wbindgen_wasm_module = module;
  cachedInt32Memory0 = null;
  cachedUint8Memory0 = null;
  return wasm;
}
__name(__wbg_finalize_init, "__wbg_finalize_init");
async function __wbg_init(input) {
  if (wasm !== void 0)
    return wasm;
  if (typeof input === "undefined") {
    input = new URL("index_bg.wasm", void 0);
  }
  const imports = __wbg_get_imports();
  if (typeof input === "string" || typeof Request === "function" && input instanceof Request || typeof URL === "function" && input instanceof URL) {
    input = fetch(input);
  }
  __wbg_init_memory(imports);
  const { instance, module } = await __wbg_load(await input, imports);
  return __wbg_finalize_init(instance, module);
}
__name(__wbg_init, "__wbg_init");
var dist_default = __wbg_init;
var initialized = false;
var initWasm = /* @__PURE__ */ __name(async (module_or_path) => {
  if (initialized) {
    throw new Error("Already initialized. The `initWasm()` function can be used only once.");
  }
  await dist_default(await module_or_path);
  initialized = true;
}, "initWasm");
var Resvg2 = class extends Resvg {
  static {
    __name(this, "Resvg2");
  }
  /**
   * @param {Uint8Array | string} svg
   * @param {ResvgRenderOptions | undefined} options
   */
  constructor(svg, options) {
    if (!initialized)
      throw new Error("Wasm has not been initialized. Call `initWasm()` function.");
    const font = options?.font;
    if (!!font && isCustomFontsOptions(font)) {
      const serializableOptions = {
        ...options,
        font: {
          ...font,
          fontBuffers: void 0
        }
      };
      super(svg, JSON.stringify(serializableOptions), font.fontBuffers);
    } else {
      super(svg, JSON.stringify(options));
    }
  }
};
function isCustomFontsOptions(value) {
  return Object.prototype.hasOwnProperty.call(value, "fontBuffers");
}
__name(isCustomFontsOptions, "isCustomFontsOptions");

// src/render.ts
import wasmModule from "./dd4dd8881e2df4e64203b5c0ae65e1648ab55207-index_bg.wasm";
import pingFangSubset from "./c86ecd91c793f2818ef3c2dbd3aeded4a77ad760-PingFangSC-Regular.subset.ttf";
var wasmReady = null;
async function ensureResvgReady() {
  if (!wasmReady) {
    wasmReady = initWasm(wasmModule);
  }
  await wasmReady;
}
__name(ensureResvgReady, "ensureResvgReady");
function mapX(x, xMin, xMax, plotX, plotWidth) {
  return plotX + (x - xMin) / (xMax - xMin) * plotWidth;
}
__name(mapX, "mapX");
function mapY(y, yMin, yMax, plotY, plotHeight) {
  return plotY + plotHeight - (y - yMin) / (yMax - yMin) * plotHeight;
}
__name(mapY, "mapY");
function makePath(points, spec, plotX, plotY, plotWidth, plotHeight) {
  if (points.length === 0) return "";
  const xSpan = spec.xMax - spec.xMin;
  const ySpan = spec.yMax - spec.yMin;
  const typicalDx = points.length > 1 ? Math.max(1e-9, xSpan / Math.max(1, points.length - 1)) : xSpan;
  return points.map((point, index) => {
    const previous = index > 0 ? points[index - 1] : null;
    const jump = previous ? Math.abs(point.y - previous.y) > ySpan * 0.45 || Math.abs(point.x - previous.x) > typicalDx * 2.5 : false;
    const x = mapX(point.x, spec.xMin, spec.xMax, plotX, plotWidth);
    const y = mapY(point.y, spec.yMin, spec.yMax, plotY, plotHeight);
    return `${index === 0 || jump ? "M" : "L"}${x.toFixed(2)},${y.toFixed(2)}`;
  }).join(" ");
}
__name(makePath, "makePath");
function renderLegend(spec, width) {
  return spec.series.map((series, index) => {
    const y = 90 + index * 28;
    return `<g><rect x="${width - 290}" y="${y - 12}" width="18" height="4" fill="${series.color}" rx="2"/><text x="${width - 264}" y="${y}" font-size="18" fill="#111827">${escapeXml(series.name)}</text></g>`;
  }).join("");
}
__name(renderLegend, "renderLegend");
function renderBarLayer(spec, plotX, plotY, plotWidth, plotHeight) {
  if (!spec.barMode) return "";
  const count = spec.series[0]?.points.length || 0;
  if (!count) return "";
  const slotWidth = plotWidth / count;
  const barWidth = Math.max(12, slotWidth * 0.64);
  const zeroY = mapY(0, spec.yMin, spec.yMax, plotY, plotHeight);
  return spec.series[0].points.map((point, index) => {
    const centerX = mapX(point.x, spec.xMin, spec.xMax, plotX, plotWidth);
    const y = mapY(point.y, spec.yMin, spec.yMax, plotY, plotHeight);
    const top = Math.min(y, zeroY);
    const height = Math.max(1, Math.abs(zeroY - y));
    const label = escapeXml(spec.categories?.[index] || String(index + 1));
    return `<g><rect x="${(centerX - barWidth / 2).toFixed(2)}" y="${top.toFixed(2)}" width="${barWidth.toFixed(2)}" height="${height.toFixed(2)}" fill="${spec.series[0].color}" opacity="0.88" rx="6"/><text x="${centerX.toFixed(2)}" y="${plotY + plotHeight + 34}" font-size="16" text-anchor="middle" fill="#374151">${label}</text></g>`;
  }).join("");
}
__name(renderBarLayer, "renderBarLayer");
function firstSeriesAreaPath(spec, xMin, xMax, plotX, plotY, plotWidth, plotHeight) {
  const points = spec.series[0]?.points.filter((point) => point.x >= xMin && point.x <= xMax) || [];
  if (points.length < 2) return "";
  const zeroY = mapY(0, spec.yMin, spec.yMax, plotY, plotHeight);
  const start = points[0];
  const end = points[points.length - 1];
  const top = points.map((point, index) => {
    const x = mapX(point.x, spec.xMin, spec.xMax, plotX, plotWidth);
    const y = mapY(point.y, spec.yMin, spec.yMax, plotY, plotHeight);
    return `${index === 0 ? "M" : "L"}${x.toFixed(2)},${y.toFixed(2)}`;
  }).join(" ");
  const endX = mapX(end.x, spec.xMin, spec.xMax, plotX, plotWidth);
  const startX = mapX(start.x, spec.xMin, spec.xMax, plotX, plotWidth);
  return `${top} L${endX.toFixed(2)},${zeroY.toFixed(2)} L${startX.toFixed(2)},${zeroY.toFixed(2)} Z`;
}
__name(firstSeriesAreaPath, "firstSeriesAreaPath");
function renderAnnotations(spec, plotX, plotY, plotWidth, plotHeight) {
  const annotations = spec.annotations || [];
  const areaLayer = annotations.filter((item) => item.kind === "area").map((item) => {
    const path = firstSeriesAreaPath(spec, item.x_min, item.x_max, plotX, plotY, plotWidth, plotHeight);
    if (!path) return "";
    const labelX = mapX((item.x_min + item.x_max) / 2, spec.xMin, spec.xMax, plotX, plotWidth);
    const labelY = plotY + 28;
    return `<g><path d="${path}" fill="${item.color}" opacity="${item.opacity}"/><text x="${labelX.toFixed(2)}" y="${labelY}" font-size="17" text-anchor="middle" fill="${item.color}" font-weight="600">${escapeXml(item.label)}</text></g>`;
  }).join("");
  const lineLayer = annotations.filter((item) => item.kind === "vertical_line").map((item) => {
    const x = mapX(item.x, spec.xMin, spec.xMax, plotX, plotWidth);
    return `<g><line x1="${x.toFixed(2)}" y1="${plotY}" x2="${x.toFixed(2)}" y2="${plotY + plotHeight}" stroke="${item.color}" stroke-width="2.5" stroke-dasharray="8 7"/><text x="${(x + 8).toFixed(2)}" y="${plotY + 24}" font-size="17" fill="${item.color}" font-weight="600">${escapeXml(item.label)}</text></g>`;
  }).join("");
  const pointLayer = annotations.filter((item) => item.kind === "point").map((item) => {
    const x = mapX(item.x, spec.xMin, spec.xMax, plotX, plotWidth);
    const y = mapY(item.y, spec.yMin, spec.yMax, plotY, plotHeight);
    return `<g><circle cx="${x.toFixed(2)}" cy="${y.toFixed(2)}" r="6" fill="${item.color}" stroke="#fff" stroke-width="2"/><text x="${(x + 10).toFixed(2)}" y="${(y - 10).toFixed(2)}" font-size="17" fill="${item.color}" font-weight="600">${escapeXml(item.label)}</text></g>`;
  }).join("");
  const labelLayer = annotations.filter((item) => item.kind === "label").map((item) => {
    const x = mapX(item.x, spec.xMin, spec.xMax, plotX, plotWidth);
    const y = mapY(item.y, spec.yMin, spec.yMax, plotY, plotHeight);
    return `<text x="${x.toFixed(2)}" y="${y.toFixed(2)}" font-size="17" fill="${item.color}" font-weight="600">${escapeXml(item.text)}</text>`;
  }).join("");
  return `${areaLayer}${lineLayer}${pointLayer}${labelLayer}`;
}
__name(renderAnnotations, "renderAnnotations");
function renderPlotSvg(spec) {
  const width = DEFAULT_WIDTH;
  const height = DEFAULT_HEIGHT;
  const plotX = 110;
  const plotY = 110;
  const plotWidth = width - 230;
  const plotHeight = height - 220;
  const gridLines = 5;
  const xTicks = Array.from({ length: gridLines + 1 }, (_, i) => spec.xMin + (spec.xMax - spec.xMin) / gridLines * i);
  const yTicks = Array.from({ length: gridLines + 1 }, (_, i) => spec.yMin + (spec.yMax - spec.yMin) / gridLines * i);
  const grid = spec.grid ? [
    ...xTicks.map((tick) => {
      const x = mapX(tick, spec.xMin, spec.xMax, plotX, plotWidth);
      return `<line x1="${x}" y1="${plotY}" x2="${x}" y2="${plotY + plotHeight}" stroke="${DEFAULT_GRID}" stroke-width="1" opacity="0.6"/>`;
    }),
    ...yTicks.map((tick) => {
      const y = mapY(tick, spec.yMin, spec.yMax, plotY, plotHeight);
      return `<line x1="${plotX}" y1="${y}" x2="${plotX + plotWidth}" y2="${y}" stroke="${DEFAULT_GRID}" stroke-width="1" opacity="0.6"/>`;
    })
  ].join("") : "";
  const tickLabels = spec.barMode ? [
    ...yTicks.map((tick) => {
      const y = mapY(tick, spec.yMin, spec.yMax, plotY, plotHeight);
      return `<text x="${plotX - 14}" y="${y + 6}" font-size="16" text-anchor="end" fill="#374151">${tick.toFixed(2)}</text>`;
    })
  ].join("") : [
    ...xTicks.map((tick) => {
      const x = mapX(tick, spec.xMin, spec.xMax, plotX, plotWidth);
      return `<text x="${x}" y="${plotY + plotHeight + 34}" font-size="16" text-anchor="middle" fill="#374151">${tick.toFixed(2)}</text>`;
    }),
    ...yTicks.map((tick) => {
      const y = mapY(tick, spec.yMin, spec.yMax, plotY, plotHeight);
      return `<text x="${plotX - 14}" y="${y + 6}" font-size="16" text-anchor="end" fill="#374151">${tick.toFixed(2)}</text>`;
    })
  ].join("");
  const seriesSvg = spec.barMode ? "" : spec.series.map((series) => {
    const path = makePath(series.points, spec, plotX, plotY, plotWidth, plotHeight);
    const circles = series.type === "line" ? "" : series.points.map((point) => {
      const cx = mapX(point.x, spec.xMin, spec.xMax, plotX, plotWidth);
      const cy = mapY(point.y, spec.yMin, spec.yMax, plotY, plotHeight);
      return `<circle cx="${cx.toFixed(2)}" cy="${cy.toFixed(2)}" r="4.5" fill="${series.color}" />`;
    }).join("");
    const line = series.type === "scatter" || !path ? "" : `<path d="${path}" fill="none" stroke="${series.color}" stroke-width="3.5" stroke-linejoin="round" stroke-linecap="round"/>`;
    return `<g>${line}${circles}</g>`;
  }).join("");
  const barLayer = renderBarLayer(spec, plotX, plotY, plotWidth, plotHeight);
  const annotationLayer = renderAnnotations(spec, plotX, plotY, plotWidth, plotHeight);
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
  <style>
    text { font-family: ${DEFAULT_FONT_FAMILY}; }
  </style>
  <rect width="100%" height="100%" fill="${DEFAULT_BG}" />
  <text x="${width / 2}" y="54" text-anchor="middle" font-size="${DEFAULT_FONT_SIZE + 10}" font-weight="700" fill="#111827">${escapeXml(spec.title)}</text>
  <rect x="${plotX}" y="${plotY}" width="${plotWidth}" height="${plotHeight}" fill="#ffffff" stroke="#9ca3af" stroke-width="1.5"/>
  ${grid}
  <line x1="${plotX}" y1="${plotY + plotHeight}" x2="${plotX + plotWidth}" y2="${plotY + plotHeight}" stroke="${DEFAULT_AXIS}" stroke-width="2"/>
  <line x1="${plotX}" y1="${plotY}" x2="${plotX}" y2="${plotY + plotHeight}" stroke="${DEFAULT_AXIS}" stroke-width="2"/>
  ${tickLabels}
  ${barLayer}
  ${annotationLayer}
  ${seriesSvg}
  ${renderLegend(spec, width)}
  <text x="${width / 2}" y="${height - 34}" text-anchor="middle" font-size="20" fill="#111827">${escapeXml(spec.xlabel)}</text>
  <text x="30" y="${height / 2}" text-anchor="middle" font-size="20" fill="#111827" transform="rotate(-90 30 ${height / 2})">${escapeXml(spec.ylabel)}</text>
</svg>`;
}
__name(renderPlotSvg, "renderPlotSvg");
async function renderPngResponse(svg, env) {
  await ensureResvgReady();
  const fontBuffers = [new Uint8Array(pingFangSubset)];
  const renderer = new Resvg2(svg, {
    fitTo: { mode: "original" },
    background: DEFAULT_BG,
    font: {
      fontBuffers,
      defaultFontFamily: "PingFang SC",
      sansSerifFamily: "PingFang SC",
      defaultFontSize: DEFAULT_FONT_SIZE
    }
  });
  const image = renderer.render();
  const png = image.asPng();
  const body = new Uint8Array(png);
  return new Response(body, {
    status: 200,
    headers: {
      "content-type": "image/png",
      "cache-control": "public, max-age=300",
      "access-control-allow-origin": "*"
    }
  });
}
__name(renderPngResponse, "renderPngResponse");

// src/index.ts
var pointSchema = {
  anyOf: [
    {
      type: "array",
      items: { type: "number" },
      minItems: 2,
      maxItems: 2
    },
    {
      type: "object",
      properties: {
        x: { type: "number" },
        y: { type: "number" }
      },
      required: ["x", "y"],
      additionalProperties: false
    }
  ]
};
var plotSeriesItemSchema = {
  type: "object",
  properties: {
    name: { type: "string" },
    type: { type: "string", enum: ["line", "scatter", "line+scatter"] },
    color: { type: "string" },
    points: {
      type: "array",
      items: pointSchema,
      minItems: 1
    }
  },
  required: ["points"],
  additionalProperties: false
};
var piecewiseSegmentSchema = {
  type: "object",
  properties: {
    expr: { type: "string" },
    x_min: { type: "number" },
    x_max: { type: "number" },
    label: { type: "string" },
    name: { type: "string" },
    color: { type: "string" }
  },
  required: ["expr", "x_min", "x_max"],
  additionalProperties: false
};
var plotAnnotationSchema = {
  type: "object",
  properties: {
    kind: { type: "string", enum: ["vertical_line", "point", "label", "area"] },
    type: { type: "string", enum: ["vertical_line", "point", "label", "area"] },
    x: { type: "number" },
    y: { type: "number" },
    x_min: { type: "number" },
    x_max: { type: "number" },
    label: { type: "string" },
    text: { type: "string" },
    color: { type: "string" },
    opacity: { type: "number" }
  },
  additionalProperties: false
};
var teachingParamsSchema = {
  type: "object",
  additionalProperties: true
};
var teachingToolProperties = {
  topic: { type: "string", enum: ["parabola", "definite_integral", "tangent_derivative", "fourier_series", "projectile_motion", "simple_harmonic_motion", "energy_conservation", "rc_charging", "rlc_transient", "incline_force", "stress_strain", "band_gap", "venn_probability", "c_pointer_array", "c_struct_layout"] },
  level: { type: "string", enum: ["intro", "college"], default: "college" },
  title: { type: "string" },
  params: teachingParamsSchema,
  steps: { type: "boolean", default: false },
  highlight: { type: "boolean", default: true }
};
var forceItemSchema = {
  type: "object",
  properties: {
    label: { type: "string" },
    angle_deg: { type: "number" },
    magnitude: { type: "number" },
    color: { type: "string" }
  },
  required: ["angle_deg", "magnitude"],
  additionalProperties: false
};
var circuitComponentSchema = {
  type: "object",
  properties: {
    id: { type: "string" },
    x: { type: "number" },
    y: { type: "number" },
    label: { type: "string" },
    type: { type: "string", enum: ["node", "battery", "source", "current_source", "voltage_source", "resistor", "capacitor", "inductor", "switch", "diode", "led", "ammeter", "voltmeter", "transistor", "relay", "buzzer", "opamp", "pulley", "lamp", "load", "ground"] },
    orientation: { type: "string", enum: ["horizontal", "vertical"] },
    color: { type: "string" }
  },
  required: ["type"],
  additionalProperties: false
};
var circuitWireSchema = {
  type: "object",
  properties: {
    x1: { type: "number" },
    y1: { type: "number" },
    x2: { type: "number" },
    y2: { type: "number" },
    label: { type: "string" }
  },
  required: ["x1", "y1", "x2", "y2"],
  additionalProperties: false
};
var circuitLayoutItemSchema = {
  type: "object",
  properties: {
    id: { type: "string" },
    type: { type: "string", enum: ["battery", "source", "current_source", "voltage_source", "resistor", "capacitor", "inductor", "switch", "diode", "led", "ammeter", "voltmeter", "transistor", "relay", "buzzer", "opamp", "lamp", "load", "ground"] },
    label: { type: "string" },
    orientation: { type: "string", enum: ["horizontal", "vertical"] },
    color: { type: "string" }
  },
  required: ["type"],
  additionalProperties: false
};
var circuitBranchSchema = {
  type: "object",
  properties: {
    items: {
      type: "array",
      items: circuitLayoutItemSchema,
      minItems: 1
    }
  },
  required: ["items"],
  additionalProperties: false
};
var vennSetSchema = {
  type: "object",
  properties: {
    label: { type: "string" },
    color: { type: "string" }
  },
  additionalProperties: false
};
var vennRegionsSchema = {
  type: "object",
  properties: {
    A_only: { type: "string" },
    B_only: { type: "string" },
    C_only: { type: "string" },
    A_B: { type: "string" },
    A_C: { type: "string" },
    B_C: { type: "string" },
    A_B_C: { type: "string" },
    outside: { type: "string" }
  },
  additionalProperties: false
};
var cMemoryBlockSchema = {
  type: "object",
  properties: {
    name: { type: "string" },
    type: { type: "string" },
    value: { type: "string" },
    address: { type: "string" },
    bytes: { type: "array", items: { type: "string" }, minItems: 1, maxItems: 8 },
    note: { type: "string" }
  },
  additionalProperties: false
};
var circuitStageSchema = {
  type: "object",
  properties: {
    kind: { type: "string", enum: ["series", "parallel"] },
    items: { type: "array", items: circuitLayoutItemSchema, minItems: 1 },
    branches: { type: "array", items: circuitBranchSchema, minItems: 1 }
  },
  required: ["kind"],
  additionalProperties: false
};
var shape3dPointSchema = {
  anyOf: [
    {
      type: "array",
      items: { type: "number" },
      minItems: 3,
      maxItems: 3
    },
    {
      type: "object",
      properties: {
        x: { type: "number" },
        y: { type: "number" },
        z: { type: "number" },
        label: { type: "string" }
      },
      required: ["x", "y", "z"],
      additionalProperties: false
    }
  ]
};
var shape3dSurfaceSchema = {
  type: "object",
  properties: {
    expr: { type: "string" },
    label: { type: "string" },
    color: { type: "string" },
    colorscale: { type: "string", enum: ["Viridis", "Cividis", "Turbo", "Jet", "Plasma"] },
    show_scale: { type: "boolean" },
    show_contours: { type: "boolean" },
    x_min: { type: "number" },
    x_max: { type: "number" },
    y_min: { type: "number" },
    y_max: { type: "number" },
    z_min: { type: "number" },
    z_max: { type: "number" },
    samples: { type: "integer" },
    opacity: { type: "number" }
  },
  required: ["expr"],
  additionalProperties: false
};
var shape3dLineSchema = {
  type: "object",
  properties: {
    label: { type: "string" },
    color: { type: "string" },
    width: { type: "number" },
    points: {
      type: "array",
      items: shape3dPointSchema,
      minItems: 2
    }
  },
  required: ["points"],
  additionalProperties: false
};
var shape3dPointsSchema = {
  type: "object",
  properties: {
    label: { type: "string" },
    color: { type: "string" },
    size: { type: "number" },
    labels: { type: "boolean" },
    points: {
      type: "array",
      items: shape3dPointSchema,
      minItems: 1
    }
  },
  required: ["points"],
  additionalProperties: false
};
var shape3dSchema = {
  type: "object",
  properties: {
    shape: { type: "string", enum: ["cube", "sphere", "cylinder", "cone", "vector3d", "surface3d"], default: "cube" },
    title: { type: "string", default: "3D Shape" },
    size: { type: "number", default: 1 },
    radius: { type: "number", default: 1 },
    height: { type: "number", default: 2 },
    vector: { type: "array", items: { type: "number" }, minItems: 3, maxItems: 3 },
    color: { type: "string", default: "#4f46e5" },
    expr: { type: "string" },
    x_min: { type: "number", default: -3 },
    x_max: { type: "number", default: 3 },
    y_min: { type: "number", default: -3 },
    y_max: { type: "number", default: 3 },
    samples: { type: "integer", default: 36 },
    colorscale: { type: "string", enum: ["Viridis", "Cividis", "Turbo", "Jet", "Plasma"], default: "Viridis" },
    show_scale: { type: "boolean", default: true },
    show_contours: { type: "boolean", default: false },
    z_min: { type: "number" },
    z_max: { type: "number" },
    surfaces: { type: "array", items: shape3dSurfaceSchema, minItems: 1 },
    lines: { type: "array", items: shape3dLineSchema, minItems: 1 },
    points: {
      anyOf: [
        { type: "array", items: shape3dPointSchema, minItems: 1 },
        { type: "array", items: shape3dPointsSchema, minItems: 1 }
      ]
    }
  },
  additionalProperties: false
};
var TOOLS = [
  {
    name: "health",
    description: "Check rebuilt Plot MCP health status.",
    inputSchema: { type: "object", properties: {}, additionalProperties: false }
  },
  {
    name: "plot",
    description: "Plot a single expression and return PNG data.",
    inputSchema: {
      type: "object",
      properties: { expr: { type: "string" }, pieces: { type: "array", items: piecewiseSegmentSchema, minItems: 1 }, x_min: { type: "number", default: -10 }, x_max: { type: "number", default: 10 }, points: { type: "integer", default: 1e3 } },
      additionalProperties: false
    }
  },
  {
    name: "plot_json",
    description: "Plot a single expression and return PNG/base64 payload.",
    inputSchema: {
      type: "object",
      properties: { expr: { type: "string" }, pieces: { type: "array", items: piecewiseSegmentSchema, minItems: 1 }, x_min: { type: "number", default: -10 }, x_max: { type: "number", default: 10 }, points: { type: "integer", default: 1e3 }, title: { type: "string" }, xlabel: { type: "string" }, ylabel: { type: "string" }, annotations: { type: "array", items: plotAnnotationSchema } },
      additionalProperties: false
    }
  },
  {
    name: "plot_png_link",
    description: "Generate a direct PNG URL for a single-expression plot.",
    inputSchema: {
      type: "object",
      properties: { expr: { type: "string" }, pieces: { type: "array", items: piecewiseSegmentSchema, minItems: 1 }, x_min: { type: "number", default: -10 }, x_max: { type: "number", default: 10 }, points: { type: "integer", default: 1e3 }, title: { type: "string" }, xlabel: { type: "string" }, ylabel: { type: "string" }, annotations: { type: "array", items: plotAnnotationSchema } },
      additionalProperties: false
    }
  },
  {
    name: "plot_multi",
    description: "Plot multiple expressions on one chart.",
    inputSchema: {
      type: "object",
      properties: { exprs: { type: "array", items: { type: "string" } }, labels: { anyOf: [{ type: "array", items: { type: "string" } }, { type: "null" }] }, x_min: { type: "number", default: -10 }, x_max: { type: "number", default: 10 }, points: { type: "integer", default: 1e3 }, title: { type: "string" }, xlabel: { type: "string" }, ylabel: { type: "string" }, annotations: { type: "array", items: plotAnnotationSchema } },
      required: ["exprs"],
      additionalProperties: false
    }
  },
  {
    name: "plot_multi_json",
    description: "Plot multiple expressions and return PNG/base64 payload.",
    inputSchema: {
      type: "object",
      properties: { exprs: { type: "array", items: { type: "string" } }, labels: { anyOf: [{ type: "array", items: { type: "string" } }, { type: "null" }] }, x_min: { type: "number", default: -10 }, x_max: { type: "number", default: 10 }, points: { type: "integer", default: 1e3 }, title: { type: "string" }, xlabel: { type: "string" }, ylabel: { type: "string" }, annotations: { type: "array", items: plotAnnotationSchema } },
      required: ["exprs"],
      additionalProperties: false
    }
  },
  {
    name: "plot_multi_png_link",
    description: "Generate a direct PNG URL for a multi-expression plot.",
    inputSchema: {
      type: "object",
      properties: { exprs: { type: "array", items: { type: "string" } }, labels: { anyOf: [{ type: "array", items: { type: "string" } }, { type: "null" }] }, x_min: { type: "number", default: -10 }, x_max: { type: "number", default: 10 }, points: { type: "integer", default: 1e3 }, title: { type: "string" }, xlabel: { type: "string" }, ylabel: { type: "string" }, annotations: { type: "array", items: plotAnnotationSchema } },
      required: ["exprs"],
      additionalProperties: false
    }
  },
  {
    name: "plot_series",
    description: "Plot custom point series.",
    inputSchema: {
      type: "object",
      properties: { series: { type: "array", items: plotSeriesItemSchema, minItems: 1 }, title: { type: "string" }, xlabel: { type: "string" }, ylabel: { type: "string" }, grid: { type: "boolean", default: true }, annotations: { type: "array", items: plotAnnotationSchema } },
      required: ["series"],
      additionalProperties: false
    }
  },
  {
    name: "plot_series_json",
    description: "Plot custom point series and return PNG/base64 payload.",
    inputSchema: {
      type: "object",
      properties: { series: { type: "array", items: plotSeriesItemSchema, minItems: 1 }, title: { type: "string" }, xlabel: { type: "string" }, ylabel: { type: "string" }, grid: { type: "boolean", default: true }, annotations: { type: "array", items: plotAnnotationSchema } },
      required: ["series"],
      additionalProperties: false
    }
  },
  {
    name: "plot_series_png_link",
    description: "Generate a direct PNG URL for a custom series plot.",
    inputSchema: {
      type: "object",
      properties: { series: { type: "array", items: plotSeriesItemSchema, minItems: 1 }, title: { type: "string" }, xlabel: { type: "string" }, ylabel: { type: "string" }, grid: { type: "boolean", default: true }, annotations: { type: "array", items: plotAnnotationSchema } },
      required: ["series"],
      additionalProperties: false
    }
  },
  {
    name: "force_diagram_link",
    description: "Generate a direct SVG link for a 2D physics free-body / force analysis diagram.",
    inputSchema: {
      type: "object",
      properties: { body_label: { type: "string", default: "m" }, forces: { type: "array", items: forceItemSchema, minItems: 1 }, show_components: { type: "boolean", default: false } },
      required: ["forces"],
      additionalProperties: false
    }
  },
  {
    name: "force_analysis_link",
    description: "Generate a richer SVG link for mechanics force analysis with axes, components, resultant, and incline context.",
    inputSchema: {
      type: "object",
      properties: {
        title: { type: "string" },
        body_label: { type: "string", default: "m" },
        forces: { type: "array", items: forceItemSchema, minItems: 1 },
        show_components: { type: "boolean", default: true },
        show_axes: { type: "boolean", default: true },
        show_resultant: { type: "boolean", default: true },
        show_angle_labels: { type: "boolean", default: false },
        incline_deg: { type: "number", default: 0 }
      },
      required: ["forces"],
      additionalProperties: false
    }
  },
  {
    name: "circuit_diagram_link",
    description: "Generate a direct SVG link for a simple circuit schematic diagram with batteries, voltage/current sources, and common teaching components.",
    inputSchema: {
      type: "object",
      properties: {
        title: { type: "string" },
        components: { type: "array", items: circuitComponentSchema, minItems: 1 },
        wires: { type: "array", items: circuitWireSchema, minItems: 1 },
        stages: { type: "array", items: circuitStageSchema, minItems: 1 },
        row: { type: "array", items: circuitLayoutItemSchema, minItems: 1 },
        branches: { type: "array", items: circuitBranchSchema, minItems: 1 },
        return_path: { type: "array", items: circuitLayoutItemSchema, minItems: 1 },
        source_label: { type: "string" },
        notes: { type: "array", items: { type: "string" } }
      },
      additionalProperties: false
    }
  },
  {
    name: "force_analysis_template_link",
    description: "Generate a force-analysis SVG from a common mechanics template like incline, hanging mass, or horizontal surface.",
    inputSchema: {
      type: "object",
      properties: {
        template: { type: "string", enum: ["incline", "hanging", "horizontal", "pulley", "spring", "double_block", "pulley_group", "spring_oscillator"], default: "horizontal" },
        title: { type: "string" },
        body_label: { type: "string" },
        incline_deg: { type: "number", default: 30 },
        weight: { type: "number", default: 3 },
        normal: { type: "number" },
        friction: { type: "number", default: 0 },
        pull: { type: "number", default: 0 },
        tension: { type: "number", default: 0 },
        show_components: { type: "boolean", default: true },
        show_axes: { type: "boolean", default: true },
        show_resultant: { type: "boolean", default: true },
        show_angle_labels: { type: "boolean", default: false }
      },
      additionalProperties: false
    }
  },
  {
    name: "circuit_template_link",
    description: "Generate a circuit SVG from a common teaching template like series, parallel, switched lamp, or source/meter examples.",
    inputSchema: {
      type: "object",
      properties: {
        template: { type: "string", enum: ["series", "parallel", "switch_lamp", "source_resistor", "led_resistor", "meter_loop", "transistor_switch", "relay_driver", "buzzer_loop", "opamp_follower"], default: "series" },
        title: { type: "string" },
        source_label: { type: "string" },
        resistor_label: { type: "string" },
        resistor_label_2: { type: "string" },
        lamp_label: { type: "string" },
        switch_label: { type: "string" },
        notes: { type: "array", items: { type: "string" } }
      },
      additionalProperties: false
    }
  },
  {
    name: "venn_diagram_link",
    description: "Generate a direct SVG link for a 2-set or 3-set Venn diagram used in probability and set problems.",
    inputSchema: {
      type: "object",
      properties: {
        title: { type: "string" },
        sets: { type: "array", items: vennSetSchema, minItems: 2, maxItems: 3 },
        regions: vennRegionsSchema
      },
      additionalProperties: false
    }
  },
  {
    name: "c_memory_diagram_link",
    description: "Generate a direct SVG link for a C-language memory layout or pointer teaching diagram.",
    inputSchema: {
      type: "object",
      properties: {
        title: { type: "string" },
        blocks: { type: "array", items: cMemoryBlockSchema, minItems: 1 }
      },
      required: ["blocks"],
      additionalProperties: false
    }
  },
  {
    name: "shape3d_link",
    description: "Generate a direct HTML link for an interactive 3D geometric shape viewer.",
    inputSchema: shape3dSchema
  },
  {
    name: "plot_bar_json",
    description: "Render a bar chart and return PNG/base64 payload.",
    inputSchema: {
      type: "object",
      properties: { categories: { type: "array", items: { type: "string" } }, values: { type: "array", items: { type: "number" } }, title: { type: "string" }, xlabel: { type: "string" }, ylabel: { type: "string" } },
      required: ["categories", "values"],
      additionalProperties: false
    }
  },
  {
    name: "teaching_template_link",
    description: "Generate a teaching-oriented STEM visualization from a high-level template with annotations and highlights.",
    inputSchema: {
      type: "object",
      properties: teachingToolProperties,
      required: ["topic"],
      additionalProperties: false
    }
  },
  {
    name: "teaching_sequence_link",
    description: "Generate a coordinated multi-figure teaching sequence for university STEM explanations.",
    inputSchema: {
      type: "object",
      properties: teachingToolProperties,
      required: ["topic"],
      additionalProperties: false
    }
  }
];
function healthResult(origin) {
  return {
    ok: true,
    name: SERVER_NAME,
    version: SERVER_VERSION,
    mcp_endpoint: `${origin}/mcp`,
    png_endpoint: `${origin}/png?d=<base64url-json>`,
    short_link_endpoint: `${origin}${SHORT_LINK_PATH_PREFIX}<token>`,
    tools: TOOLS.map((tool) => tool.name)
  };
}
__name(healthResult, "healthResult");
function normalizeForceItem(item, index) {
  const record = item && typeof item === "object" ? item : {};
  return {
    label: limitText(record.label, `F${index + 1}`, MAX_LABEL_LENGTH),
    angle_deg: parseNumber(record.angle_deg, 0),
    magnitude: Math.max(0.1, parseNumber(record.magnitude, 1)),
    color: limitText(record.color, "#2563eb", 32)
  };
}
__name(normalizeForceItem, "normalizeForceItem");
function normalizeForceBody(item, index) {
  const record = item && typeof item === "object" ? item : {};
  const forces = ensureArray(record.forces).slice(0, MAX_FORCE_ITEMS).map((force, forceIndex) => normalizeForceItem(force, forceIndex));
  return {
    id: limitText(record.id, `body${index + 1}`, MAX_LABEL_LENGTH),
    label: limitText(record.label, index === 0 ? "m" : `m${index + 1}`, MAX_LABEL_LENGTH),
    kind: limitText(record.kind, "block", 24),
    x: parseNumber(record.x, 0),
    y: parseNumber(record.y, 0),
    width: Math.max(24, parseNumber(record.width, 72)),
    height: Math.max(24, parseNumber(record.height, 48)),
    radius: Math.max(12, parseNumber(record.radius, 22)),
    angle_deg: parseNumber(record.angle_deg, 0),
    forces
  };
}
__name(normalizeForceBody, "normalizeForceBody");
function normalizeForceSurface(item, index) {
  const record = item && typeof item === "object" ? item : {};
  return {
    id: limitText(record.id, `surface${index + 1}`, MAX_LABEL_LENGTH),
    kind: limitText(record.kind, "ground", 24),
    x1: parseNumber(record.x1, 80),
    y1: parseNumber(record.y1, 340),
    x2: parseNumber(record.x2, 560),
    y2: parseNumber(record.y2, 340),
    label: limitText(record.label, "", MAX_LABEL_LENGTH)
  };
}
__name(normalizeForceSurface, "normalizeForceSurface");
function normalizeForceConnector(item, index) {
  const record = item && typeof item === "object" ? item : {};
  return {
    id: limitText(record.id, `connector${index + 1}`, MAX_LABEL_LENGTH),
    kind: limitText(record.kind, "rope", 24),
    x1: parseNumber(record.x1, 0),
    y1: parseNumber(record.y1, 0),
    x2: parseNumber(record.x2, 0),
    y2: parseNumber(record.y2, 0),
    label: limitText(record.label, "", MAX_LABEL_LENGTH)
  };
}
__name(normalizeForceConnector, "normalizeForceConnector");
function sanitizeVennPayload(args) {
  const sets = ensureArray(args.sets).slice(0, 3).map((item, index) => {
    const record = item && typeof item === "object" ? item : {};
    return {
      label: limitText(record.label, String.fromCharCode(65 + index), MAX_LABEL_LENGTH),
      color: limitText(record.color, "", 32)
    };
  });
  if (sets.length < 2) throw new Error("sets requires 2 or 3 items");
  const rawRegions = args.regions && typeof args.regions === "object" ? args.regions : {};
  return {
    title: limitText(args.title, "Venn diagram", MAX_TITLE_LENGTH),
    sets,
    regions: {
      A_only: limitText(rawRegions.A_only, "", MAX_LABEL_LENGTH),
      B_only: limitText(rawRegions.B_only, "", MAX_LABEL_LENGTH),
      C_only: limitText(rawRegions.C_only, "", MAX_LABEL_LENGTH),
      A_B: limitText(rawRegions.A_B, "", MAX_LABEL_LENGTH),
      A_C: limitText(rawRegions.A_C, "", MAX_LABEL_LENGTH),
      B_C: limitText(rawRegions.B_C, "", MAX_LABEL_LENGTH),
      A_B_C: limitText(rawRegions.A_B_C, "", MAX_LABEL_LENGTH),
      outside: limitText(rawRegions.outside, "", MAX_LABEL_LENGTH)
    }
  };
}
__name(sanitizeVennPayload, "sanitizeVennPayload");
function sanitizeCMemoryPayload(args) {
  const blocks = ensureArray(args.blocks).map((item, index) => {
    const record = item && typeof item === "object" ? item : {};
    return {
      name: limitText(record.name, `slot_${index}`, MAX_LABEL_LENGTH),
      type: limitText(record.type, "", MAX_LABEL_LENGTH),
      value: limitText(record.value, "", MAX_LABEL_LENGTH),
      address: limitText(record.address, `0x${(4096 + index * 4).toString(16)}`, MAX_LABEL_LENGTH),
      bytes: ensureArray(record.bytes).slice(0, 8).map((byte) => limitText(byte, "", 8)),
      note: limitText(record.note, "", MAX_LABEL_LENGTH * 2)
    };
  }).filter((block) => block.name || block.value || block.type || block.bytes.length > 0);
  if (blocks.length === 0) throw new Error("blocks is required");
  return {
    title: limitText(args.title, "C memory layout", MAX_TITLE_LENGTH),
    blocks
  };
}
__name(sanitizeCMemoryPayload, "sanitizeCMemoryPayload");
function sanitizeForcePayload(args) {
  const bodiesInput = ensureArray(args.bodies).slice(0, MAX_FORCE_BODIES);
  const bodies = bodiesInput.length > 0 ? bodiesInput.map((item, index) => normalizeForceBody(item, index)) : [{
    id: "body1",
    label: limitText(args.body_label, "m", MAX_LABEL_LENGTH),
    kind: "particle",
    x: 0,
    y: 0,
    width: 48,
    height: 48,
    radius: 22,
    angle_deg: 0,
    forces: ensureArray(args.forces).slice(0, MAX_FORCE_ITEMS).map((item, index) => ({
      ...normalizeForceItem(item, index),
      color: limitText(item && typeof item === "object" ? item.color : void 0, "#d22", 32)
    }))
  }];
  const primaryBody = bodies.find((body) => body.forces.length > 0) || bodies[0];
  if (!primaryBody || primaryBody.forces.length === 0) throw new Error("forces is required");
  return {
    body_label: primaryBody.label,
    forces: primaryBody.forces,
    show_components: Boolean(args.show_components),
    bodies
  };
}
__name(sanitizeForcePayload, "sanitizeForcePayload");
function sanitizeForceAnalysisPayload(args) {
  const bodiesInput = ensureArray(args.bodies).slice(0, MAX_FORCE_BODIES);
  const surfaces = ensureArray(args.surfaces).slice(0, MAX_FORCE_SURFACES).map((item, index) => normalizeForceSurface(item, index));
  const connectors = ensureArray(args.connectors).slice(0, MAX_FORCE_CONNECTORS).map((item, index) => normalizeForceConnector(item, index));
  const bodies = bodiesInput.length > 0 ? bodiesInput.map((item, index) => normalizeForceBody(item, index)) : [{
    id: "body1",
    label: limitText(args.body_label, "m", MAX_LABEL_LENGTH),
    kind: Math.abs(parseNumber(args.incline_deg, 0)) > 0.01 ? "block" : "particle",
    x: 0,
    y: 0,
    width: 72,
    height: 48,
    radius: 24,
    angle_deg: parseNumber(args.incline_deg, 0),
    forces: ensureArray(args.forces).slice(0, MAX_FORCE_ITEMS).map((item, index) => normalizeForceItem(item, index))
  }];
  const primaryBody = bodies.find((body) => body.forces.length > 0) || bodies[0];
  if (!primaryBody || primaryBody.forces.length === 0) throw new Error("forces is required");
  const inclineDeg = parseNumber(args.incline_deg, 0);
  const totalForces = bodies.reduce((sum, body) => sum + body.forces.length, 0);
  const preferLocalAngles = Math.abs(inclineDeg) > 0.01;
  const clusteredAngles = new Set(primaryBody.forces.map((force) => Math.round((force.angle_deg % 360 + 360) % 360 / 12))).size;
  const denseForceLayout = preferLocalAngles && primaryBody.forces.length >= 4 || totalForces >= 6 || primaryBody.forces.length >= 4 && clusteredAngles <= 3;
  const autoSimplified = [];
  const showComponents = args.show_components === void 0 ? !denseForceLayout : args.show_components !== false;
  if (denseForceLayout && args.show_components === void 0) autoSimplified.push("components");
  const showAxes = args.show_axes === void 0 ? !(denseForceLayout && preferLocalAngles) : args.show_axes !== false;
  if (denseForceLayout && preferLocalAngles && args.show_axes === void 0) autoSimplified.push("axes");
  const showAngleLabels = args.show_angle_labels === void 0 ? false : Boolean(args.show_angle_labels);
  if (denseForceLayout && args.show_angle_labels === void 0 && preferLocalAngles) autoSimplified.push("angle labels");
  const showResultant = args.show_resultant === void 0 ? !(denseForceLayout && primaryBody.forces.length >= 5) : args.show_resultant !== false;
  if (denseForceLayout && primaryBody.forces.length >= 5 && args.show_resultant === void 0) autoSimplified.push("resultant");
  const warning = [
    args.warning === void 0 ? "" : limitText(args.warning, "", MAX_TITLE_LENGTH),
    autoSimplified.length > 0 ? limitText(`auto-simplified ${autoSimplified.join(", ")} to keep dense force layouts readable`, "", MAX_TITLE_LENGTH) : ""
  ].filter(Boolean).join("; ");
  return {
    title: limitText(args.title, "Force analysis", MAX_TITLE_LENGTH),
    body_label: primaryBody.label,
    forces: primaryBody.forces,
    show_components: showComponents,
    show_axes: showAxes,
    show_resultant: showResultant,
    show_angle_labels: showAngleLabels,
    incline_deg: inclineDeg,
    warning: warning || void 0,
    bodies,
    surfaces,
    connectors
  };
}
__name(sanitizeForceAnalysisPayload, "sanitizeForceAnalysisPayload");
function sanitizeForceTemplatePayload(args) {
  const template = limitText(args.template, "horizontal", 24);
  const weight = Math.max(0.1, parseNumber(args.weight, 3));
  const rawIncline = parseNumber(args.incline_deg, 30);
  const incline = clamp(rawIncline, 1, 85);
  const friction = Math.max(0, parseNumber(args.friction, 0));
  const pull = Math.max(0, parseNumber(args.pull, 0));
  const tension = Math.max(0, parseNumber(args.tension, 0));
  const bodyLabel = limitText(args.body_label, template === "hanging" ? "m" : "\u7269\u4F53", MAX_LABEL_LENGTH);
  const gravityColor = "#c2410c";
  const supportColor = "#15803d";
  const frictionColor = "#1d4ed8";
  const tensionColor = "#7c3aed";
  const pushColor = "#0f766e";
  const contactColor = "#a16207";
  if (template === "incline") {
    const inclineRad = incline * Math.PI / 180;
    const x1 = 180;
    const y1 = 340;
    const x2 = 470;
    const y2 = 340 - Math.tan(inclineRad) * 290;
    const t = 0.42;
    const warning = Math.abs(rawIncline - incline) > 1e-9 ? `incline_deg was clamped from ${rawIncline} to ${incline} to keep the template layout stable` : void 0;
    const inclineSurface = { kind: "incline", x1, y1, x2, y2, label: `${Math.round(incline)}\xB0` };
    const inclineBody = {
      id: "block1",
      label: bodyLabel,
      kind: "block",
      width: 72,
      height: 48,
      angle_deg: incline,
      forces: [
        { label: "\u91CD\u529B", angle_deg: -90, magnitude: weight, color: gravityColor },
        { label: "\u652F\u6301\u529B", angle_deg: 90 - incline, magnitude: Math.max(0.1, parseNumber(args.normal, weight * Math.cos(incline * Math.PI / 180))), color: supportColor },
        { label: "\u6469\u64E6\u529B", angle_deg: 180 - incline, magnitude: friction || weight * 0.25, color: frictionColor },
        { label: "\u62C9\u529B", angle_deg: 180 - incline, magnitude: pull || weight * 0.35, color: tensionColor }
      ]
    };
    const position = placeBodyOnSurface(inclineBody, inclineSurface, t, -1, 0);
    return sanitizeForceAnalysisPayload({
      title: args.title ?? "Incline force analysis",
      body_label: bodyLabel,
      incline_deg: incline,
      show_components: args.show_components ?? true,
      show_axes: args.show_axes ?? true,
      show_resultant: args.show_resultant ?? true,
      show_angle_labels: args.show_angle_labels ?? false,
      warning,
      surfaces: [inclineSurface],
      bodies: [{
        ...inclineBody,
        x: position.x,
        y: position.y
      }]
    });
  }
  if (template === "hanging") {
    return sanitizeForceAnalysisPayload({
      title: args.title ?? "Hanging mass analysis",
      body_label: bodyLabel,
      incline_deg: 0,
      show_components: args.show_components ?? false,
      show_axes: args.show_axes ?? true,
      show_resultant: args.show_resultant ?? true,
      show_angle_labels: args.show_angle_labels ?? false,
      connectors: [{ kind: "rope", x1: 320, y1: 84, x2: 320, y2: 188 }],
      surfaces: [{ kind: "support", x1: 260, y1: 84, x2: 380, y2: 84 }],
      bodies: [{
        id: "support1",
        label: "",
        kind: "support",
        x: 320,
        y: 84,
        width: 140,
        height: 10,
        forces: []
      }, {
        id: "mass1",
        label: bodyLabel,
        kind: "hanging_mass",
        x: 320,
        y: 236,
        width: 62,
        height: 78,
        forces: [
          { label: "\u62C9\u529B", angle_deg: 90, magnitude: tension || weight, color: tensionColor },
          { label: "\u91CD\u529B", angle_deg: -90, magnitude: weight, color: gravityColor }
        ]
      }]
    });
  }
  if (template === "pulley") {
    return sanitizeForceAnalysisPayload({
      title: args.title ?? "Pulley force analysis",
      body_label: bodyLabel,
      incline_deg: 0,
      show_components: args.show_components ?? true,
      show_axes: args.show_axes ?? true,
      show_resultant: args.show_resultant ?? true,
      show_angle_labels: args.show_angle_labels ?? false,
      connectors: [
        { kind: "rope", x1: 210, y1: 128, x2: 320, y2: 128 },
        { kind: "rope", x1: 320, y1: 128, x2: 320, y2: 230 },
        { kind: "rope", x1: 320, y1: 128, x2: 430, y2: 128 }
      ],
      bodies: [{
        id: "pulley1",
        label: bodyLabel,
        kind: "pulley",
        x: 320,
        y: 128,
        radius: 24,
        forces: [
          { label: "\u5DE6\u4FA7\u62C9\u529B", angle_deg: 180, magnitude: tension || weight * 0.8, color: tensionColor },
          { label: "\u53F3\u4FA7\u62C9\u529B", angle_deg: 0, magnitude: tension || weight * 0.8, color: pushColor },
          { label: "\u91CD\u529B", angle_deg: -90, magnitude: weight, color: gravityColor }
        ]
      }]
    });
  }
  if (template === "double_block") {
    return sanitizeForceAnalysisPayload({
      title: args.title ?? "Double-block force analysis",
      body_label: bodyLabel,
      incline_deg: 0,
      show_components: args.show_components ?? true,
      show_axes: args.show_axes ?? true,
      show_resultant: args.show_resultant ?? true,
      show_angle_labels: args.show_angle_labels ?? false,
      surfaces: [{ kind: "ground", x1: 120, y1: 320, x2: 540, y2: 320 }],
      connectors: [{ kind: "contact", x1: 316, y1: 284, x2: 356, y2: 284, label: "\u63A5\u89E6" }],
      bodies: [
        {
          id: "block1",
          label: "A",
          kind: "block",
          x: 260,
          y: 284,
          forces: [
            { label: "\u62C9\u529B", angle_deg: 180, magnitude: tension || weight * 0.6, color: tensionColor },
            { label: "\u652F\u6301\u529B", angle_deg: 90, magnitude: weight, color: supportColor },
            { label: "\u91CD\u529B", angle_deg: -90, magnitude: weight, color: gravityColor }
          ]
        },
        {
          id: "block2",
          label: "B",
          kind: "block",
          x: 400,
          y: 284,
          forces: [
            { label: "\u63A8\u529B", angle_deg: 0, magnitude: pull || weight * 0.6, color: pushColor },
            { label: "\u63A5\u89E6\u529B", angle_deg: 180, magnitude: Math.max(0.1, weight * 0.35), color: contactColor },
            { label: "\u6469\u64E6\u529B", angle_deg: 180, magnitude: friction || weight * 0.18, color: frictionColor },
            { label: "\u91CD\u529B", angle_deg: -90, magnitude: weight, color: gravityColor }
          ]
        }
      ]
    });
  }
  if (template === "pulley_group") {
    return sanitizeForceAnalysisPayload({
      title: args.title ?? "Pulley-group force analysis",
      body_label: bodyLabel,
      incline_deg: 0,
      show_components: args.show_components ?? true,
      show_axes: args.show_axes ?? true,
      show_resultant: args.show_resultant ?? true,
      show_angle_labels: args.show_angle_labels ?? false,
      connectors: [
        { kind: "rope", x1: 240, y1: 118, x2: 320, y2: 118 },
        { kind: "rope", x1: 320, y1: 118, x2: 400, y2: 118 },
        { kind: "rope", x1: 320, y1: 118, x2: 320, y2: 220 }
      ],
      bodies: [{
        id: "pulley1",
        label: bodyLabel,
        kind: "pulley",
        x: 320,
        y: 118,
        forces: [
          { label: "\u7EF3\u6BB5\u62C9\u529B T1", angle_deg: 140, magnitude: tension || weight * 0.55, color: tensionColor },
          { label: "\u7EF3\u6BB5\u62C9\u529B T2", angle_deg: 40, magnitude: tension || weight * 0.55, color: pushColor },
          { label: "\u91CD\u529B", angle_deg: -90, magnitude: weight, color: gravityColor }
        ]
      }]
    });
  }
  if (template === "spring_oscillator") {
    return sanitizeForceAnalysisPayload({
      title: args.title ?? "Spring oscillator snapshot",
      body_label: bodyLabel,
      incline_deg: 0,
      show_components: args.show_components ?? true,
      show_axes: args.show_axes ?? true,
      show_resultant: args.show_resultant ?? true,
      show_angle_labels: args.show_angle_labels ?? false,
      connectors: [{ kind: "spring", x1: 140, y1: 250, x2: 250, y2: 250 }],
      surfaces: [{ kind: "wall", x1: 110, y1: 180, x2: 110, y2: 320 }],
      bodies: [{
        id: "mass1",
        label: bodyLabel,
        kind: "block",
        x: 308,
        y: 250,
        forces: [
          { label: "\u56DE\u590D\u529B", angle_deg: 180, magnitude: tension || weight * 0.7, color: tensionColor },
          { label: "\u901F\u5EA6\u65B9\u5411", angle_deg: 0, magnitude: pull || weight * 0.45, color: pushColor },
          { label: "\u963B\u5C3C", angle_deg: 180, magnitude: friction || weight * 0.2, color: supportColor }
        ]
      }]
    });
  }
  if (template === "spring") {
    return sanitizeForceAnalysisPayload({
      title: args.title ?? "Spring force analysis",
      body_label: bodyLabel,
      incline_deg: 0,
      show_components: args.show_components ?? true,
      show_axes: args.show_axes ?? true,
      show_resultant: args.show_resultant ?? true,
      show_angle_labels: args.show_angle_labels ?? false,
      connectors: [{ kind: "spring", x1: 150, y1: 260, x2: 260, y2: 260 }],
      surfaces: [{ kind: "wall", x1: 120, y1: 190, x2: 120, y2: 330 }],
      bodies: [{
        id: "block1",
        label: bodyLabel,
        kind: "block",
        x: 320,
        y: 260,
        forces: [
          { label: "\u5F39\u529B", angle_deg: 180, magnitude: tension || weight * 0.7, color: tensionColor },
          { label: "\u5916\u529B", angle_deg: 0, magnitude: pull || weight * 0.7, color: pushColor },
          { label: "\u6469\u64E6\u529B", angle_deg: 180, magnitude: friction || weight * 0.2, color: frictionColor }
        ]
      }]
    });
  }
  return sanitizeForceAnalysisPayload({
    title: args.title ?? "Horizontal force analysis",
    body_label: bodyLabel,
    incline_deg: 0,
    show_components: args.show_components ?? true,
    show_axes: args.show_axes ?? true,
    show_resultant: args.show_resultant ?? true,
    show_angle_labels: args.show_angle_labels ?? false,
    surfaces: [{ kind: "ground", x1: 110, y1: 320, x2: 530, y2: 320 }],
    bodies: [{
      id: "block1",
      label: bodyLabel,
      kind: "block",
      x: 320,
      y: 284,
      forces: [
        { label: "\u91CD\u529B", angle_deg: -90, magnitude: weight, color: gravityColor },
        { label: "\u652F\u6301\u529B", angle_deg: 90, magnitude: Math.max(0.1, parseNumber(args.normal, weight)), color: supportColor },
        { label: "\u6469\u64E6\u529B", angle_deg: 180, magnitude: friction || weight * 0.2, color: frictionColor },
        { label: "\u62C9\u529B", angle_deg: 0, magnitude: pull || weight * 0.3, color: tensionColor }
      ]
    }]
  });
}
__name(sanitizeForceTemplatePayload, "sanitizeForceTemplatePayload");
function normalizeSceneWire(item) {
  const record = item && typeof item === "object" ? item : {};
  return {
    x1: parseNumber(record.x1, 0),
    y1: parseNumber(record.y1, 0),
    x2: parseNumber(record.x2, 0),
    y2: parseNumber(record.y2, 0),
    label: limitText(record.label, "", MAX_LABEL_LENGTH)
  };
}
__name(normalizeSceneWire, "normalizeSceneWire");
function normalizeSceneAttachment(item, index) {
  const record = item && typeof item === "object" ? item : {};
  return {
    id: limitText(record.id, `attachment${index + 1}`, MAX_LABEL_LENGTH),
    type: limitText(record.type, "voltmeter_parallel", 32),
    target: limitText(record.target, "", MAX_LABEL_LENGTH),
    source: limitText(record.source, "", MAX_LABEL_LENGTH),
    label: limitText(record.label, "", MAX_LABEL_LENGTH),
    x: record.x === void 0 ? void 0 : parseNumber(record.x, 0),
    y: record.y === void 0 ? void 0 : parseNumber(record.y, 0)
  };
}
__name(normalizeSceneAttachment, "normalizeSceneAttachment");
function findComponentById(components, id) {
  return components.find((component) => component.id === id);
}
__name(findComponentById, "findComponentById");
function componentLeadX(component, side) {
  const type = String(component.type || "node");
  const orientation = String(component.orientation || "horizontal") === "vertical" ? "vertical" : "horizontal";
  const x = Number(component.x || 0);
  if (orientation === "vertical") {
    if (type === "transistor") return x + (side === "left" ? -10 : 10);
    if (type === "opamp") return x + (side === "left" ? -10 : 10);
    return x;
  }
  if (type === "battery") return x + (side === "left" ? -34 : 34);
  if (type === "source" || type === "current_source" || type === "voltage_source") return x + (side === "left" ? -36 : 36);
  if (type === "resistor") return x + (side === "left" ? -36 : 36);
  if (type === "capacitor") return x + (side === "left" ? -30 : 30);
  if (type === "inductor") return x + (side === "left" ? -34 : 34);
  if (type === "switch") return x + (side === "left" ? -36 : 36);
  if (type === "diode" || type === "led") return x + (side === "left" ? -34 : 34);
  if (type === "ammeter" || type === "voltmeter" || type === "lamp" || type === "load" || type === "pulley") return x + (side === "left" ? -36 : 36);
  if (type === "transistor") return x + (side === "left" ? -36 : 24);
  if (type === "relay") return x + (side === "left" ? -36 : 40);
  if (type === "buzzer") return x + (side === "left" ? -36 : 34);
  if (type === "opamp") return x + (side === "left" ? -40 : 38);
  if (type === "ground") return x;
  return x;
}
__name(componentLeadX, "componentLeadX");
function componentLeadY(component, side = "center") {
  const type = String(component.type || "node");
  const orientation = String(component.orientation || "horizontal") === "vertical" ? "vertical" : "horizontal";
  const y = Number(component.y || 0);
  if (orientation !== "vertical") return y;
  if (type === "battery") return y + (side === "top" ? -34 : side === "bottom" ? 34 : 0);
  if (type === "source" || type === "current_source" || type === "voltage_source") return y + (side === "top" ? -36 : side === "bottom" ? 36 : 0);
  if (type === "resistor") return y + (side === "top" ? -36 : side === "bottom" ? 36 : 0);
  if (type === "capacitor") return y + (side === "top" ? -30 : side === "bottom" ? 30 : 0);
  if (type === "inductor") return y + (side === "top" ? -34 : side === "bottom" ? 34 : 0);
  if (type === "switch") return y + (side === "top" ? -36 : side === "bottom" ? 36 : 0);
  if (type === "diode" || type === "led") return y + (side === "top" ? -34 : side === "bottom" ? 34 : 0);
  if (type === "ammeter" || type === "voltmeter" || type === "lamp" || type === "load" || type === "pulley") return y + (side === "top" ? -36 : side === "bottom" ? 36 : 0);
  if (type === "transistor") return y + (side === "top" ? -36 : side === "bottom" ? 30 : 0);
  if (type === "relay") return y + (side === "top" ? -40 : side === "bottom" ? 36 : 0);
  if (type === "buzzer") return y + (side === "top" ? -36 : side === "bottom" ? 34 : 0);
  if (type === "opamp") return y + (side === "top" ? -40 : side === "bottom" ? 38 : 0);
  if (type === "ground") return y;
  return y;
}
__name(componentLeadY, "componentLeadY");
function buildSceneAttachmentPayload(components, attachments) {
  const extraComponents = [];
  const extraWires = [];
  attachments.forEach((attachment, index) => {
    const type = String(attachment.type || "");
    if (type === "voltmeter_parallel") {
      const target = findComponentById(components, String(attachment.target || ""));
      if (!target) return;
      const leftX = componentLeadX(target, "left");
      const rightX = componentLeadX(target, "right");
      const targetY = componentLeadY(target, "center");
      const meterX = attachment.x ?? (leftX + rightX) / 2;
      const meterY = attachment.y ?? targetY + 92;
      const meterId = attachment.id || `voltmeter_${index + 1}`;
      extraComponents.push({
        id: meterId,
        type: "voltmeter",
        label: attachment.label || "V",
        color: "#111827",
        x: meterX,
        y: meterY,
        orientation: String(target.orientation || "horizontal") === "vertical" ? "vertical" : "horizontal"
      });
      if (String(target.orientation || "horizontal") === "vertical") {
        extraWires.push(layoutWire(leftX, componentLeadY(target, "top"), leftX, meterY - 36));
        extraWires.push(layoutWire(leftX, meterY - 36, meterX, meterY - 36));
        extraWires.push(layoutWire(rightX, componentLeadY(target, "bottom"), rightX, meterY + 36));
        extraWires.push(layoutWire(rightX, meterY + 36, meterX, meterY + 36));
      } else {
        extraWires.push(layoutWire(leftX, targetY, leftX, meterY));
        extraWires.push(layoutWire(leftX, meterY, meterX - 36, meterY));
        extraWires.push(layoutWire(rightX, targetY, rightX, meterY));
        extraWires.push(layoutWire(meterX + 36, meterY, rightX, meterY));
      }
    }
    if (type === "feedback") {
      const source = findComponentById(components, String(attachment.source || ""));
      const target = findComponentById(components, String(attachment.target || ""));
      if (!source || !target) return;
      const startX = componentLeadX(source, "right");
      const startY = componentLeadY(source, String(source.orientation || "horizontal") === "vertical" ? "bottom" : "center");
      const endX = componentLeadX(target, "left");
      const endY = componentLeadY(target, String(target.orientation || "horizontal") === "vertical" ? "bottom" : "center") + 24;
      const railY = attachment.y ?? Math.max(startY, endY) + 120;
      extraWires.push(layoutWire(startX, startY, startX, railY));
      extraWires.push(layoutWire(startX, railY, endX, railY));
      extraWires.push(layoutWire(endX, railY, endX, endY, attachment.label || "\u53CD\u9988"));
    }
    if (type === "base_feed") {
      const source = findComponentById(components, String(attachment.source || ""));
      const target = findComponentById(components, String(attachment.target || ""));
      if (!source || !target) return;
      const startX = componentLeadX(source, "right");
      const startY = componentLeadY(source, String(source.orientation || "horizontal") === "vertical" ? "bottom" : "center");
      const baseX = Number(target.x || 0) - 40;
      const baseY = Number(target.y || 0);
      extraWires.push(layoutWire(startX, startY, baseX, startY));
      extraWires.push(layoutWire(baseX, startY, baseX, baseY, attachment.label || "B"));
    }
    if (type === "return_rail") {
      const source = findComponentById(components, String(attachment.source || ""));
      const target = findComponentById(components, String(attachment.target || ""));
      if (!source || !target) return;
      const startX = componentLeadX(source, "right");
      const startY = componentLeadY(source, String(source.orientation || "horizontal") === "vertical" ? "bottom" : "center");
      const endX = componentLeadX(target, "left");
      const endY = componentLeadY(target, String(target.orientation || "horizontal") === "vertical" ? "top" : "center");
      const railY = attachment.y ?? Math.max(startY, endY) + 130;
      extraWires.push(layoutWire(startX, startY, startX, railY));
      extraWires.push(layoutWire(startX, railY, endX, railY));
      extraWires.push(layoutWire(endX, railY, endX, endY));
    }
  });
  return { extraComponents, extraWires };
}
__name(buildSceneAttachmentPayload, "buildSceneAttachmentPayload");
function buildCircuitScenePayload(args) {
  const title = limitText(args.title, "Circuit diagram", MAX_TITLE_LENGTH);
  const notes = ensureArray(args.notes).slice(0, 12).map((note) => limitText(note, "", MAX_LABEL_LENGTH));
  const lanesInput = ensureArray(args.lanes).slice(0, MAX_CIRCUIT_LAYOUT_BRANCHES + 1).map((lane, laneIndex) => {
    const record = lane && typeof lane === "object" ? lane : {};
    return {
      name: limitText(record.name, laneIndex === 0 ? "main" : `lane${laneIndex + 1}`, 24),
      items: ensureArray(record.items).slice(0, MAX_CIRCUIT_LAYOUT_ITEMS)
    };
  }).filter((lane) => lane.items.length > 0);
  if (lanesInput.length === 0) {
    throw new Error("lanes is required");
  }
  const firstLane = lanesInput[0];
  const sharedPrefix = [];
  const sharedSuffix = [];
  const branchRows = lanesInput.slice(1).map((lane) => lane.items.slice());
  if (branchRows.length > 0) {
    while (firstLane.items.length > sharedPrefix.length && branchRows.every((items) => items.length > sharedPrefix.length)) {
      const index = sharedPrefix.length;
      const mainItem = firstLane.items[index];
      const mainRecord = mainItem && typeof mainItem === "object" ? mainItem : {};
      const mainId = limitText(mainRecord.id, "", MAX_LABEL_LENGTH);
      if (!mainId) break;
      const matches = branchRows.every((items) => {
        const item = items[index];
        const record = item && typeof item === "object" ? item : {};
        return limitText(record.id, "", MAX_LABEL_LENGTH) === mainId;
      });
      if (!matches) break;
      sharedPrefix.push(mainItem);
    }
    while (firstLane.items.length - sharedPrefix.length - sharedSuffix.length > 0 && branchRows.every((items) => items.length - sharedPrefix.length - sharedSuffix.length > 0)) {
      const mainIndex = firstLane.items.length - 1 - sharedSuffix.length;
      const mainItem = firstLane.items[mainIndex];
      const mainRecord = mainItem && typeof mainItem === "object" ? mainItem : {};
      const mainId = limitText(mainRecord.id, "", MAX_LABEL_LENGTH);
      if (!mainId) break;
      const matches = branchRows.every((items) => {
        const item = items[items.length - 1 - sharedSuffix.length];
        const record = item && typeof item === "object" ? item : {};
        return limitText(record.id, "", MAX_LABEL_LENGTH) === mainId;
      });
      if (!matches) break;
      sharedSuffix.unshift(mainItem);
    }
  }
  const stages = [];
  if (sharedPrefix.length > 0) {
    stages.push({ kind: "series", items: sharedPrefix });
  }
  if (branchRows.length > 0) {
    const branches = lanesInput.map((lane, laneIndex) => {
      const items = lane.items.slice(sharedPrefix.length, lane.items.length - sharedSuffix.length);
      if (laneIndex === 0 && items.length === 0) {
        return { items: [{ id: `${lane.name}_wire`, type: "ground", label: "", color: "#111827" }] };
      }
      return { items };
    }).filter((branch) => branch.items.length > 0);
    if (branches.length > 0) {
      stages.push({ kind: "parallel", branches });
    }
  } else if (firstLane.items.length > 0) {
    stages.push({ kind: "series", items: firstLane.items });
  }
  if (sharedSuffix.length > 0) {
    stages.push({ kind: "series", items: sharedSuffix });
  }
  return buildCircuitLayoutPayload({
    title,
    notes,
    source_label: args.source_label,
    stages
  });
}
__name(buildCircuitScenePayload, "buildCircuitScenePayload");
function buildCircuitSceneComponentLayoutPayload(args, sceneComponents) {
  const title = limitText(args.title, "Circuit diagram", MAX_TITLE_LENGTH);
  const notes = ensureArray(args.notes).slice(0, 12).map((note) => limitText(note, "", MAX_LABEL_LENGTH));
  const orderedComponents = [...sceneComponents].sort((a, b) => {
    const laneCompare = String(a.lane).localeCompare(String(b.lane));
    if (laneCompare !== 0) return laneCompare;
    const orderCompare = Number(a.order) - Number(b.order);
    if (orderCompare !== 0) return orderCompare;
    return String(a.id).localeCompare(String(b.id));
  });
  const lanes = Array.from(new Set(orderedComponents.map((item) => item.lane)));
  const laneItems = lanes.map((lane) => orderedComponents.filter((item) => item.lane === lane).map((item) => ({
    id: item.id,
    type: item.type,
    label: item.label,
    color: item.color,
    orientation: item.orientation
  })));
  if (laneItems.length === 1) {
    return buildCircuitLayoutPayload({
      title,
      notes,
      source_label: args.source_label,
      stages: [{ kind: "series", items: laneItems[0] }]
    });
  }
  return buildCircuitLayoutPayload({
    title,
    notes,
    source_label: args.source_label,
    stages: [{ kind: "parallel", branches: laneItems.map((items) => ({ items })) }]
  });
}
__name(buildCircuitSceneComponentLayoutPayload, "buildCircuitSceneComponentLayoutPayload");
function sanitizeCircuitPayload(args) {
  const packedKind = String(args.__circuit_kind || "");
  if (packedKind === "template") {
    const templateArgs = { ...args };
    delete templateArgs.__circuit_kind;
    return sanitizeCircuitTemplatePayload(templateArgs);
  }
  if (packedKind === "scene") {
    const sceneArgs = { ...args };
    delete sceneArgs.__circuit_kind;
    return sanitizeCircuitPayloadFromArgs(sceneArgs);
  }
  if (packedKind === "layout") {
    const layoutArgs = { ...args };
    delete layoutArgs.__circuit_kind;
    return buildCircuitLayoutPayload(layoutArgs);
  }
  const sceneComponents = ensureArray(args.scene_components).slice(0, MAX_CIRCUIT_COMPONENTS).map((item, index) => {
    const record = item && typeof item === "object" ? item : {};
    return {
      id: limitText(record.id, `c${index + 1}`, MAX_LABEL_LENGTH),
      type: limitText(record.type, "resistor", 24),
      label: limitText(record.label, "", MAX_LABEL_LENGTH),
      color: limitText(record.color, "#111827", 32),
      orientation: String(record.orientation || "horizontal") === "vertical" ? "vertical" : "horizontal",
      lane: limitText(record.lane, "main", 24),
      order: parseInteger(record.order, index),
      x: record.x === void 0 ? void 0 : parseNumber(record.x, 0),
      y: record.y === void 0 ? void 0 : parseNumber(record.y, 0)
    };
  });
  if (sceneComponents.length > 0) {
    const sceneWires = ensureArray(args.scene_wires).slice(0, MAX_CIRCUIT_WIRES).map((item) => normalizeSceneWire(item));
    const attachments = ensureArray(args.scene_attachments).map((item, index) => normalizeSceneAttachment(item, index));
    const hasExplicitPositions = sceneComponents.some((item) => item.x !== void 0 || item.y !== void 0);
    const hasExtraSceneGeometry = sceneWires.length > 0 || attachments.length > 0;
    if (!hasExplicitPositions && !hasExtraSceneGeometry) {
      return buildCircuitSceneComponentLayoutPayload(args, sceneComponents);
    }
    const title = limitText(args.title, "Circuit diagram", MAX_TITLE_LENGTH);
    const notes2 = ensureArray(args.notes).slice(0, 12).map((note) => limitText(note, "", MAX_LABEL_LENGTH));
    const laneGap = Math.max(64, parseNumber(args.lane_gap, 90));
    const stepX = Math.max(72, parseNumber(args.step_x, 104));
    const laneNames = Array.from(new Set(sceneComponents.map((item) => item.lane)));
    const lanes = new Map(laneNames.map((lane, index) => [lane, 160 + index * laneGap]));
    const components2 = sceneComponents.map((item, index) => ({
      id: item.id,
      type: item.type,
      label: item.label,
      color: item.color,
      orientation: item.orientation,
      x: item.x ?? 154 + item.order * stepX,
      y: item.y ?? (lanes.get(item.lane) ?? 160 + index * laneGap)
    }));
    const laneMap = new Map(sceneComponents.map((item) => [item.id, item.lane]));
    const componentsByLane = laneNames.map((lane) => components2.filter((component) => laneMap.get(component.id) === lane).sort((a, b) => a.x - b.x));
    const wires2 = [];
    componentsByLane.forEach((laneComponents) => {
      if (laneComponents.length === 0) return;
      for (let i = 0; i < laneComponents.length - 1; i += 1) {
        wires2.push(layoutWire(laneComponents[i].x, laneComponents[i].y, laneComponents[i + 1].x, laneComponents[i + 1].y));
      }
    });
    if (componentsByLane.length > 1) {
      const firstLane = componentsByLane[0];
      const lastLane = componentsByLane[componentsByLane.length - 1];
      if (firstLane[0] && lastLane[0]) wires2.push(layoutWire(firstLane[0].x - 44, firstLane[0].y, firstLane[0].x, firstLane[0].y));
      if (firstLane[0] && lastLane[0]) wires2.push(layoutWire(firstLane[0].x - 44, firstLane[0].y, firstLane[0].x - 44, lastLane[0].y));
      if (lastLane.at(-1) && firstLane.at(-1)) wires2.push(layoutWire(firstLane.at(-1).x + 44, firstLane.at(-1).y, firstLane.at(-1).x + 44, lastLane.at(-1).y));
      if (lastLane.at(-1) && firstLane.at(-1)) wires2.push(layoutWire(lastLane.at(-1).x, lastLane.at(-1).y, firstLane.at(-1).x + 44, lastLane.at(-1).y));
    }
    const { extraComponents, extraWires } = buildSceneAttachmentPayload(components2, attachments);
    return {
      title,
      components: [...components2, ...extraComponents],
      wires: [...wires2, ...sceneWires, ...extraWires],
      notes: notes2
    };
  }
  const components = ensureArray(args.components).slice(0, MAX_CIRCUIT_COMPONENTS).map((item, index) => {
    const record = item && typeof item === "object" ? item : {};
    return {
      id: limitText(record.id, `c${index + 1}`, MAX_LABEL_LENGTH),
      x: parseNumber(record.x, 80 + index * 60),
      y: parseNumber(record.y, 180),
      label: limitText(record.label, "", MAX_LABEL_LENGTH),
      type: limitText(record.type, "node", 24),
      color: limitText(record.color, "#111827", 32),
      orientation: String(record.orientation || "horizontal") === "vertical" ? "vertical" : "horizontal"
    };
  });
  const wires = ensureArray(args.wires).slice(0, MAX_CIRCUIT_WIRES).map((item) => {
    const record = item && typeof item === "object" ? item : {};
    return {
      x1: parseNumber(record.x1, 0),
      y1: parseNumber(record.y1, 0),
      x2: parseNumber(record.x2, 0),
      y2: parseNumber(record.y2, 0),
      label: limitText(record.label, "", MAX_LABEL_LENGTH)
    };
  });
  const notes = ensureArray(args.notes).slice(0, 12).map((note) => limitText(note, "", MAX_LABEL_LENGTH));
  if (components.length === 0) throw new Error("components is required");
  if (wires.length === 0) throw new Error("wires is required");
  return {
    title: limitText(args.title, "Circuit diagram", MAX_TITLE_LENGTH),
    components,
    wires,
    notes
  };
}
__name(sanitizeCircuitPayload, "sanitizeCircuitPayload");
function layoutComponentId(prefix, index) {
  return `${prefix}${index + 1}`;
}
__name(layoutComponentId, "layoutComponentId");
function normalizeCircuitLayoutItem(item, fallbackId) {
  const record = item && typeof item === "object" ? item : {};
  return {
    id: limitText(record.id, fallbackId, MAX_LABEL_LENGTH),
    type: limitText(record.type, "resistor", 24),
    label: limitText(record.label, "", MAX_LABEL_LENGTH),
    color: limitText(record.color, "#111827", 32),
    orientation: String(record.orientation || "horizontal") === "vertical" ? "vertical" : "horizontal"
  };
}
__name(normalizeCircuitLayoutItem, "normalizeCircuitLayoutItem");
function normalizeCircuitStages(args) {
  const explicitStages = ensureArray(args.stages).slice(0, MAX_CIRCUIT_LAYOUT_ITEMS + MAX_CIRCUIT_LAYOUT_BRANCHES + 2);
  if (explicitStages.length > 0) {
    return explicitStages.map((stage, stageIndex) => {
      const record = stage && typeof stage === "object" ? stage : {};
      const kind = String(record.kind || "series") === "parallel" ? "parallel" : "series";
      if (kind === "parallel") {
        const branches = ensureArray(record.branches).slice(0, MAX_CIRCUIT_LAYOUT_BRANCHES).map((branch, branchIndex) => {
          const branchRecord = branch && typeof branch === "object" ? branch : {};
          return ensureArray(branchRecord.items).slice(0, MAX_CIRCUIT_LAYOUT_ITEMS).map((item, itemIndex) => normalizeCircuitLayoutItem(item, `p${stageIndex + 1}_${branchIndex + 1}_${itemIndex + 1}`));
        }).filter((items2) => items2.length > 0);
        if (branches.length === 0) throw new Error(`parallel stage ${stageIndex + 1} requires branches`);
        return { kind: "parallel", branches };
      }
      const items = ensureArray(record.items).slice(0, MAX_CIRCUIT_LAYOUT_ITEMS).map((item, itemIndex) => normalizeCircuitLayoutItem(item, `s${stageIndex + 1}_${itemIndex + 1}`));
      if (items.length === 0) throw new Error(`series stage ${stageIndex + 1} requires items`);
      return { kind: "series", items };
    });
  }
  const rowItems = ensureArray(args.row).slice(0, MAX_CIRCUIT_LAYOUT_ITEMS).map((item, index) => normalizeCircuitLayoutItem(item, `row_${index + 1}`));
  const branchRows = ensureArray(args.branches).slice(0, MAX_CIRCUIT_LAYOUT_BRANCHES).map((branch, branchIndex) => {
    const record = branch && typeof branch === "object" ? branch : {};
    return ensureArray(record.items).slice(0, MAX_CIRCUIT_LAYOUT_ITEMS).map((item, itemIndex) => normalizeCircuitLayoutItem(item, `branch_${branchIndex + 1}_${itemIndex + 1}`));
  }).filter((items) => items.length > 0);
  const returnItems = ensureArray(args.return_path).slice(0, MAX_CIRCUIT_LAYOUT_ITEMS).map((item, index) => normalizeCircuitLayoutItem(item, `return_${index + 1}`));
  const stages = [];
  if (rowItems.length > 0) stages.push({ kind: "series", items: rowItems });
  if (branchRows.length > 0) stages.push({ kind: "parallel", branches: branchRows });
  if (returnItems.length > 0) stages.push({ kind: "series", items: returnItems });
  return stages;
}
__name(normalizeCircuitStages, "normalizeCircuitStages");
function buildCircuitLayoutGeometry(stages, sourceLabel) {
  if (stages.length === 0) {
    throw new Error("layout requires stages or row/branches/return_path items");
  }
  const components = [
    { id: "src", type: "battery", x: 110, y: 300, label: sourceLabel, color: "#111827", orientation: "vertical" }
  ];
  const wires = [];
  const mainY = 170;
  const returnY = 420;
  const seriesStepX = 112;
  const stageGapX = 44;
  const branchEntryInset = 54;
  const branchExitInset = 36;
  const branchGapY = 84;
  const entryX = 196;
  let componentIndex = 0;
  let currentX = entryX;
  wires.push(layoutWire(110, 276, 110, mainY));
  wires.push(layoutWire(110, mainY, entryX, mainY));
  const addSeriesStage = /* @__PURE__ */ __name((items) => {
    let previousX = currentX;
    items.forEach((item) => {
      const x = previousX + seriesStepX;
      components.push(layoutComponentFromItem(item, componentIndex, x, mainY, "resistor"));
      componentIndex += 1;
      wires.push(layoutWire(previousX, mainY, x, mainY));
      previousX = x;
    });
    currentX = previousX;
  }, "addSeriesStage");
  const addParallelStage = /* @__PURE__ */ __name((branches) => {
    const branchCount = branches.length;
    const maxItems = Math.max(...branches.map((items) => items.length));
    const compactBranchGapY = branchCount <= 2 ? 72 : branchCount === 3 ? 78 : branchGapY;
    const leftBusX = currentX + stageGapX;
    const branchSpanX = Math.max(0, (maxItems - 1) * seriesStepX);
    const rightBusX = leftBusX + Math.max(120, branchEntryInset + branchSpanX + branchExitInset);
    const startY = mainY - (branchCount - 1) * compactBranchGapY / 2;
    const branchYs = branches.map((_, index) => startY + index * compactBranchGapY);
    const topBusY = Math.min(...branchYs);
    const bottomBusY = Math.max(...branchYs);
    wires.push(layoutWire(currentX, mainY, leftBusX, mainY));
    if (topBusY !== mainY) wires.push(layoutWire(leftBusX, mainY, leftBusX, topBusY));
    if (bottomBusY !== topBusY) wires.push(layoutWire(leftBusX, topBusY, leftBusX, bottomBusY));
    if (topBusY !== mainY) wires.push(layoutWire(rightBusX, topBusY, rightBusX, bottomBusY));
    else if (bottomBusY !== mainY) wires.push(layoutWire(rightBusX, mainY, rightBusX, bottomBusY));
    branches.forEach((items, branchIndex) => {
      const y = branchYs[branchIndex];
      let previousX = leftBusX;
      items.forEach((item, itemIndex) => {
        const x = leftBusX + branchEntryInset + itemIndex * seriesStepX;
        components.push(layoutComponentFromItem(item, componentIndex, x, y, "resistor"));
        componentIndex += 1;
        wires.push(layoutWire(previousX, y, x, y));
        previousX = x;
      });
      wires.push(layoutWire(previousX, y, rightBusX, y));
    });
    if (topBusY !== mainY) wires.push(layoutWire(rightBusX, topBusY, rightBusX, mainY));
    else if (bottomBusY !== mainY) wires.push(layoutWire(rightBusX, bottomBusY, rightBusX, mainY));
    currentX = rightBusX;
  }, "addParallelStage");
  stages.forEach((stage) => {
    if (stage.kind === "series") {
      addSeriesStage(stage.items);
    } else {
      addParallelStage(stage.branches);
    }
  });
  const exitX = currentX + stageGapX;
  wires.push(layoutWire(currentX, mainY, exitX, mainY));
  wires.push(layoutWire(exitX, mainY, exitX, returnY));
  wires.push(layoutWire(exitX, returnY, 110, returnY));
  wires.push(layoutWire(110, returnY, 110, 324));
  return { components, wires };
}
__name(buildCircuitLayoutGeometry, "buildCircuitLayoutGeometry");
function layoutComponentFromItem(item, index, x, y, fallbackType = "resistor") {
  return {
    id: limitText(item.id, layoutComponentId("n", index), MAX_LABEL_LENGTH),
    type: limitText(item.type, fallbackType, 24),
    x,
    y,
    label: limitText(item.label, "", MAX_LABEL_LENGTH),
    color: limitText(item.color, "#111827", 32),
    orientation: String(item.orientation || "horizontal") === "vertical" ? "vertical" : "horizontal"
  };
}
__name(layoutComponentFromItem, "layoutComponentFromItem");
function layoutWire(x1, y1, x2, y2, label = "") {
  return { x1, y1, x2, y2, label };
}
__name(layoutWire, "layoutWire");
function buildCircuitLayoutPayload(args) {
  const title = limitText(args.title, "Auto layout circuit", MAX_TITLE_LENGTH);
  const notes = ensureArray(args.notes).slice(0, 12).map((note) => limitText(note, "", MAX_LABEL_LENGTH));
  const sourceLabel = limitText(args.source_label, "\u7535\u6E90", MAX_LABEL_LENGTH);
  const stages = normalizeCircuitStages(args);
  const { components, wires } = buildCircuitLayoutGeometry(stages, sourceLabel);
  return sanitizeCircuitPayload({
    title,
    components,
    wires,
    notes
  });
}
__name(buildCircuitLayoutPayload, "buildCircuitLayoutPayload");
function sanitizeCircuitPayloadFromArgs(args) {
  if (args.__circuit_kind) {
    return sanitizeCircuitPayload(args);
  }
  if (Array.isArray(args.components) && Array.isArray(args.wires)) {
    return sanitizeCircuitPayload(args);
  }
  if (Array.isArray(args.scene_components) || Array.isArray(args.lanes)) {
    return Array.isArray(args.lanes) ? buildCircuitScenePayload(args) : sanitizeCircuitPayload(args);
  }
  if (Array.isArray(args.stages) || Array.isArray(args.row) || Array.isArray(args.branches) || Array.isArray(args.return_path)) {
    return buildCircuitLayoutPayload(args);
  }
  return buildCircuitLayoutPayload(args);
}
__name(sanitizeCircuitPayloadFromArgs, "sanitizeCircuitPayloadFromArgs");
function buildCompactCircuitLinkPayload(args, mode) {
  if (mode === "template") {
    return {
      __circuit_kind: "template",
      template: limitText(args.template, "series", 24),
      title: args.title === void 0 ? void 0 : limitText(args.title, "", MAX_TITLE_LENGTH),
      source_label: args.source_label === void 0 ? void 0 : limitText(args.source_label, "", MAX_LABEL_LENGTH),
      resistor_label: args.resistor_label === void 0 ? void 0 : limitText(args.resistor_label, "", MAX_LABEL_LENGTH),
      resistor_label_2: args.resistor_label_2 === void 0 ? void 0 : limitText(args.resistor_label_2, "", MAX_LABEL_LENGTH),
      lamp_label: args.lamp_label === void 0 ? void 0 : limitText(args.lamp_label, "", MAX_LABEL_LENGTH),
      switch_label: args.switch_label === void 0 ? void 0 : limitText(args.switch_label, "", MAX_LABEL_LENGTH),
      notes: ensureArray(args.notes).slice(0, 12).map((item) => limitText(item, "", MAX_LABEL_LENGTH))
    };
  }
  if (mode === "scene") {
    return {
      __circuit_kind: "scene",
      title: limitText(args.title, "Circuit diagram", MAX_TITLE_LENGTH),
      notes: ensureArray(args.notes).slice(0, 12).map((item) => limitText(item, "", MAX_LABEL_LENGTH)),
      scene_components: ensureArray(args.scene_components).slice(0, MAX_CIRCUIT_COMPONENTS),
      scene_wires: ensureArray(args.scene_wires).slice(0, MAX_CIRCUIT_WIRES),
      scene_attachments: ensureArray(args.scene_attachments).slice(0, MAX_CIRCUIT_WIRES),
      lane_gap: parseNumber(args.lane_gap, 100),
      step_x: parseNumber(args.step_x, 120)
    };
  }
  if (mode === "layout") {
    return {
      __circuit_kind: "layout",
      title: limitText(args.title, "Auto layout circuit", MAX_TITLE_LENGTH),
      notes: ensureArray(args.notes).slice(0, 12).map((item) => limitText(item, "", MAX_LABEL_LENGTH)),
      source_label: limitText(args.source_label, "\u7535\u6E90", MAX_LABEL_LENGTH),
      stages: ensureArray(args.stages).slice(0, MAX_CIRCUIT_LAYOUT_ITEMS + MAX_CIRCUIT_LAYOUT_BRANCHES + 2),
      row: ensureArray(args.row).slice(0, MAX_CIRCUIT_LAYOUT_ITEMS),
      branches: ensureArray(args.branches).slice(0, MAX_CIRCUIT_LAYOUT_BRANCHES),
      return_path: ensureArray(args.return_path).slice(0, MAX_CIRCUIT_LAYOUT_ITEMS)
    };
  }
  return sanitizeCircuitPayloadFromArgs(args);
}
__name(buildCompactCircuitLinkPayload, "buildCompactCircuitLinkPayload");
function classifyCircuitLinkPayload(args) {
  if (typeof args.template === "string") return "template";
  if (Array.isArray(args.scene_components) || Array.isArray(args.lanes)) return "scene";
  if (Array.isArray(args.stages) || Array.isArray(args.row) || Array.isArray(args.branches) || Array.isArray(args.return_path)) return "layout";
  return "expanded";
}
__name(classifyCircuitLinkPayload, "classifyCircuitLinkPayload");
function sanitizeCircuitTemplatePayload(args) {
  const template = limitText(args.template, "series", 24);
  const title = limitText(args.title, `${template} circuit`, MAX_TITLE_LENGTH);
  const sourceLabel = limitText(args.source_label, "\u7535\u6E90", MAX_LABEL_LENGTH);
  const resistorLabel = limitText(args.resistor_label, "R1", MAX_LABEL_LENGTH);
  const resistorLabel2 = limitText(args.resistor_label_2, "R2", MAX_LABEL_LENGTH);
  const lampLabel = limitText(args.lamp_label, "\u706F\u6CE1 L", MAX_LABEL_LENGTH);
  const switchLabel = limitText(args.switch_label, "\u5F00\u5173 S", MAX_LABEL_LENGTH);
  const noteList = ensureArray(args.notes).slice(0, 12).map((item) => limitText(item, "", MAX_LABEL_LENGTH));
  if (template === "parallel") {
    return buildCircuitScenePayload({
      title,
      notes: noteList.length ? noteList : ["\u5E76\u8054\u652F\u8DEF\u5171\u4EAB\u7535\u6E90\u4E24\u7AEF"],
      lanes: [
        { name: "main", items: [{ id: "bat", type: "battery", label: sourceLabel }] },
        { name: "branch1", items: [{ id: "r1", type: "resistor", label: resistorLabel }] },
        { name: "branch2", items: [{ id: "r2", type: "resistor", label: resistorLabel2 }] }
      ]
    });
  }
  if (template === "switch_lamp") {
    return buildCircuitScenePayload({
      title,
      notes: noteList.length ? noteList : ["\u5F00\u5173\u95ED\u5408\u65F6\u706F\u6CE1\u5BFC\u901A"],
      lanes: [
        {
          name: "main",
          items: [
            { id: "bat", type: "battery", label: sourceLabel },
            { id: "sw", type: "switch", label: switchLabel },
            { id: "lamp", type: "lamp", label: lampLabel }
          ]
        }
      ]
    });
  }
  if (template === "source_resistor") {
    return buildCircuitScenePayload({
      title,
      notes: noteList.length ? noteList : ["\u57FA\u7840\u7535\u6E90-\u7535\u963B\u56DE\u8DEF"],
      lanes: [
        {
          name: "main",
          items: [
            { id: "bat", type: "battery", label: sourceLabel },
            { id: "r1", type: "resistor", label: resistorLabel },
            { id: "gnd", type: "ground", label: "\u5730" }
          ]
        }
      ]
    });
  }
  if (template === "transistor_switch") {
    return buildCircuitScenePayload({
      title,
      notes: noteList.length ? noteList : ["\u57FA\u6781\u7ECF\u7535\u963B\u9A71\u52A8\u4E09\u6781\u7BA1\u5F00\u5173"],
      lanes: [
        {
          name: "main",
          items: [
            { id: "bat", type: "battery", label: sourceLabel, x: 110, y: 160 },
            { id: "rb", type: "resistor", label: resistorLabel || "Rb", x: 260, y: 160 },
            { id: "q1", type: "transistor", label: "Q1", x: 430, y: 230 },
            { id: "load", type: "lamp", label: lampLabel || "\u8D1F\u8F7D", x: 580, y: 160 }
          ]
        }
      ],
      scene_attachments: [
        { type: "base_feed", source: "rb", target: "q1", label: "B" },
        { type: "return_rail", source: "q1", target: "bat", y: 360 }
      ],
      scene_wires: [
        { x1: 430, y1: 206, x2: 430, y2: 160 },
        { x1: 580, y1: 160, x2: 580, y2: 160 }
      ]
    });
  }
  if (template === "relay_driver") {
    return buildCircuitScenePayload({
      title,
      notes: noteList.length ? noteList : ["\u7EE7\u7535\u5668\u7EBF\u5708\u5E76\u8054\u7EED\u6D41\u4E8C\u6781\u7BA1"],
      lanes: [
        {
          name: "main",
          items: [
            { id: "bat", type: "battery", label: sourceLabel, x: 110, y: 160 },
            { id: "rb", type: "resistor", label: resistorLabel || "Rb", x: 250, y: 160 },
            { id: "q1", type: "transistor", label: "Q1", x: 400, y: 230 },
            { id: "relay", type: "relay", label: "K1", x: 560, y: 160 },
            { id: "d1", type: "diode", label: "D1", x: 560, y: 100 }
          ]
        }
      ],
      scene_attachments: [
        { type: "base_feed", source: "rb", target: "q1", label: "B" },
        { type: "return_rail", source: "q1", target: "bat", y: 360 }
      ],
      scene_wires: [
        { x1: 400, y1: 206, x2: 400, y2: 160 },
        { x1: 560, y1: 116, x2: 560, y2: 144 },
        { x1: 530, y1: 100, x2: 590, y2: 100 },
        { x1: 530, y1: 100, x2: 530, y2: 160 },
        { x1: 590, y1: 100, x2: 590, y2: 160 }
      ]
    });
  }
  if (template === "buzzer_loop") {
    return buildCircuitScenePayload({
      title,
      notes: noteList.length ? noteList : ["\u5F00\u5173\u95ED\u5408\u540E\u8702\u9E23\u5668\u56DE\u8DEF\u5BFC\u901A"],
      lanes: [
        {
          name: "main",
          items: [
            { id: "bat", type: "battery", label: sourceLabel },
            { id: "sw", type: "switch", label: switchLabel },
            { id: "bz", type: "buzzer", label: lampLabel || "\u8702\u9E23\u5668" },
            { id: "r1", type: "resistor", label: resistorLabel }
          ]
        }
      ],
      scene_attachments: [
        { type: "return_rail", source: "r1", target: "bat", y: 360 }
      ]
    });
  }
  if (template === "opamp_follower") {
    return buildCircuitScenePayload({
      title,
      notes: noteList.length ? noteList : ["\u8F93\u51FA\u76F4\u63A5\u53CD\u9988\u5230\u53CD\u76F8\u7AEF\u7684\u7535\u538B\u8DDF\u968F\u5668"],
      lanes: [
        {
          name: "main",
          items: [
            { id: "src", type: "source", label: "Vin", x: 120, y: 180 },
            { id: "op1", type: "opamp", label: "A1", x: 380, y: 240 },
            { id: "load", type: "lamp", label: lampLabel || "Vout", x: 600, y: 240 }
          ]
        }
      ],
      scene_attachments: [
        { type: "feedback", source: "load", target: "op1", y: 360, label: "\u53CD\u9988" }
      ],
      scene_wires: [
        { x1: 120, y1: 180, x2: 220, y2: 180 },
        { x1: 220, y1: 180, x2: 220, y2: 216, label: "+" },
        { x1: 220, y1: 216, x2: 356, y2: 216 }
      ]
    });
  }
  if (template === "led_resistor") {
    return buildCircuitScenePayload({
      title,
      notes: noteList.length ? noteList : ["LED \u524D\u4E32\u8054\u9650\u6D41\u7535\u963B"],
      lanes: [
        {
          name: "main",
          items: [
            { id: "bat", type: "battery", label: sourceLabel },
            { id: "r1", type: "resistor", label: resistorLabel },
            { id: "led", type: "led", label: lampLabel || "LED" }
          ]
        }
      ]
    });
  }
  if (template === "meter_loop") {
    return buildCircuitScenePayload({
      title,
      notes: noteList.length ? noteList : ["\u7535\u6D41\u8868\u4E32\u8054\uFF0C\u7535\u538B\u8868\u8DE8\u63A5\u7535\u963B\u4E24\u7AEF"],
      lanes: [
        {
          name: "main",
          items: [
            { id: "bat", type: "battery", label: sourceLabel },
            { id: "amm", type: "ammeter", label: "A" },
            { id: "r1", type: "resistor", label: resistorLabel }
          ]
        }
      ],
      scene_attachments: [
        { type: "voltmeter_parallel", target: "r1", label: "V" },
        { type: "return_rail", source: "r1", target: "bat", y: 360 }
      ]
    });
  }
  return buildCircuitScenePayload({
    title,
    notes: noteList.length ? noteList : ["\u4E32\u8054\u7535\u8DEF\u4E2D\u7535\u6D41\u4F9D\u6B21\u6D41\u8FC7\u5404\u5143\u4EF6"],
    lanes: [
      {
        name: "main",
        items: [
          { id: "bat", type: "battery", label: sourceLabel },
          { id: "r1", type: "resistor", label: resistorLabel },
          { id: "lamp", type: "lamp", label: lampLabel }
        ]
      }
    ]
  });
}
__name(sanitizeCircuitTemplatePayload, "sanitizeCircuitTemplatePayload");
function normalizeShape3DPoint(item, path = "point") {
  if (Array.isArray(item)) {
    if (item.length < 3) throw new Error(`${path} must contain 3 numbers`);
    return {
      x: parseNumber(item[0], 0),
      y: parseNumber(item[1], 0),
      z: parseNumber(item[2], 0),
      label: ""
    };
  }
  if (!item || typeof item !== "object") throw new Error(`${path} must be a [x,y,z] array or { x, y, z } object`);
  const record = item;
  const hasCoords = record.x !== void 0 && record.y !== void 0 && record.z !== void 0;
  if (!hasCoords) throw new Error(`${path} must include x, y, and z`);
  return {
    x: parseNumber(record.x, 0),
    y: parseNumber(record.y, 0),
    z: parseNumber(record.z, 0),
    label: limitText(record.label, "", MAX_LABEL_LENGTH)
  };
}
__name(normalizeShape3DPoint, "normalizeShape3DPoint");
function normalizeShape3DPointSet(item, index, fallbackColor) {
  const record = item && typeof item === "object" ? item : {};
  const rawPoints = ensureArray(record.points);
  if (rawPoints.length < 1) throw new Error(`points[${index}] must include a points array`);
  const points = rawPoints.slice(0, MAX_3D_POINTS).map((point, pointIndex) => normalizeShape3DPoint(point, `points[${index}].points[${pointIndex}]`));
  if (points.length < 1) throw new Error(`points[${index}] must include at least 1 point`);
  return {
    label: limitText(record.label, `points${index + 1}`, MAX_LABEL_LENGTH),
    color: limitText(record.color, fallbackColor, 32),
    size: Math.max(2, Math.min(14, parseNumber(record.size, 5))),
    labels: Boolean(record.labels),
    points
  };
}
__name(normalizeShape3DPointSet, "normalizeShape3DPointSet");
function sanitizeShapePayload(args) {
  const allowedShapes = /* @__PURE__ */ new Set(["cube", "sphere", "cylinder", "cone", "vector3d", "surface3d"]);
  const allowedColorScales = /* @__PURE__ */ new Set(["Viridis", "Cividis", "Turbo", "Jet", "Plasma"]);
  const shape = String(args.shape || "cube");
  const safeShape = allowedShapes.has(shape) ? shape : "cube";
  const xMin = parseNumber(args.x_min, -3);
  const xMax = parseNumber(args.x_max, 3);
  const yMin = parseNumber(args.y_min, -3);
  const yMax = parseNumber(args.y_max, 3);
  const baseColor = limitText(args.color, "#4f46e5", 32);
  const defaultSamples = Math.max(8, Math.min(MAX_SURFACE_SAMPLES, parseInteger(args.samples, 36)));
  const defaultColorScaleInput = String(args.colorscale || "Viridis");
  const defaultColorScale = allowedColorScales.has(defaultColorScaleInput) ? defaultColorScaleInput : "Viridis";
  const surfaces = ensureArray(args.surfaces).slice(0, MAX_3D_SURFACES).map((item, index) => {
    const record = item && typeof item === "object" ? item : {};
    const expr = limitText(record.expr, "", 400);
    if (!expr) throw new Error(`surfaces[${index}].expr is required`);
    const surfaceXMin = parseNumber(record.x_min, xMin);
    const surfaceXMax = parseNumber(record.x_max, xMax);
    const surfaceYMin = parseNumber(record.y_min, yMin);
    const surfaceYMax = parseNumber(record.y_max, yMax);
    if (!(surfaceXMax > surfaceXMin)) throw new Error(`surfaces[${index}].x_max must be greater than x_min`);
    if (!(surfaceYMax > surfaceYMin)) throw new Error(`surfaces[${index}].y_max must be greater than y_min`);
    const scaleInput = String(record.colorscale || defaultColorScale);
    return {
      expr,
      label: limitText(record.label, `f${index + 1}(x,y)`, MAX_LABEL_LENGTH),
      color: limitText(record.color, baseColor, 32),
      colorscale: allowedColorScales.has(scaleInput) ? scaleInput : defaultColorScale,
      show_scale: record.show_scale === void 0 ? args.show_scale !== false : record.show_scale !== false,
      show_contours: record.show_contours === void 0 ? Boolean(args.show_contours) : Boolean(record.show_contours),
      x_min: surfaceXMin,
      x_max: surfaceXMax,
      y_min: surfaceYMin,
      y_max: surfaceYMax,
      z_min: record.z_min === void 0 ? args.z_min === void 0 ? null : parseNumber(args.z_min, 0) : parseNumber(record.z_min, 0),
      z_max: record.z_max === void 0 ? args.z_max === void 0 ? null : parseNumber(args.z_max, 0) : parseNumber(record.z_max, 0),
      samples: Math.max(8, Math.min(MAX_SURFACE_SAMPLES, parseInteger(record.samples, defaultSamples))),
      opacity: Math.max(0.15, Math.min(1, parseNumber(record.opacity, 0.88)))
    };
  });
  const lines = ensureArray(args.lines).slice(0, MAX_3D_LINES).map((item, index) => {
    const record = item && typeof item === "object" ? item : {};
    const rawPoints2 = ensureArray(record.points);
    if (rawPoints2.length < 2) throw new Error(`lines[${index}] must include a points array with at least 2 points`);
    const points = rawPoints2.slice(0, MAX_3D_LINE_POINTS).map((point, pointIndex) => normalizeShape3DPoint(point, `lines[${index}].points[${pointIndex}]`));
    if (points.length < 2) throw new Error(`lines[${index}] must include at least 2 points`);
    return {
      label: limitText(record.label, `line${index + 1}`, MAX_LABEL_LENGTH),
      color: limitText(record.color, baseColor, 32),
      width: Math.max(1, Math.min(10, parseNumber(record.width, 5))),
      points
    };
  });
  const rawPoints = ensureArray(args.points);
  const hasPointSetObjects = rawPoints.some((item) => item && typeof item === "object" && !Array.isArray(item) && Array.isArray(item.points));
  const hasDirectPoints = rawPoints.some((item) => Array.isArray(item) || item && typeof item === "object" && !Array.isArray(item.points));
  if (hasPointSetObjects && hasDirectPoints) throw new Error("points must be either a direct point list or an array of point-set objects, not both");
  const pointSets = hasPointSetObjects ? rawPoints.slice(0, MAX_3D_LINES).map((item, index) => normalizeShape3DPointSet(item, index, baseColor)) : rawPoints.length > 0 ? [{
    label: "points",
    color: baseColor,
    size: 5,
    labels: rawPoints.some((item) => !Array.isArray(item) && Boolean(item.label)),
    points: rawPoints.slice(0, MAX_3D_POINTS).map((item, index) => normalizeShape3DPoint(item, `points[${index}]`))
  }] : [];
  if (safeShape === "surface3d") {
    const expr = limitText(args.expr, "sin(x) * cos(y)", 400);
    if (!(xMax > xMin)) throw new Error("x_max must be greater than x_min");
    if (!(yMax > yMin)) throw new Error("y_max must be greater than y_min");
    const normalizedSurfaces = surfaces.length > 0 ? surfaces : [{
      expr,
      label: limitText(args.title, "surface", MAX_LABEL_LENGTH),
      color: baseColor,
      colorscale: defaultColorScale,
      show_scale: args.show_scale !== false,
      show_contours: Boolean(args.show_contours),
      x_min: xMin,
      x_max: xMax,
      y_min: yMin,
      y_max: yMax,
      z_min: args.z_min === void 0 ? null : parseNumber(args.z_min, 0),
      z_max: args.z_max === void 0 ? null : parseNumber(args.z_max, 0),
      samples: defaultSamples,
      opacity: 0.9
    }];
    return {
      shape: safeShape,
      title: limitText(args.title, "3D Function Surface", MAX_TITLE_LENGTH),
      expr,
      x_min: xMin,
      x_max: xMax,
      y_min: yMin,
      y_max: yMax,
      samples: defaultSamples,
      colorscale: defaultColorScale,
      show_scale: args.show_scale !== false,
      show_contours: Boolean(args.show_contours),
      z_min: args.z_min === void 0 ? null : parseNumber(args.z_min, 0),
      z_max: args.z_max === void 0 ? null : parseNumber(args.z_max, 0),
      color: baseColor,
      surfaces: normalizedSurfaces,
      lines,
      points: pointSets
    };
  }
  return {
    shape: safeShape,
    title: limitText(args.title, "3D Shape", MAX_TITLE_LENGTH),
    size: parseNumber(args.size, 1),
    radius: parseNumber(args.radius, 1),
    height: parseNumber(args.height, 2),
    vector: ensureArray(args.vector).slice(0, 3).map((value) => parseNumber(value, 0)),
    color: baseColor,
    surfaces,
    lines,
    points: pointSets
  };
}
__name(sanitizeShapePayload, "sanitizeShapePayload");
function normalizePayload(args, path) {
  if (path === "/plot") {
    return {
      __path: "/plot",
      expr: String(args.expr || ""),
      pieces: ensureArray(args.pieces).map((item) => {
        const record = item && typeof item === "object" ? item : {};
        return {
          expr: String(record.expr || ""),
          x_min: parseNumber(record.x_min, -10),
          x_max: parseNumber(record.x_max, 10),
          label: limitText(record.label, "", MAX_LABEL_LENGTH),
          name: limitText(record.name, "", MAX_LABEL_LENGTH),
          color: limitText(record.color, "", 32)
        };
      }),
      x_min: parseNumber(args.x_min, -10),
      x_max: parseNumber(args.x_max, 10),
      points: parseInteger(args.points, 1e3),
      title: limitText(args.title, "Function Plot", MAX_TITLE_LENGTH),
      xlabel: limitText(args.xlabel, "x", MAX_LABEL_LENGTH),
      ylabel: limitText(args.ylabel, "y", MAX_LABEL_LENGTH),
      grid: args.grid ?? true,
      annotations: ensureArray(args.annotations).slice(0, 24)
    };
  }
  if (path === "/plot_multi") {
    return {
      __path: "/plot_multi",
      exprs: ensureArray(args.exprs).map((item) => String(item)),
      labels: Array.isArray(args.labels) ? ensureArray(args.labels).map((item) => limitText(item, "", MAX_LABEL_LENGTH)) : args.labels ?? null,
      x_min: parseNumber(args.x_min, -10),
      x_max: parseNumber(args.x_max, 10),
      points: parseInteger(args.points, 1e3),
      title: limitText(args.title, "Multi Function Plot", MAX_TITLE_LENGTH),
      xlabel: limitText(args.xlabel, "x", MAX_LABEL_LENGTH),
      ylabel: limitText(args.ylabel, "y", MAX_LABEL_LENGTH),
      grid: args.grid ?? true,
      annotations: ensureArray(args.annotations).slice(0, 24)
    };
  }
  if (path === "/plot_bar") {
    return {
      __path: "/plot_bar",
      categories: ensureArray(args.categories).map((item) => limitText(item, "", MAX_LABEL_LENGTH)),
      values: ensureArray(args.values).map((item) => parseNumber(item, Number.NaN)),
      title: limitText(args.title, "Bar Chart", MAX_TITLE_LENGTH),
      xlabel: limitText(args.xlabel, "Category", MAX_LABEL_LENGTH),
      ylabel: limitText(args.ylabel, "Value", MAX_LABEL_LENGTH),
      grid: args.grid ?? true,
      annotations: ensureArray(args.annotations).slice(0, 24)
    };
  }
  return {
    __path: "/plot_series",
    series: ensureArray(args.series),
    title: limitText(args.title, "Series Plot", MAX_TITLE_LENGTH),
    xlabel: limitText(args.xlabel, "x", MAX_LABEL_LENGTH),
    ylabel: limitText(args.ylabel, "y", MAX_LABEL_LENGTH),
    grid: args.grid ?? true,
    annotations: ensureArray(args.annotations).slice(0, 24)
  };
}
__name(normalizePayload, "normalizePayload");
function isSupportedShortLinkPath(path) {
  return path === "/png" || path === "/force.svg" || path === "/force-analysis.svg" || path === "/circuit.svg" || path === "/venn.svg" || path === "/c-memory.svg" || path === "/shape3d.html";
}
__name(isSupportedShortLinkPath, "isSupportedShortLinkPath");
function shortLinkUrl(origin, token) {
  return `${origin}${SHORT_LINK_PATH_PREFIX}${token}`;
}
__name(shortLinkUrl, "shortLinkUrl");
function createShortLinkToken() {
  const bytes = crypto.getRandomValues(new Uint8Array(SHORT_LINK_TOKEN_LENGTH));
  return Array.from(bytes, (byte) => (byte % 36).toString(36)).join("");
}
__name(createShortLinkToken, "createShortLinkToken");
async function storeShortLink(env, path, payload) {
  if (!isSupportedShortLinkPath(path)) throw new Error("unsupported_short_link_path");
  const record = { path, payload };
  for (let attempt = 0; attempt < 4; attempt += 1) {
    const token = createShortLinkToken();
    const key = `short:${token}`;
    const existing = await env.SHORT_LINKS.get(key);
    if (existing) continue;
    await env.SHORT_LINKS.put(key, JSON.stringify(record), {
      expirationTtl: SHORT_LINK_TTL_SECONDS
    });
    return token;
  }
  throw new Error("short_link_token_generation_failed");
}
__name(storeShortLink, "storeShortLink");
async function buildShortUrl(env, path, payload, origin) {
  const packed = await toCompressedBase64UrlFromJson(payload);
  if (packed.length <= 3600) return `${origin}${path}?d=${packed}`;
  const token = await storeShortLink(env, path, payload);
  return shortLinkUrl(origin, token);
}
__name(buildShortUrl, "buildShortUrl");
async function buildPlotLinkData(payload, origin, env) {
  const warnings = collectPayloadWarnings(payload);
  return {
    ok: true,
    kind: "plot",
    title: limitText(payload.title, "Plot", MAX_TITLE_LENGTH),
    warnings,
    mime_type: "image/png",
    png_url: await buildShortUrl(env, "/png", payload, origin),
    payload
  };
}
__name(buildPlotLinkData, "buildPlotLinkData");
function collectPayloadWarnings(payload) {
  return [payload.warning].filter((item) => typeof item === "string" && item.length > 0);
}
__name(collectPayloadWarnings, "collectPayloadWarnings");
async function buildSvgLinkData(env, path, payload, origin, titleFallback) {
  return {
    ok: true,
    kind: "diagram",
    title: limitText(payload.title, titleFallback, MAX_TITLE_LENGTH),
    warnings: collectPayloadWarnings(payload),
    svg_url: await buildShortUrl(env, path, payload, origin),
    payload
  };
}
__name(buildSvgLinkData, "buildSvgLinkData");
async function buildHtmlLinkData(env, path, payload, origin, titleFallback) {
  return {
    ok: true,
    kind: "html3d",
    title: limitText(payload.title, titleFallback, MAX_TITLE_LENGTH),
    warnings: collectPayloadWarnings(payload),
    html_url: await buildShortUrl(env, path, payload, origin),
    payload
  };
}
__name(buildHtmlLinkData, "buildHtmlLinkData");
async function pngLinkPayload(args, path, origin, env) {
  const payload = normalizePayload(args, path);
  buildSpecFromPayload(payload);
  return buildPlotLinkData(payload, origin, env);
}
__name(pngLinkPayload, "pngLinkPayload");
async function resolveShortLink(env, token) {
  const key = `short:${token}`;
  const raw = await env.SHORT_LINKS.get(key);
  if (!raw) return null;
  const record = JSON.parse(raw);
  if (!record || typeof record !== "object" || !isSupportedShortLinkPath(String(record.path)) || !record.payload || typeof record.payload !== "object") {
    throw new Error("bad_short_link_record");
  }
  return record;
}
__name(resolveShortLink, "resolveShortLink");
async function renderShortLink(record, env) {
  if (record.path === "/png") {
    const spec = buildSpecFromPayload(record.payload);
    return renderPngResponse(renderPlotSvg(spec), env);
  }
  if (record.path === "/force.svg") {
    return new Response(renderForceDiagramSvg(record.payload), {
      status: 200,
      headers: { "content-type": "image/svg+xml; charset=utf-8", "cache-control": "public, max-age=300", "access-control-allow-origin": "*" }
    });
  }
  if (record.path === "/force-analysis.svg") {
    return new Response(renderForceAnalysisSvg(record.payload), {
      status: 200,
      headers: { "content-type": "image/svg+xml; charset=utf-8", "cache-control": "public, max-age=300", "access-control-allow-origin": "*" }
    });
  }
  if (record.path === "/circuit.svg") {
    return new Response(renderCircuitDiagramSvg(sanitizeCircuitPayloadFromArgs(record.payload)), {
      status: 200,
      headers: { "content-type": "image/svg+xml; charset=utf-8", "cache-control": "public, max-age=300", "access-control-allow-origin": "*" }
    });
  }
  if (record.path === "/venn.svg") {
    return new Response(renderVennDiagramSvg(record.payload), {
      status: 200,
      headers: { "content-type": "image/svg+xml; charset=utf-8", "cache-control": "public, max-age=300", "access-control-allow-origin": "*" }
    });
  }
  if (record.path === "/c-memory.svg") {
    return new Response(renderCMemoryDiagramSvg(record.payload), {
      status: 200,
      headers: { "content-type": "image/svg+xml; charset=utf-8", "cache-control": "public, max-age=300", "access-control-allow-origin": "*" }
    });
  }
  if (record.path === "/shape3d.html") {
    return new Response(renderShape3DHtml(record.payload), {
      status: 200,
      headers: { "content-type": "text/html; charset=utf-8", "cache-control": "public, max-age=300", "access-control-allow-origin": "*" }
    });
  }
  return Response.json({ ok: false, error: "bad_short_link_record" }, { status: 400, headers: corsHeaders() });
}
__name(renderShortLink, "renderShortLink");
function getTeachingParams(args) {
  return args.params && typeof args.params === "object" ? args.params : {};
}
__name(getTeachingParams, "getTeachingParams");
function buildTeachingPlotPayload(args) {
  const topic = limitText(args.topic, "parabola", 32);
  const params = getTeachingParams(args);
  const title = limitText(args.title, "Teaching template", MAX_TITLE_LENGTH);
  const highlight = args.highlight !== false;
  if (topic === "definite_integral") {
    const expr = limitText(params.expr, "x^2", MAX_EXPR_LENGTH);
    const a2 = parseNumber(params.a, 0);
    const b = parseNumber(params.b, 2);
    return normalizePayload({
      expr,
      x_min: parseNumber(params.x_min, Math.min(a2, b) - 1),
      x_max: parseNumber(params.x_max, Math.max(a2, b) + 1),
      points: parseInteger(params.points, 1200),
      title: title === "Teaching template" ? `\u5B9A\u79EF\u5206\uFF1A${expr}` : title,
      xlabel: "x",
      ylabel: "f(x)",
      annotations: highlight ? [
        { kind: "area", x_min: a2, x_max: b, label: `\u79EF\u5206\u533A\u95F4 [${a2}, ${b}]`, color: "#7c3aed", opacity: 0.2 },
        { kind: "vertical_line", x: a2, label: `\u4E0B\u9650 a=${a2}`, color: "#9333ea" },
        { kind: "vertical_line", x: b, label: `\u4E0A\u9650 b=${b}`, color: "#9333ea" }
      ] : []
    }, "/plot");
  }
  if (topic === "tangent_derivative") {
    const expr = limitText(params.expr, "x^2", MAX_EXPR_LENGTH);
    const x0 = parseNumber(params.x0, 1);
    const y0 = parseNumber(params.y0, x0 * x0);
    const slope = parseNumber(params.slope, 2 * x0);
    const tangent = `${slope}*(x-${x0})+${y0}`;
    return normalizePayload({
      exprs: [expr, tangent],
      labels: ["\u539F\u51FD\u6570 f(x)", `\u5207\u7EBF\u659C\u7387 f'(${x0})\u2248${slope}`],
      x_min: parseNumber(params.x_min, x0 - 4),
      x_max: parseNumber(params.x_max, x0 + 4),
      points: parseInteger(params.points, 1200),
      title: title === "Teaching template" ? "\u5BFC\u6570\u7684\u5207\u7EBF\u610F\u4E49" : title,
      xlabel: "x",
      ylabel: "y",
      annotations: highlight ? [
        { kind: "point", x: x0, y: y0, label: `\u5207\u70B9 (${x0}, ${y0})`, color: "#dc2626" },
        { kind: "vertical_line", x: x0, label: `x0=${x0}`, color: "#16a34a" },
        { kind: "label", x: x0 + 0.4, y: y0 + slope, text: `\u659C\u7387\u2248${slope}`, color: "#7c3aed" }
      ] : []
    }, "/plot_multi");
  }
  if (topic === "fourier_series") {
    const terms = Math.max(1, Math.min(15, parseInteger(params.terms, 5)));
    const expr = Array.from({ length: terms }, (_, index) => {
      const n = 2 * index + 1;
      return `sin(${n}*x)/${n}`;
    }).join("+");
    return normalizePayload({
      expr: `(4/${Math.PI})*(${expr})`,
      x_min: parseNumber(params.x_min, -Math.PI),
      x_max: parseNumber(params.x_max, Math.PI),
      points: parseInteger(params.points, 1600),
      title: title === "Teaching template" ? `\u65B9\u6CE2\u5085\u91CC\u53F6\u7EA7\u6570\u8FD1\u4F3C\uFF1A${terms} \u9879` : title,
      xlabel: "x",
      ylabel: "S_N(x)",
      annotations: highlight ? [
        { kind: "vertical_line", x: 0, label: "\u8DF3\u53D8\u70B9", color: "#dc2626" },
        { kind: "label", x: 0.35, y: 1.1, text: "Gibbs \u73B0\u8C61\uFF1A\u8DF3\u53D8\u9644\u8FD1\u8FC7\u51B2", color: "#7c3aed" }
      ] : []
    }, "/plot");
  }
  if (topic === "projectile_motion") {
    const v0 = parseNumber(params.v0, 20);
    const angle = parseNumber(params.angle_deg, 45) * Math.PI / 180;
    const g = Math.max(0.1, parseNumber(params.g, 9.8));
    const vx = v0 * Math.cos(angle);
    const vy = v0 * Math.sin(angle);
    const flight = Math.max(0.1, 2 * vy / g);
    const range = vx * flight;
    const peakT = vy / g;
    const peakX = vx * peakT;
    const peakY = vy * peakT - 0.5 * g * peakT * peakT;
    return normalizePayload({
      expr: `${Math.tan(angle)}*x-${g}/(2*${vx * vx})*x^2`,
      x_min: 0,
      x_max: parseNumber(params.x_max, range * 1.08),
      points: parseInteger(params.points, 1200),
      title: title === "Teaching template" ? "\u629B\u4F53\u8FD0\u52A8\u8F68\u8FF9" : title,
      xlabel: "\u6C34\u5E73\u4F4D\u79FB x",
      ylabel: "\u9AD8\u5EA6 y",
      annotations: highlight ? [
        { kind: "point", x: peakX, y: peakY, label: "\u6700\u9AD8\u70B9", color: "#dc2626" },
        { kind: "point", x: range, y: 0, label: "\u843D\u70B9", color: "#2563eb" },
        { kind: "label", x: range * 0.08, y: peakY * 0.7, text: `vx=${vx.toFixed(1)}, vy=${vy.toFixed(1)}`, color: "#7c3aed" }
      ] : []
    }, "/plot");
  }
  if (topic === "simple_harmonic_motion") {
    const amp = parseNumber(params.amplitude, 1);
    const omega = Math.max(0.01, parseNumber(params.omega, 2));
    const tMax = parseNumber(params.t_max, 2 * Math.PI / omega * 2);
    return normalizePayload({
      exprs: [`${amp}*cos(${omega}*x)`, `-${amp * omega}*sin(${omega}*x)`, `-${amp * omega * omega}*cos(${omega}*x)`],
      labels: ["\u4F4D\u79FB x(t)", "\u901F\u5EA6 v(t)", "\u52A0\u901F\u5EA6 a(t)"],
      x_min: 0,
      x_max: tMax,
      points: parseInteger(params.points, 1600),
      title: title === "Teaching template" ? "\u7B80\u8C10\u632F\u52A8\uFF1A\u4F4D\u79FB\u3001\u901F\u5EA6\u3001\u52A0\u901F\u5EA6" : title,
      xlabel: "\u65F6\u95F4 t",
      ylabel: "\u5F52\u4E00\u5316\u91CF",
      annotations: highlight ? [
        { kind: "vertical_line", x: Math.PI / (2 * omega), label: "T/4", color: "#7c3aed" },
        { kind: "label", x: Math.PI / omega, y: amp, text: "a(t) \u4E0E x(t) \u53CD\u76F8", color: "#dc2626" }
      ] : []
    }, "/plot_multi");
  }
  if (topic === "stress_strain") {
    const yieldStrain = parseNumber(params.yield_strain, 0.02);
    const fractureStrain = parseNumber(params.fracture_strain, 0.3);
    const elasticModulus = parseNumber(params.elastic_modulus, 200);
    const yieldStress = elasticModulus * yieldStrain;
    const peakStress = parseNumber(params.peak_stress, yieldStress * 1.8);
    return normalizePayload({
      series: [{
        name: "\u5E94\u529B-\u5E94\u53D8\u66F2\u7EBF",
        type: "line+scatter",
        color: "#2563eb",
        points: [
          [0, 0],
          [yieldStrain, yieldStress],
          [fractureStrain * 0.6, peakStress],
          [fractureStrain, peakStress * 0.75]
        ]
      }],
      title: title === "Teaching template" ? "\u6750\u6599\u5E94\u529B-\u5E94\u53D8\u66F2\u7EBF" : title,
      xlabel: "\u5E94\u53D8 \u03B5",
      ylabel: "\u5E94\u529B \u03C3",
      annotations: highlight ? [
        { kind: "point", x: yieldStrain, y: yieldStress, label: "\u5C48\u670D\u70B9", color: "#dc2626" },
        { kind: "point", x: fractureStrain * 0.6, y: peakStress, label: "\u6297\u62C9\u5F3A\u5EA6", color: "#7c3aed" },
        { kind: "point", x: fractureStrain, y: peakStress * 0.75, label: "\u65AD\u88C2", color: "#111827" },
        { kind: "label", x: yieldStrain * 0.35, y: yieldStress * 0.65, text: "\u5F39\u6027\u533A", color: "#16a34a" }
      ] : []
    }, "/plot_series");
  }
  if (topic === "energy_conservation") {
    const height = parseNumber(params.height, 10);
    const g = Math.max(0.1, parseNumber(params.g, 9.8));
    const total = g * height;
    return normalizePayload({
      exprs: [`${g}*(${height}-x)`, `${g}*x`, `${total}`],
      labels: ["\u91CD\u529B\u52BF\u80FD Ep", "\u52A8\u80FD Ek", "\u673A\u68B0\u80FD E"],
      x_min: 0,
      x_max: height,
      points: parseInteger(params.points, 1200),
      title: title === "Teaching template" ? "\u673A\u68B0\u80FD\u5B88\u6052\uFF1A\u52BF\u80FD\u4E0E\u52A8\u80FD\u8F6C\u6362" : title,
      xlabel: "\u4E0B\u843D\u8DDD\u79BB s",
      ylabel: "\u5355\u4F4D\u8D28\u91CF\u80FD\u91CF",
      annotations: highlight ? [
        { kind: "label", x: height * 0.15, y: total * 0.95, text: "\u603B\u673A\u68B0\u80FD\u4FDD\u6301\u4E0D\u53D8", color: "#16a34a" },
        { kind: "point", x: height / 2, y: total / 2, label: "Ep=Ek", color: "#dc2626" }
      ] : []
    }, "/plot_multi");
  }
  if (topic === "band_gap") {
    const gap = Math.max(0, parseNumber(params.gap, 1.1));
    const valenceTop = 0;
    const conductionBottom = gap;
    return normalizePayload({
      series: [
        { name: "\u4EF7\u5E26 Ev", type: "line", color: "#2563eb", points: [[0, valenceTop], [1, valenceTop]] },
        { name: "\u5BFC\u5E26 Ec", type: "line", color: "#dc2626", points: [[0, conductionBottom], [1, conductionBottom]] },
        { name: "\u8D39\u7C73\u80FD\u7EA7 Ef", type: "line", color: "#16a34a", points: [[0, gap / 2], [1, gap / 2]] }
      ],
      title: title === "Teaching template" ? "\u534A\u5BFC\u4F53\u80FD\u5E26\u56FE\uFF1A\u5E26\u9699 Eg" : title,
      xlabel: "k \u7A7A\u95F4\u793A\u610F",
      ylabel: "\u80FD\u91CF E",
      annotations: highlight ? [
        { kind: "area", x_min: 0, x_max: 1, label: `\u7981\u5E26 Eg=${gap.toFixed(2)} eV`, color: "#f97316", opacity: 0.12 },
        { kind: "label", x: 0.12, y: conductionBottom + 0.12, text: "\u5BFC\u5E26", color: "#dc2626" },
        { kind: "label", x: 0.12, y: valenceTop - 0.12, text: "\u4EF7\u5E26", color: "#2563eb" }
      ] : []
    }, "/plot_series");
  }
  const a = parseNumber(params.a, 1);
  const h = parseNumber(params.h, 0);
  const k = parseNumber(params.k, 0);
  const p = 1 / (4 * a);
  return normalizePayload({
    expr: `${a}*(x-${h})^2+${k}`,
    x_min: parseNumber(params.x_min, h - 5),
    x_max: parseNumber(params.x_max, h + 5),
    points: parseInteger(params.points, 1200),
    title: title === "Teaching template" ? "\u629B\u7269\u7EBF\u5173\u952E\u51E0\u4F55\u91CF" : title,
    xlabel: "x",
    ylabel: "y",
    annotations: highlight ? [
      { kind: "point", x: h, y: k, label: `\u9876\u70B9 (${h}, ${k})`, color: "#dc2626" },
      { kind: "point", x: h, y: k + p, label: "\u7126\u70B9", color: "#2563eb" },
      { kind: "vertical_line", x: h, label: "\u5BF9\u79F0\u8F74", color: "#16a34a" },
      { kind: "label", x: h + 0.4, y: k - p, text: `\u51C6\u7EBF y=${(k - p).toFixed(2)}`, color: "#7c3aed" }
    ] : []
  }, "/plot");
}
__name(buildTeachingPlotPayload, "buildTeachingPlotPayload");
function buildRcCircuitPayload(title) {
  return buildCircuitScenePayload({
    title,
    notes: ["\u7535\u6E90\u901A\u8FC7 R \u7ED9 C \u5145\u7535\uFF0C\u5F62\u6210\u4E00\u9636 RC \u56DE\u8DEF", "\u7535\u5BB9\u7535\u538B\u9010\u6E10\u63A5\u8FD1 V0\uFF0C\u7535\u6D41\u6309\u6307\u6570\u8870\u51CF"],
    lanes: [
      {
        name: "main",
        items: [
          { id: "bat", type: "battery", label: "V0" },
          { id: "r1", type: "resistor", label: "R" },
          { id: "c1", type: "capacitor", label: "C" },
          { id: "gnd", type: "ground", label: "\u5730" }
        ]
      }
    ]
  });
}
__name(buildRcCircuitPayload, "buildRcCircuitPayload");
function buildRcVoltagePayload(args) {
  const params = getTeachingParams(args);
  const v0 = parseNumber(params.v0, 5);
  const tau = Math.max(0.01, parseNumber(params.tau, 1));
  const tMax = parseNumber(params.t_max, 5 * tau);
  return normalizePayload({
    expr: `${v0}*(1-exp(-x/${tau}))`,
    x_min: 0,
    x_max: tMax,
    points: 1200,
    title: "RC \u7535\u5BB9\u7535\u538B\u4E0A\u5347\u66F2\u7EBF",
    xlabel: "\u65F6\u95F4 t",
    ylabel: "\u7535\u5BB9\u7535\u538B Vc(t)",
    annotations: [
      { kind: "vertical_line", x: tau, label: "\u03C4=RC", color: "#7c3aed" },
      { kind: "label", x: tau * 1.08, y: v0 * 0.632, text: "63.2% V0", color: "#7c3aed" }
    ]
  }, "/plot");
}
__name(buildRcVoltagePayload, "buildRcVoltagePayload");
function buildRcCurrentPayload(args) {
  const params = getTeachingParams(args);
  const i0 = parseNumber(params.i0, 1);
  const tau = Math.max(0.01, parseNumber(params.tau, 1));
  const tMax = parseNumber(params.t_max, 5 * tau);
  return normalizePayload({
    expr: `${i0}*exp(-x/${tau})`,
    x_min: 0,
    x_max: tMax,
    points: 1200,
    title: "RC \u5145\u7535\u7535\u6D41\u8870\u51CF\u66F2\u7EBF",
    xlabel: "\u65F6\u95F4 t",
    ylabel: "\u7535\u6D41 i(t)",
    annotations: [{ kind: "vertical_line", x: tau, label: "\u03C4=RC", color: "#7c3aed" }]
  }, "/plot");
}
__name(buildRcCurrentPayload, "buildRcCurrentPayload");
function buildRlcTransientPayload(args) {
  const params = getTeachingParams(args);
  const alpha = Math.max(0.01, parseNumber(params.alpha, 0.25));
  const omega = Math.max(0.01, parseNumber(params.omega, 4));
  const v0 = parseNumber(params.v0, 1);
  const tMax = parseNumber(params.t_max, 8 / alpha);
  return normalizePayload({
    expr: `${v0}*exp(-${alpha}*x)*cos(${omega}*x)`,
    x_min: 0,
    x_max: tMax,
    points: 1800,
    title: "RLC \u6B20\u963B\u5C3C\u6682\u6001\u54CD\u5E94",
    xlabel: "\u65F6\u95F4 t",
    ylabel: "\u5F52\u4E00\u5316\u54CD\u5E94",
    annotations: [
      { kind: "label", x: 1 / alpha, y: v0 * 0.37, text: "\u5305\u7EDC e^{-\u03B1t}", color: "#7c3aed" },
      { kind: "vertical_line", x: Math.PI / omega, label: "\u534A\u5468\u671F", color: "#2563eb" }
    ]
  }, "/plot");
}
__name(buildRlcTransientPayload, "buildRlcTransientPayload");
function buildVennProbabilityPayload(args, stage = "formula") {
  const params = getTeachingParams(args);
  const title = limitText(args.title, "Venn probability", MAX_TITLE_LENGTH);
  const a = limitText(params.a_label, "A", MAX_LABEL_LENGTH);
  const b = limitText(params.b_label, "B", MAX_LABEL_LENGTH);
  const pA = parseNumber(params.p_a, 0.6);
  const pB = parseNumber(params.p_b, 0.5);
  const pAB = Math.max(0, Math.min(Math.min(pA, pB), parseNumber(params.p_ab, 0.2)));
  const union = Math.max(0, Math.min(1, pA + pB - pAB));
  const outside = Math.max(0, Math.min(1, 1 - union));
  const aOnly = Math.max(0, pA - pAB);
  const bOnly = Math.max(0, pB - pAB);
  const regions = stage === "intersection" ? { A_B: `P(${a}\u2229${b})=${pAB.toFixed(2)}` } : stage === "union" ? { A_only: `${a}\u72EC\u6709=${aOnly.toFixed(2)}`, A_B: `\u4EA4\u96C6=${pAB.toFixed(2)}`, B_only: `${b}\u72EC\u6709=${bOnly.toFixed(2)}`, outside: `\u5916\u90E8=${outside.toFixed(2)}` } : { A_only: `P(${a})`, A_B: `\u4EA4\u96C6`, B_only: `P(${b})`, outside: `1-P(${a}\u222A${b})` };
  return sanitizeVennPayload({
    title: title === "Venn probability" ? `P(${a}\u222A${b}) = P(${a}) + P(${b}) - P(${a}\u2229${b})` : title,
    sets: [
      { label: a, color: "#60a5fa" },
      { label: b, color: "#f97316" }
    ],
    regions
  });
}
__name(buildVennProbabilityPayload, "buildVennProbabilityPayload");
function buildCPointerArrayPayload(args, stage = "array") {
  const params = getTeachingParams(args);
  const title = limitText(args.title, "C pointer and array memory", MAX_TITLE_LENGTH);
  const base = Math.max(0, Math.floor(parseNumber(params.base_address, 4096)));
  const values = ensureArray(params.values).length > 0 ? ensureArray(params.values).slice(0, 6) : [10, 20, 30, 40];
  const elementType = limitText(params.type, "int", MAX_LABEL_LENGTH);
  const elementBytes = Math.max(1, Math.min(16, parseInteger(params.element_bytes, 4)));
  const blocks = values.map((value, index) => ({
    name: `arr[${index}]`,
    type: elementType,
    value: String(value),
    address: `0x${(base + index * elementBytes).toString(16)}`,
    bytes: [String(value)],
    note: index === 0 ? "\u6570\u7EC4\u540D arr \u8868\u793A\u9996\u5143\u7D20\u5730\u5740" : `arr+${index} \u5411\u540E\u79FB\u52A8 ${index * elementBytes} \u5B57\u8282`
  }));
  if (stage !== "array") {
    blocks.unshift({
      name: "p",
      type: `${elementType}*`,
      value: stage === "dereference" ? `*(arr+1)=${String(values[1] ?? values[0])}` : "arr",
      address: `0x${(base - elementBytes).toString(16)}`,
      bytes: [`0x${base.toString(16)}`],
      note: stage === "dereference" ? "\u89E3\u5F15\u7528\u4F1A\u8BFB\u53D6\u76EE\u6807\u5730\u5740\u91CC\u7684\u503C" : "\u6307\u9488\u53D8\u91CF\u4FDD\u5B58\u5730\u5740\uFF0C\u4E0D\u4FDD\u5B58\u6574\u4E2A\u6570\u7EC4"
    });
  }
  return sanitizeCMemoryPayload({
    title: title === "C pointer and array memory" ? "C \u6570\u7EC4\u9000\u5316\u4E0E\u6307\u9488\u8FD0\u7B97" : title,
    blocks
  });
}
__name(buildCPointerArrayPayload, "buildCPointerArrayPayload");
function buildCStructLayoutPayload(args, stage = "layout") {
  const params = getTeachingParams(args);
  const rawFields = ensureArray(params.fields);
  const fields = rawFields.length > 0 ? rawFields.slice(0, 8) : [
    { name: "id", type: "int", size: 4 },
    { name: "grade", type: "char", size: 1 },
    { name: "score", type: "double", size: 8 }
  ];
  let offset = 0;
  const blocks = fields.map((field) => {
    const record = field && typeof field === "object" ? field : {};
    const name = limitText(record.name, "field", MAX_LABEL_LENGTH);
    const type = limitText(record.type, "int", MAX_LABEL_LENGTH);
    const size = Math.max(1, Math.min(16, parseInteger(record.size, type === "double" ? 8 : type === "char" ? 1 : 4)));
    const align = Math.min(8, size);
    const padding = (align - offset % align) % align;
    if (padding > 0) offset += padding;
    const address = offset;
    offset += size;
    return {
      name,
      type,
      value: `${size}B`,
      address: `+${address}`,
      bytes: [`${size} \u5B57\u8282`],
      note: padding > 0 ? `\u524D\u9762\u63D2\u5165 ${padding} \u5B57\u8282 padding \u4EE5\u6EE1\u8DB3\u5BF9\u9F50` : "\u5B57\u6BB5\u6309\u5BF9\u9F50\u8981\u6C42\u653E\u5165\u7ED3\u6784\u4F53"
    };
  });
  if (stage === "padding") {
    blocks.unshift({ name: "padding", type: "\u5BF9\u9F50\u586B\u5145", value: "\u9690\u85CF\u5B57\u8282", address: "+?", bytes: ["pad"], note: "padding \u4E0D\u5C5E\u4E8E\u4EFB\u4F55\u5B57\u6BB5\uFF0C\u4F46\u4F1A\u589E\u52A0 sizeof(struct)" });
  }
  if (stage === "sizeof") {
    const tailPadding = (8 - offset % 8) % 8;
    if (tailPadding > 0) offset += tailPadding;
    blocks.push({ name: "sizeof", type: "\u603B\u5927\u5C0F", value: `${offset}B`, address: "", bytes: [`${offset} \u5B57\u8282`], note: "\u7ED3\u6784\u4F53\u6570\u7EC4\u8981\u6C42\u6BCF\u4E2A\u5143\u7D20\u8D77\u59CB\u5730\u5740\u4E5F\u6EE1\u8DB3\u6700\u5927\u5BF9\u9F50" });
  }
  return sanitizeCMemoryPayload({ title: "C \u7ED3\u6784\u4F53\u5185\u5B58\u5E03\u5C40\u4E0E padding / sizeof", blocks });
}
__name(buildCStructLayoutPayload, "buildCStructLayoutPayload");
async function buildTeachingTemplate(args, env, origin) {
  const topic = limitText(args.topic, "parabola", 32);
  if (topic === "venn_probability") {
    return buildSvgLinkData(env, "/venn.svg", buildVennProbabilityPayload(args), origin, "Venn probability");
  }
  if (topic === "c_pointer_array") {
    return buildSvgLinkData(env, "/c-memory.svg", buildCPointerArrayPayload(args), origin, "C pointer and array memory");
  }
  if (topic === "c_struct_layout") {
    return buildSvgLinkData(env, "/c-memory.svg", buildCStructLayoutPayload(args), origin, "C struct layout");
  }
  if (topic === "rc_charging") {
    const circuitPayload = buildRcCircuitPayload(limitText(args.title, "RC \u5145\u7535\u7535\u8DEF", MAX_TITLE_LENGTH));
    return buildSvgLinkData(env, "/circuit.svg", circuitPayload, origin, "RC \u5145\u7535\u7535\u8DEF");
  }
  if (topic === "incline_force") {
    const params = getTeachingParams(args);
    const payload = sanitizeForceTemplatePayload({ ...params, title: args.title ?? "\u659C\u9762\u53D7\u529B\u5206\u6790", template: "incline" });
    return buildSvgLinkData(env, "/force-analysis.svg", payload, origin, "\u659C\u9762\u53D7\u529B\u5206\u6790");
  }
  if (topic === "rlc_transient") {
    return buildPlotLinkData(buildRlcTransientPayload(args), origin, env);
  }
  return buildPlotLinkData(buildTeachingPlotPayload(args), origin, env);
}
__name(buildTeachingTemplate, "buildTeachingTemplate");
async function buildTeachingSequence(args, env, origin) {
  const topic = limitText(args.topic, "rc_charging", 32);
  if (topic === "tangent_derivative") {
    const params = getTeachingParams(args);
    const x0 = parseNumber(params.x0, 1);
    const y0 = parseNumber(params.y0, x0 * x0);
    const slope = parseNumber(params.slope, 2 * x0);
    const base = buildTeachingPlotPayload({ ...args, params: { ...params, x0, y0, slope } });
    const derivative = normalizePayload({
      expr: limitText(params.derivative_expr, "2*x", MAX_EXPR_LENGTH),
      x_min: parseNumber(params.x_min, x0 - 4),
      x_max: parseNumber(params.x_max, x0 + 4),
      points: parseInteger(params.points, 1200),
      title: "\u5BFC\u51FD\u6570\u7ED9\u51FA\u6BCF\u4E00\u70B9\u659C\u7387",
      xlabel: "x",
      ylabel: "f'(x)",
      annotations: [{ kind: "point", x: x0, y: slope, label: `f'(${x0})\u2248${slope}`, color: "#dc2626" }]
    }, "/plot");
    const items2 = [
      { title: "1. \u51FD\u6570\u4E0E\u5207\u7EBF", kind: "plot", png_url: await buildShortUrl(env, "/png", base, origin), explanation: "\u5207\u70B9\u9644\u8FD1\u7528\u76F4\u7EBF\u8FD1\u4F3C\u66F2\u7EBF\uFF0C\u5207\u7EBF\u659C\u7387\u5C31\u662F\u8BE5\u70B9\u5BFC\u6570\u3002", payload: base },
      { title: "2. \u5BFC\u51FD\u6570\u8BFB\u659C\u7387", kind: "plot", png_url: await buildShortUrl(env, "/png", derivative, origin), explanation: "\u5BFC\u51FD\u6570\u56FE\u50CF\u7684\u7EB5\u5750\u6807\u8868\u793A\u539F\u51FD\u6570\u5728\u540C\u4E00 x \u5904\u7684\u77AC\u65F6\u53D8\u5316\u7387\u3002", payload: derivative }
    ];
    return { ok: true, kind: "teaching_sequence", title: limitText(args.title, "Derivative tangent sequence", MAX_TITLE_LENGTH), warnings: [], count: items2.length, items: items2 };
  }
  if (topic === "fourier_series") {
    const params = getTeachingParams(args);
    const stages = [1, 3, Math.max(5, Math.min(15, parseInteger(params.terms, 7)))];
    const items2 = await Promise.all(stages.map(async (terms, index) => {
      const payload = buildTeachingPlotPayload({ ...args, params: { ...params, terms }, title: `${index + 1}. ${terms} \u9879\u5085\u91CC\u53F6\u8FD1\u4F3C` });
      return { title: `${index + 1}. ${terms} \u9879\u8FD1\u4F3C`, kind: "plot", png_url: await buildShortUrl(env, "/png", payload, origin), explanation: terms === 1 ? "\u53EA\u4FDD\u7559\u57FA\u6CE2\uFF0C\u80FD\u770B\u51FA\u4E3B\u8981\u5468\u671F\u3002" : "\u589E\u52A0\u9AD8\u6B21\u8C10\u6CE2\u540E\uFF0C\u65B9\u6CE2\u8FB9\u7F18\u66F4\u9661\uFF0C\u4F46\u8DF3\u53D8\u9644\u8FD1\u4ECD\u6709\u8FC7\u51B2\u3002", payload };
    }));
    return { ok: true, kind: "teaching_sequence", title: limitText(args.title, "Fourier series sequence", MAX_TITLE_LENGTH), warnings: [], count: items2.length, items: items2 };
  }
  if (topic === "rlc_transient") {
    const params = getTeachingParams(args);
    const stages = [
      { alpha: parseNumber(params.alpha, 0.8), title: "1. \u963B\u5C3C\u8F83\u5F3A" },
      { alpha: parseNumber(params.alpha_mid, 0.35), title: "2. \u6B20\u963B\u5C3C\u632F\u8361" },
      { alpha: parseNumber(params.alpha_low, 0.12), title: "3. \u963B\u5C3C\u8F83\u5F31" }
    ];
    const items2 = await Promise.all(stages.map(async (stage) => {
      const payload = buildRlcTransientPayload({ ...args, params: { ...params, alpha: stage.alpha }, title: stage.title });
      payload.title = stage.title;
      return { title: stage.title, kind: "plot", png_url: await buildShortUrl(env, "/png", payload, origin), explanation: "\u03B1 \u8D8A\u5C0F\uFF0C\u632F\u8361\u8870\u51CF\u8D8A\u6162\uFF1B\u03B1 \u8D8A\u5927\uFF0C\u80FD\u91CF\u635F\u8017\u8D8A\u5FEB\u3002", payload };
    }));
    return { ok: true, kind: "teaching_sequence", title: limitText(args.title, "RLC transient sequence", MAX_TITLE_LENGTH), warnings: [], count: items2.length, items: items2 };
  }
  if (topic === "projectile_motion") {
    const params = getTeachingParams(args);
    const stages = [
      { title: "1. \u8FD0\u52A8\u8F68\u8FF9", angle_deg: parseNumber(params.angle_deg, 45) },
      { title: "2. \u4F4E\u89D2\u5EA6\u5C04\u7A0B", angle_deg: parseNumber(params.low_angle_deg, 30) },
      { title: "3. \u9AD8\u89D2\u5EA6\u5C04\u9AD8", angle_deg: parseNumber(params.high_angle_deg, 60) }
    ];
    const items2 = await Promise.all(stages.map(async (stage) => {
      const payload = buildTeachingPlotPayload({ ...args, params: { ...params, angle_deg: stage.angle_deg }, title: stage.title });
      return { title: stage.title, kind: "plot", png_url: await buildShortUrl(env, "/png", payload, origin), explanation: "\u6C34\u5E73\u901F\u5EA6\u4FDD\u6301\u4E0D\u53D8\uFF0C\u7AD6\u76F4\u65B9\u5411\u53D7\u91CD\u529B\u4EA7\u751F\u5300\u52A0\u901F\u8FD0\u52A8\u3002", payload };
    }));
    return { ok: true, kind: "teaching_sequence", title: limitText(args.title, "Projectile motion sequence", MAX_TITLE_LENGTH), warnings: [], count: items2.length, items: items2 };
  }
  if (topic === "simple_harmonic_motion") {
    const params = getTeachingParams(args);
    const displacement = buildTeachingPlotPayload({ ...args, title: "1. \u4F4D\u79FB\u3001\u901F\u5EA6\u3001\u52A0\u901F\u5EA6\u76F8\u4F4D\u5173\u7CFB" });
    const energy = normalizePayload({
      exprs: ["cos(x)^2", "sin(x)^2", "1"],
      labels: ["\u52BF\u80FD Ep", "\u52A8\u80FD Ek", "\u603B\u80FD\u91CF E"],
      x_min: 0,
      x_max: parseNumber(params.t_max, 2 * Math.PI),
      points: 1200,
      title: "2. \u7B80\u8C10\u632F\u52A8\u80FD\u91CF\u8F6C\u6362",
      xlabel: "\u76F8\u4F4D \u03C9t",
      ylabel: "\u5F52\u4E00\u5316\u80FD\u91CF",
      annotations: [{ kind: "label", x: Math.PI / 2, y: 1, text: "\u52A8\u80FD\u548C\u52BF\u80FD\u4E92\u76F8\u8F6C\u5316\uFF0C\u603B\u80FD\u91CF\u5B88\u6052", color: "#7c3aed" }]
    }, "/plot_multi");
    const items2 = [
      { title: "1. \u76F8\u4F4D\u5173\u7CFB", kind: "plot", png_url: await buildShortUrl(env, "/png", displacement, origin), explanation: "\u901F\u5EA6\u6BD4\u4F4D\u79FB\u8D85\u524D \u03C0/2\uFF0C\u52A0\u901F\u5EA6\u4E0E\u4F4D\u79FB\u53CD\u76F8\u3002", payload: displacement },
      { title: "2. \u80FD\u91CF\u8F6C\u6362", kind: "plot", png_url: await buildShortUrl(env, "/png", energy, origin), explanation: "\u52A8\u80FD\u548C\u52BF\u80FD\u5468\u671F\u6027\u4EA4\u6362\uFF0C\u603B\u673A\u68B0\u80FD\u4FDD\u6301\u4E0D\u53D8\u3002", payload: energy }
    ];
    return { ok: true, kind: "teaching_sequence", title: limitText(args.title, "Simple harmonic motion sequence", MAX_TITLE_LENGTH), warnings: [], count: items2.length, items: items2 };
  }
  if (topic === "stress_strain") {
    const template = buildTeachingPlotPayload(args);
    const brittle = buildTeachingPlotPayload({ ...args, params: { ...getTeachingParams(args), yield_strain: 0.01, fracture_strain: 0.06, peak_stress: 8 }, title: "1. \u8106\u6027\u6750\u6599" });
    const ductile = buildTeachingPlotPayload({ ...args, params: { ...getTeachingParams(args), yield_strain: 0.03, fracture_strain: 0.35, peak_stress: 9 }, title: "2. \u5EF6\u6027\u6750\u6599" });
    const items2 = [
      { title: "1. \u6807\u51C6\u9636\u6BB5", kind: "plot", png_url: await buildShortUrl(env, "/png", template, origin), explanation: "\u66F2\u7EBF\u4F9D\u6B21\u5C55\u793A\u5F39\u6027\u533A\u3001\u5C48\u670D\u3001\u5F3A\u5316\u4E0E\u65AD\u88C2\u3002", payload: template },
      { title: "2. \u8106\u6027\u6750\u6599", kind: "plot", png_url: await buildShortUrl(env, "/png", brittle, origin), explanation: "\u8106\u6027\u6750\u6599\u5851\u6027\u53D8\u5F62\u5C0F\uFF0C\u65AD\u88C2\u5E94\u53D8\u8F83\u4F4E\u3002", payload: brittle },
      { title: "3. \u5EF6\u6027\u6750\u6599", kind: "plot", png_url: await buildShortUrl(env, "/png", ductile, origin), explanation: "\u5EF6\u6027\u6750\u6599\u65AD\u88C2\u524D\u6709\u66F4\u957F\u7684\u5851\u6027\u53D8\u5F62\u9636\u6BB5\u3002", payload: ductile }
    ];
    return { ok: true, kind: "teaching_sequence", title: limitText(args.title, "Stress strain sequence", MAX_TITLE_LENGTH), warnings: [], count: items2.length, items: items2 };
  }
  if (topic === "c_struct_layout") {
    const payloads = [buildCStructLayoutPayload(args, "layout"), buildCStructLayoutPayload(args, "padding"), buildCStructLayoutPayload(args, "sizeof")];
    const explanations = ["\u5B57\u6BB5\u6309\u58F0\u660E\u987A\u5E8F\u653E\u7F6E\uFF0C\u4F46\u4F1A\u53D7\u5BF9\u9F50\u7EA6\u675F\u5F71\u54CD\u3002", "padding \u662F\u7F16\u8BD1\u5668\u63D2\u5165\u7684\u9690\u85CF\u7A7A\u6D1E\u3002", "sizeof(struct) \u5305\u542B\u5B57\u6BB5\u3001\u5185\u90E8 padding \u548C\u5C3E\u90E8 padding\u3002"];
    const items2 = await Promise.all(payloads.map(async (payload, index) => ({
      title: `${index + 1}. ${index === 0 ? "\u5B57\u6BB5\u5E03\u5C40" : index === 1 ? "\u5BF9\u9F50\u586B\u5145" : "sizeof \u603B\u5927\u5C0F"}`,
      kind: "diagram",
      svg_url: await buildShortUrl(env, "/c-memory.svg", payload, origin),
      explanation: explanations[index],
      warnings: collectPayloadWarnings(payload),
      payload
    })));
    return { ok: true, kind: "teaching_sequence", title: limitText(args.title, "C struct layout sequence", MAX_TITLE_LENGTH), warnings: items2.flatMap((item) => item.warnings), count: items2.length, items: items2 };
  }
  if (topic === "energy_conservation") {
    const energy = buildTeachingPlotPayload(args);
    const params = getTeachingParams(args);
    const height = parseNumber(params.height, 10);
    const g = Math.max(0.1, parseNumber(params.g, 9.8));
    const velocity = normalizePayload({
      expr: `sqrt(2*${g}*x)`,
      x_min: 0,
      x_max: height,
      points: 1200,
      title: "\u7531\u80FD\u91CF\u5B88\u6052\u63A8\u51FA\u901F\u5EA6",
      xlabel: "\u4E0B\u843D\u8DDD\u79BB s",
      ylabel: "\u901F\u5EA6 v",
      annotations: [{ kind: "label", x: height * 0.35, y: Math.sqrt(2 * g * height) * 0.7, text: "v=sqrt(2gs)", color: "#7c3aed" }]
    }, "/plot");
    const items2 = [
      { title: "1. \u80FD\u91CF\u8F6C\u6362", kind: "plot", png_url: await buildShortUrl(env, "/png", energy, origin), explanation: "\u52BF\u80FD\u51CF\u5C11\u91CF\u7B49\u4E8E\u52A8\u80FD\u589E\u52A0\u91CF\uFF0C\u603B\u673A\u68B0\u80FD\u4E0D\u53D8\u3002", payload: energy },
      { title: "2. \u901F\u5EA6\u968F\u4E0B\u843D\u8DDD\u79BB\u53D8\u5316", kind: "plot", png_url: await buildShortUrl(env, "/png", velocity, origin), explanation: "\u5FFD\u7565\u963B\u529B\u65F6\uFF0C\u4E0B\u843D\u8D8A\u8FDC\u901F\u5EA6\u8D8A\u5927\u3002", payload: velocity }
    ];
    return { ok: true, kind: "teaching_sequence", title: limitText(args.title, "Energy conservation sequence", MAX_TITLE_LENGTH), warnings: [], count: items2.length, items: items2 };
  }
  if (topic === "band_gap") {
    const semiconductor = buildTeachingPlotPayload({ ...args, params: { ...getTeachingParams(args), gap: parseNumber(getTeachingParams(args).gap, 1.1) }, title: "1. \u534A\u5BFC\u4F53" });
    const conductor = buildTeachingPlotPayload({ ...args, params: { ...getTeachingParams(args), gap: 0 }, title: "2. \u5BFC\u4F53\uFF1A\u65E0\u660E\u663E\u7981\u5E26" });
    const insulator = buildTeachingPlotPayload({ ...args, params: { ...getTeachingParams(args), gap: 5 }, title: "3. \u7EDD\u7F18\u4F53\uFF1A\u5BBD\u7981\u5E26" });
    const payloads = [semiconductor, conductor, insulator];
    const explanations = ["\u534A\u5BFC\u4F53\u5E26\u9699\u9002\u4E2D\uFF0C\u70ED\u6FC0\u53D1\u6216\u63BA\u6742\u53EF\u4EA7\u751F\u8F7D\u6D41\u5B50\u3002", "\u5BFC\u4F53\u4EF7\u5E26\u4E0E\u5BFC\u5E26\u91CD\u53E0\u6216\u7981\u5E26\u8FD1\u4F3C\u4E3A\u96F6\u3002", "\u7EDD\u7F18\u4F53\u5E26\u9699\u5F88\u5BBD\uFF0C\u5E38\u6E29\u4E0B\u96BE\u4EE5\u6FC0\u53D1\u8F7D\u6D41\u5B50\u3002"];
    const items2 = await Promise.all(payloads.map(async (payload, index) => ({ title: String(payload.title), kind: "plot", png_url: await buildShortUrl(env, "/png", payload, origin), explanation: explanations[index], payload })));
    return { ok: true, kind: "teaching_sequence", title: limitText(args.title, "Band gap sequence", MAX_TITLE_LENGTH), warnings: [], count: items2.length, items: items2 };
  }
  if (topic === "venn_probability") {
    const payloads = [
      buildVennProbabilityPayload(args, "formula"),
      buildVennProbabilityPayload(args, "intersection"),
      buildVennProbabilityPayload(args, "union")
    ];
    const explanations = [
      "\u5148\u628A\u4E24\u4E2A\u4E8B\u4EF6\u653E\u8FDB\u540C\u4E00\u4E2A\u6837\u672C\u7A7A\u95F4\uFF0C\u660E\u786E A \u4E0E B \u4F1A\u91CD\u53E0\u3002",
      "\u4EA4\u96C6 A\u2229B \u662F\u4F1A\u88AB P(A)+P(B) \u91CD\u590D\u8BA1\u7B97\u7684\u4E00\u5757\u3002",
      "\u5E76\u96C6 A\u222AB \u7B49\u4E8E\u4E24\u8FB9\u76F8\u52A0\u540E\u51CF\u6389\u91CD\u590D\u7684\u4EA4\u96C6\u3002"
    ];
    const items2 = await Promise.all(payloads.map(async (payload, index) => ({
      title: `${index + 1}. ${index === 0 ? "\u6837\u672C\u7A7A\u95F4\u4E0E\u4E8B\u4EF6" : index === 1 ? "\u6807\u51FA\u4EA4\u96C6" : "\u5F97\u5230\u5E76\u96C6\u516C\u5F0F"}`,
      kind: "diagram",
      svg_url: await buildShortUrl(env, "/venn.svg", payload, origin),
      explanation: explanations[index],
      warnings: collectPayloadWarnings(payload),
      payload
    })));
    return { ok: true, kind: "teaching_sequence", title: limitText(args.title, "Venn probability sequence", MAX_TITLE_LENGTH), warnings: items2.flatMap((item) => item.warnings), count: items2.length, items: items2 };
  }
  if (topic === "c_pointer_array") {
    const payloads = [
      buildCPointerArrayPayload(args, "array"),
      buildCPointerArrayPayload(args, "pointer"),
      buildCPointerArrayPayload(args, "dereference")
    ];
    const explanations = [
      "\u6570\u7EC4\u5143\u7D20\u5728\u5185\u5B58\u4E2D\u8FDE\u7EED\u6392\u5217\uFF0C\u5730\u5740\u6309\u5143\u7D20\u5927\u5C0F\u9012\u589E\u3002",
      "\u6307\u9488\u53D8\u91CF p \u5B58\u7684\u662F\u5730\u5740\uFF1Barr \u5728\u8868\u8FBE\u5F0F\u91CC\u5E38\u9000\u5316\u4E3A\u9996\u5143\u7D20\u5730\u5740\u3002",
      "*(arr+1) \u5148\u79FB\u52A8\u4E00\u4E2A\u5143\u7D20\u5BBD\u5EA6\uFF0C\u518D\u8BFB\u53D6\u76EE\u6807\u5730\u5740\u4E2D\u7684\u503C\u3002"
    ];
    const items2 = await Promise.all(payloads.map(async (payload, index) => ({
      title: `${index + 1}. ${index === 0 ? "\u6570\u7EC4\u8FDE\u7EED\u5B58\u50A8" : index === 1 ? "\u6307\u9488\u4FDD\u5B58\u5730\u5740" : "\u89E3\u5F15\u7528\u8BFB\u53D6\u503C"}`,
      kind: "diagram",
      svg_url: await buildShortUrl(env, "/c-memory.svg", payload, origin),
      explanation: explanations[index],
      warnings: collectPayloadWarnings(payload),
      payload
    })));
    return { ok: true, kind: "teaching_sequence", title: limitText(args.title, "C pointer array sequence", MAX_TITLE_LENGTH), warnings: items2.flatMap((item) => item.warnings), count: items2.length, items: items2 };
  }
  if (topic === "incline_force") {
    const params = getTeachingParams(args);
    const rawIncline = parseNumber(params.incline_deg, 30);
    const stage1 = sanitizeForceTemplatePayload({ ...params, template: "incline", title: "1. \u60C5\u666F\u4E0E\u5168\u90E8\u53D7\u529B", show_components: false, show_resultant: false });
    const stage2 = sanitizeForceTemplatePayload({ ...params, template: "incline", title: "2. \u5206\u89E3\u91CD\u529B\u5230\u659C\u9762\u65B9\u5411", show_components: true, show_resultant: false });
    const stage3 = sanitizeForceTemplatePayload({ ...params, template: "incline", title: "3. \u5224\u65AD\u5408\u529B\u65B9\u5411", show_components: true, show_resultant: true });
    const payloads = [stage1, stage2, stage3];
    const items2 = await Promise.all(payloads.map(async (payload, index) => ({
      title: limitText(payload.title, `Incline force step ${index + 1}`, MAX_TITLE_LENGTH),
      kind: "diagram",
      svg_url: await buildShortUrl(env, "/force-analysis.svg", payload, origin),
      explanation: index === 0 ? `\u659C\u9762\u89D2\u53D6 ${payload.incline_deg}\xB0${rawIncline !== payload.incline_deg ? "\uFF0C\u5DF2\u4E3A\u7A33\u5B9A\u6392\u7248\u505A\u94B3\u5236" : ""}` : index === 1 ? "\u628A\u91CD\u529B\u5206\u89E3\u4E3A\u6CBF\u659C\u9762\u4E0E\u5782\u76F4\u659C\u9762\u7684\u5206\u91CF" : "\u6BD4\u8F83\u6CBF\u659C\u9762\u65B9\u5411\u7684\u529B\uFF0C\u786E\u5B9A\u5408\u529B\u4E0E\u8FD0\u52A8\u8D8B\u52BF",
      warnings: collectPayloadWarnings(payload),
      payload
    })));
    return { ok: true, kind: "teaching_sequence", title: limitText(args.title, "Incline force sequence", MAX_TITLE_LENGTH), warnings: items2.flatMap((item) => item.warnings), count: items2.length, items: items2 };
  }
  const circuitPayload = buildRcCircuitPayload("1. RC \u5145\u7535\u7535\u8DEF");
  const voltagePayload = buildRcVoltagePayload(args);
  const currentPayload = buildRcCurrentPayload(args);
  const items = [
    { title: "1. RC \u5145\u7535\u7535\u8DEF", kind: "diagram", svg_url: await buildShortUrl(env, "/circuit.svg", circuitPayload, origin), explanation: "\u7535\u6E90\u901A\u8FC7\u7535\u963B\u7ED9\u7535\u5BB9\u5145\u7535\uFF0C\u65F6\u95F4\u5E38\u6570 \u03C4=RC\u3002", payload: circuitPayload },
    { title: "2. \u7535\u5BB9\u7535\u538B\u4E0A\u5347", kind: "plot", png_url: await buildShortUrl(env, "/png", voltagePayload, origin), explanation: "Vc(t)=V0(1-e^{-t/\u03C4})\uFF0Ct=\u03C4 \u65F6\u7EA6\u4E3A 63.2% V0\u3002", payload: voltagePayload },
    { title: "3. \u7535\u6D41\u6307\u6570\u8870\u51CF", kind: "plot", png_url: await buildShortUrl(env, "/png", currentPayload, origin), explanation: "i(t)=I0e^{-t/\u03C4}\uFF0C\u521D\u59CB\u6700\u5927\u540E\u9010\u6E10\u8D8B\u8FD1 0\u3002", payload: currentPayload }
  ];
  return { ok: true, kind: "teaching_sequence", title: limitText(args.title, "RC charging sequence", MAX_TITLE_LENGTH), warnings: [], count: items.length, items };
}
__name(buildTeachingSequence, "buildTeachingSequence");
function buildSpecFromPayload(payload) {
  const path = String(payload.__path || "/plot");
  const cleaned = { ...payload };
  delete cleaned.__path;
  if (path === "/plot") return buildSinglePlot(cleaned);
  if (path === "/plot_multi") return buildMultiPlot(cleaned);
  if (path === "/plot_series") return buildSeriesPlot(cleaned);
  if (path === "/plot_bar") return buildBarChart(cleaned);
  throw new Error("invalid plot path");
}
__name(buildSpecFromPayload, "buildSpecFromPayload");
async function handleToolCall(name, args, env, origin) {
  switch (name) {
    case "health":
      return { ok: true, status: 200, data: { ok: true } };
    case "plot":
    case "plot_json": {
      return { ok: true, status: 200, data: await pngLinkPayload(args, "/plot", origin, env) };
    }
    case "plot_png_link": {
      return { ok: true, status: 200, data: await pngLinkPayload(args, "/plot", origin, env) };
    }
    case "plot_multi":
    case "plot_multi_json": {
      return { ok: true, status: 200, data: await pngLinkPayload(args, "/plot_multi", origin, env) };
    }
    case "plot_multi_png_link": {
      return { ok: true, status: 200, data: await pngLinkPayload(args, "/plot_multi", origin, env) };
    }
    case "plot_series":
    case "plot_series_json": {
      return { ok: true, status: 200, data: await pngLinkPayload(args, "/plot_series", origin, env) };
    }
    case "plot_series_png_link": {
      return { ok: true, status: 200, data: await pngLinkPayload(args, "/plot_series", origin, env) };
    }
    case "force_diagram_link": {
      const payload = sanitizeForcePayload(args);
      return { ok: true, status: 200, data: await buildSvgLinkData(env, "/force.svg", payload, origin, "Force diagram") };
    }
    case "force_analysis_link": {
      const payload = sanitizeForceAnalysisPayload(args);
      return { ok: true, status: 200, data: await buildSvgLinkData(env, "/force-analysis.svg", payload, origin, "Force analysis") };
    }
    case "force_analysis_template_link": {
      const payload = sanitizeForceTemplatePayload(args);
      return { ok: true, status: 200, data: await buildSvgLinkData(env, "/force-analysis.svg", payload, origin, "Force analysis template") };
    }
    case "circuit_diagram_link": {
      const linkMode = classifyCircuitLinkPayload(args);
      const packedPayload = buildCompactCircuitLinkPayload(args, linkMode);
      const payload = sanitizeCircuitPayloadFromArgs(packedPayload);
      return { ok: true, status: 200, data: await buildSvgLinkData(env, "/circuit.svg", packedPayload, origin, "Circuit diagram") };
    }
    case "circuit_template_link": {
      const packedPayload = buildCompactCircuitLinkPayload(args, "template");
      const payload = sanitizeCircuitTemplatePayload(args);
      return { ok: true, status: 200, data: await buildSvgLinkData(env, "/circuit.svg", packedPayload, origin, "Circuit template") };
    }
    case "venn_diagram_link": {
      const payload = sanitizeVennPayload(args);
      return { ok: true, status: 200, data: await buildSvgLinkData(env, "/venn.svg", payload, origin, "Venn diagram") };
    }
    case "c_memory_diagram_link": {
      const payload = sanitizeCMemoryPayload(args);
      return { ok: true, status: 200, data: await buildSvgLinkData(env, "/c-memory.svg", payload, origin, "C memory layout") };
    }
    case "shape3d_link": {
      const payload = sanitizeShapePayload(args);
      // Generate static SVG preview for MCP clients that only display svg_url
      const svgPreview = renderSurfacePreviewSvg(payload);
      return { ok: true, status: 200, data: {
        ok: true,
        kind: "html3d",
        title: limitText(payload.title, "3D shape", MAX_TITLE_LENGTH),
        warnings: collectPayloadWarnings(payload),
        svg_url: await buildShortUrl(env, "/circuit.svg", { __svg_preview: true, svg: svgPreview }, origin),
        html_url: await buildShortUrl(env, "/shape3d.html", payload, origin),
        payload
      }};
    }
    case "plot_bar_json": {
      return { ok: true, status: 200, data: await pngLinkPayload(args, "/plot_bar", origin, env) };
    }
    case "plot_multi_images": {
      const jobs = ensureArray(args.jobs).slice(0, MAX_MULTI_IMAGE_JOBS);
      const results = await Promise.all(jobs.map(async (job) => {
        const record = job && typeof job === "object" ? job : {};
        const kind = String(record.kind || "plot");
        const path = kind === "plot_multi" ? "/plot_multi" : kind === "plot_series" ? "/plot_series" : kind === "plot_bar" ? "/plot_bar" : "/plot";
        const data = await pngLinkPayload(record, path, origin, env);
        return { ...data, job_kind: kind };
      }));
      return { ok: true, status: 200, data: { count: results.length, results } };
    }
    case "teaching_template_link": {
      return { ok: true, status: 200, data: await buildTeachingTemplate(args, env, origin) };
    }
    case "teaching_sequence_link": {
      return { ok: true, status: 200, data: await buildTeachingSequence(args, env, origin) };
    }
    default:
      throw new Error(`unknown_tool:${name}`);
  }
}
__name(handleToolCall, "handleToolCall");
var index_default = {
  async fetch(req, env) {
    const url = new URL(req.url);
    if (req.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: corsHeaders() });
    }
    if (req.method === "GET" && (url.pathname === "/" || url.pathname === "/healthz")) {
      return Response.json(healthResult(url.origin), { headers: corsHeaders() });
    }
    if (req.method === "GET" && url.pathname === "/png") {
      try {
        const packed = url.searchParams.get("d") || "";
        if (!packed) return Response.json({ ok: false, error: "missing_d" }, { status: 400, headers: corsHeaders() });
        const payload = await parseCompressedBase64UrlJson(packed);
        const spec = buildSpecFromPayload(payload);
        return await renderPngResponse(renderPlotSvg(spec), env);
      } catch (error) {
        return Response.json({ ok: false, error: "bad_png_query", message: String(error?.message || error) }, { status: 400, headers: corsHeaders() });
      }
    }
    if (req.method === "GET" && url.pathname.startsWith(SHORT_LINK_PATH_PREFIX)) {
      try {
        const token = url.pathname.slice(SHORT_LINK_PATH_PREFIX.length);
        if (!token) return Response.json({ ok: false, error: "missing_short_token" }, { status: 400, headers: corsHeaders() });
        const record = await resolveShortLink(env, token);
        if (!record) return Response.json({ ok: false, error: "short_link_not_found" }, { status: 404, headers: corsHeaders() });
        return await renderShortLink(record, env);
      } catch (error) {
        return Response.json({ ok: false, error: "bad_short_link", message: String(error?.message || error) }, { status: 400, headers: corsHeaders() });
      }
    }
    if (req.method === "GET" && url.pathname === "/force.svg") {
      try {
        const packed = url.searchParams.get("d") || "";
        if (!packed) return Response.json({ ok: false, error: "missing_d" }, { status: 400, headers: corsHeaders() });
        const payload = await parseCompressedBase64UrlJson(packed);
        return new Response(renderForceDiagramSvg(payload), { status: 200, headers: { "content-type": "image/svg+xml; charset=utf-8", "cache-control": "public, max-age=300", "access-control-allow-origin": "*" } });
      } catch (error) {
        return Response.json({ ok: false, error: "bad_force_query", message: String(error?.message || error) }, { status: 400, headers: corsHeaders() });
      }
    }
    if (req.method === "GET" && url.pathname === "/force-analysis.svg") {
      try {
        const packed = url.searchParams.get("d") || "";
        if (!packed) return Response.json({ ok: false, error: "missing_d" }, { status: 400, headers: corsHeaders() });
        const payload = await parseCompressedBase64UrlJson(packed);
        return new Response(renderForceAnalysisSvg(payload), { status: 200, headers: { "content-type": "image/svg+xml; charset=utf-8", "cache-control": "public, max-age=300", "access-control-allow-origin": "*" } });
      } catch (error) {
        return Response.json({ ok: false, error: "bad_force_analysis_query", message: String(error?.message || error) }, { status: 400, headers: corsHeaders() });
      }
    }
    if (req.method === "GET" && url.pathname === "/circuit.svg") {
      try {
        const packed = url.searchParams.get("d") || "";
        if (!packed) return Response.json({ ok: false, error: "missing_d" }, { status: 400, headers: corsHeaders() });
        const payload = await parseCompressedBase64UrlJson(packed);
        if (payload && payload.__svg_preview && payload.svg) {
          return new Response(payload.svg, { status: 200, headers: { "content-type": "image/svg+xml; charset=utf-8", "cache-control": "public, max-age=300", "access-control-allow-origin": "*" } });
        }
        return new Response(renderCircuitDiagramSvg(sanitizeCircuitPayloadFromArgs(payload)), { status: 200, headers: { "content-type": "image/svg+xml; charset=utf-8", "cache-control": "public, max-age=300", "access-control-allow-origin": "*" } });
      } catch (error) {
        return Response.json({ ok: false, error: "bad_circuit_query", message: String(error?.message || error) }, { status: 400, headers: corsHeaders() });
      }
    }
    if (req.method === "GET" && url.pathname === "/venn.svg") {
      try {
        const packed = url.searchParams.get("d") || "";
        if (!packed) return Response.json({ ok: false, error: "missing_d" }, { status: 400, headers: corsHeaders() });
        const payload = await parseCompressedBase64UrlJson(packed);
        return new Response(renderVennDiagramSvg(payload), { status: 200, headers: { "content-type": "image/svg+xml; charset=utf-8", "cache-control": "public, max-age=300", "access-control-allow-origin": "*" } });
      } catch (error) {
        return Response.json({ ok: false, error: "bad_venn_query", message: String(error?.message || error) }, { status: 400, headers: corsHeaders() });
      }
    }
    if (req.method === "GET" && url.pathname === "/c-memory.svg") {
      try {
        const packed = url.searchParams.get("d") || "";
        if (!packed) return Response.json({ ok: false, error: "missing_d" }, { status: 400, headers: corsHeaders() });
        const payload = await parseCompressedBase64UrlJson(packed);
        return new Response(renderCMemoryDiagramSvg(payload), { status: 200, headers: { "content-type": "image/svg+xml; charset=utf-8", "cache-control": "public, max-age=300", "access-control-allow-origin": "*" } });
      } catch (error) {
        return Response.json({ ok: false, error: "bad_c_memory_query", message: String(error?.message || error) }, { status: 400, headers: corsHeaders() });
      }
    }
    if (req.method === "GET" && url.pathname === "/shape3d.html") {
      try {
        const packed = url.searchParams.get("d") || "";
        if (!packed) return Response.json({ ok: false, error: "missing_d" }, { status: 400, headers: corsHeaders() });
        const payload = await parseCompressedBase64UrlJson(packed);
        return new Response(renderShape3DHtml(payload), { status: 200, headers: { "content-type": "text/html; charset=utf-8", "cache-control": "public, max-age=300", "access-control-allow-origin": "*" } });
      } catch (error) {
        return Response.json({ ok: false, error: "bad_shape_query", message: String(error?.message || error) }, { status: 400, headers: corsHeaders() });
      }
    }
    if (req.method !== "POST" || url.pathname !== "/mcp") {
      return Response.json({ ok: false, error: "not_found" }, { status: 404, headers: corsHeaders() });
    }
    let body;
    try {
      body = await req.json();
    } catch {
      return jsonRpcError(null, -32700, "Parse error");
    }
    const id = body?.id ?? null;
    const method = String(body?.method || "");
    const params = body?.params && typeof body.params === "object" ? body.params : {};
    try {
      if (method === "initialize") {
        return jsonRpc(id, { protocolVersion: "2025-03-26", capabilities: { tools: {} }, serverInfo: { name: SERVER_NAME, version: SERVER_VERSION } });
      }
      if (method === "notifications/initialized") {
        return new Response(null, { status: 202, headers: corsHeaders() });
      }
      if (method === "tools/list") {
        return jsonRpc(id, { tools: TOOLS });
      }
      if (method === "tools/call") {
        const name = String(params.name || "");
        const args = params.arguments && typeof params.arguments === "object" ? params.arguments : {};
        const result = await handleToolCall(name, args, env, url.origin);
        return jsonRpc(id, toolResultPayload(result));
      }
      return jsonRpcError(id, -32601, `Method not found: ${method}`);
    } catch (error) {
      return jsonRpcError(id, -32e3, "Tool execution failed", { message: String(error?.message || error) });
    }
  }
};
export {
  index_default as default
};
/*! Bundled license information:

expr-eval/dist/index.mjs:
  (*!
   Based on ndef.parser, by Raphael Graf(r@undefined.ch)
   http://www.undefined.ch/mparser/index.html
  
   Ported to JavaScript and modified by Matthew Crumley (email@matthewcrumley.com, http://silentmatt.com/)
  
   You are free to use and modify this code in anyway you find useful. Please leave this comment in the code
   to acknowledge its original source. If you feel like it, I enjoy hearing about projects that use my code,
   but don't feel like you have to let me know or ask permission.
  *)
*/
//# sourceMappingURL=index.js.map
