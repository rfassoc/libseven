define('ace/mode/myscript', function(require, exports, module) {
  const oop = require("ace/lib/oop");
  const TextMode = require("ace/mode/text").Mode;
  const {MMHLRules} = require("ace/mode/myscript_hl");
  const Mode = function() {
    this.HighlightRules = MMHLRules;
  };
  oop.inherits(Mode, TextMode);
  exports.Mode = Mode;
});
define('ace/mode/myscript_hl', function(require, exports, module) {
  const oop = require("ace/lib/oop");
  const TextHighlightRules = require("ace/mode/text_highlight_rules").TextHighlightRules;
  const MMHLRules = function() {
    this.$rules = {
      start: [
        {
          regex: '^(\\s*)([^:]+)(:)(.+)$',
          token: ['text', 'variable.parameter', 'keyword.operator', 'text'],
        },
        {
          regex: '^(\\s*)(---)(\\s*)$',
          token: ['text', 'constant.language', 'text'],
          next: 'body',
        },
      ],
      body: [
        {
          regex: '^(\\s*)(\\^|\\$)(\\s*)$',
          token: ['text', 'entity.name.function', 'text'],
        },
        {
          regex: '^(\\s*)(\\+|-)(\\S+)(\\s*)$',
          token: ['text', 'keyword.operator', 'variable.other', 'text'],
        },
        {
          regex: '^(\\s*)(\\S+)(&)(.+)$',
          token: ['text', 'variable.other', 'keyword.operator', 'keyword.control'],
        },
        {
          regex: '^(\\s*)([^|]+)(\\|[^:]+)(:)(.+)$',
          token: ['text', 'variable.other', 'support.type', 'keyword.operator', 'string.quoted'],
        },
        {
          regex: '^(\\s*)([^:]+)(:)(.+)$',
          token: ['text', 'variable.other', 'keyword.operator', 'string.quoted'],
        },
        {
          regex: '^(\\s*)(\\S+)(!)(\\S+)(\\s*)$',
          token: ['text', 'variable.other', 'keyword.operator', 'keyword.control', 'text'],
        },
        {
          regex: '^(\\s*)(\\S+)(\\s*)(<3)(\\s*)$',
          token: ['text', 'variable.other', 'text', 'keyword.operator', 'text'],
        },
      ],
    };
  };
  oop.inherits(MMHLRules, TextHighlightRules);
  exports.MMHLRules = MMHLRules;
});