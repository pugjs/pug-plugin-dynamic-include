'use strict';

var stringify = require('js-stringify');

module.exports = function (options) {
  var jadePath = stringify(options && options.jadePath || 'jade');
  return {
    lex: {
      advance: function(lexer) {
        return this.dyninclude(lexer);
      },
      dyninclude: function(lexer) {
        var tok = lexer.scan(/^dyninclude(?= |$)/m, 'dynamic-include-dyninclude');
        if (tok) {
          lexer.tokens.push(tok);
          if (/^[ \t]*$/m.test(lexer.input)) {
            lexer.error('DYNAMIC_INCLUDE:NO_DYNINCLUDE_PATH', 'missing path for dyninclude')
          } else if (lexer.text()) {
            return true;
          }
        }
        if (lexer.scan(/^dyninclude\b/)) {
          lexer.error('DYNAMIC_INCLUDE:MALFORMED_DYNINCLUDE', 'malformed dyninclude')
        }
      }
    },
    parse: {
      expressionTokens: {
        'dynamic-include-dyninclude': function(parser) {
          var tok = parser.expect('dynamic-include-dyninclude');
          var func = "(function(filename){\n  if (/\\.jade$/.test(filename)) {\n    return require(" + jadePath + ").renderFile(filename, locals || {});\n  } else {\n    return require('fs').readFileSync(filename, 'utf8');\n  }\n})";

          var filenameBuf = [];
loop:
          while (true) {
            var pathTok = parser.peek();
            switch (pathTok.type) {
              case 'text':
                parser.advance();
                filenameBuf.push(stringify(pathTok.val));
                break;
              case 'interpolated-code':
                parser.advance();
                filenameBuf.push(pathTok.val);
                break;
              case 'eos':
                break loop;
              case 'newline':
                parser.advance();
                break loop;
              default:
                parser.error('DYNAMIC_INCLUDE:INVALID_TOKEN', 'unexpected token ' + JSON.stringify(pathTok.type), pathTok);
            }
          }

          return {
            type: 'Code',
            val: func + '(' + filenameBuf.join(' + ') + ')',
            buffer: true,
            mustEscape: false,
            isInline: false,
            line: tok.line,
            filename: parser.filename
          };
        }
      }
    }
  };
};
