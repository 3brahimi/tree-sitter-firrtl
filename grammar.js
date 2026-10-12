/**
 * @file FIRRTL grammar for tree-sitter
 * @author Aliaksei Chapyzhenka <alex.drom@gmail.com>
 * @author Amaan Qureshi <amaanq12@gmail.com>
 * @author Andrew Young <youngar17@gmail.com>
 * @license Apache-2.0
 * @see {@link https://www.chisel-lang.org/firrtl|official website}
 * @see {@link https://github.com/chipsalliance/firrtl|official repository}
 * @see {@link https://github.com/chipsalliance/firrtl-spec|official spec}
 *
 * Covers FIRRTL 1.x and the FIRRTL spec 3.x and 4.x syntax (spec sections
 * "File Preamble", "Circuits and Modules", "Layers", "Formal Unit Tests",
 * "Probes", "Property Types", "Intrinsics", "Grammar"), plus the
 * CIRCT-emitted option/instchoice declarations and some 5.x/6.x additions
 * (class, extclass, object, knownlayer, fprintf, fflush, propassert).
 */

/* eslint-disable arrow-parens */
/* eslint-disable camelcase */
/* eslint-disable-next-line spaced-comment */
/// <reference types="tree-sitter-cli/dsl" />
// @ts-check

'use strict';

/**
  * Creates a rule to match one or more of the rules separated by the separator
  *
  * @param {string} sep - The separator to use.
  * @param {Rule} rule
  *
  * @return {SeqRule}
  *
  */
function sep1(sep, rule) {
  return seq(rule, repeat(seq(sep, rule)));
}

/**
 * An indented block of `rule`, optional as a whole.
 *
 * @param {GrammarSymbols<string>} $
 * @param {...Rule} rules
 *
 * @return {ChoiceRule}
 */
function block($, ...rules) {
  return optional(seq($._indent, ...rules, $._dedent));
}

module.exports = grammar({
  name: 'firrtl',

  externals: $ => [
    $._newline,
    $._indent,
    $._dedent,
    $.annotations
  ],

  extras: $ => [
    $.comment,
    /\s/
  ],

  inline: $ => [
    $.keyword_identifier
  ],

  supertypes: $ => [
    $.expression,
    $.statement
  ],

  word: $ => $.identifier,

  rules: {
    source_file: $ => seq(optional($.version), repeat($.circuit)),

    // spec 3.x/4.x "File Preamble"
    version: $ => seq('FIRRTL', 'version', $.semver),

    semver: _ => /[0-9]+\.[0-9]+\.[0-9]+/,

    circuit: $ => seq(
      'circuit', optional($.identifier), ':',
      optional($.annotations), optional($.info),
      block($, repeat($._declaration))
    ),

    _declaration: $ => choice(
      $.module,
      $.layer,
      $.formal,
      $.type_alias,
      $.option
    ),

    module: $ => choice(
      seq(
        optional('public'), 'module', $.identifier,
        repeat($.enablelayer), ':', optional($.info),
        block($, repeat($.port), repeat($.statement))
      ),
      seq(
        'extmodule', $.identifier,
        repeat(choice($.enablelayer, $.knownlayer)), ':', optional($.info),
        block($,
          repeat($.port),
          repeat(choice($.defname, $.parameter, $.ref_statement, $.requires))
        )
      ),
      seq(
        'intmodule', $.identifier, ':', optional($.info),
        block($,
          repeat($.port),
          optional($.intrinsic_spec),
          repeat($.parameter)
        )
      ),
      seq(
        'class', $.identifier, ':', optional($.info),
        block($, repeat($.port), repeat($.statement))
      ),
      seq(
        'extclass', $.identifier, ':', optional($.info),
        block($, repeat($.port))
      )
    ),

    enablelayer: $ => seq('enablelayer', $.layer_path),

    knownlayer: $ => seq('knownlayer', sep1(',', $.layer_path)),

    layer_path: $ => sep1('.', $.identifier),

    port: $ => seq(
      $.dir, $.identifier, ':', $.type, optional($.info), $._newline
    ),

    dir: _ => choice('input', 'output'),

    qualifier: _ => choice('const'),

    type: $ => choice(
      prec.right(seq($.qualifier, $.type)),
      seq(
        choice('UInt', 'SInt', 'Analog'),
        optional(seq('<', $.number, '>'))
      ),
      seq(
        'Fixed',
        optional(seq('<', $.number, '>')),
        optional(seq('<', '<', $.number, '>', '>'))
      ),
      'Clock',
      'AsyncReset',
      'Reset',
      seq('{', optional($._fields), '}'), // Bundle
      seq('{|', repeat(seq($.enum_variant, optional(','))), '|}'), // Enum
      seq($.type, '[', $.number, ']'), // Vector
      seq(
        choice('Probe', 'RWProbe'),
        '<', $.type, optional(seq(',', $.layer_path)), '>'
      ),
      // spec "Property Types"
      'Integer',
      'String',
      'Bool',
      'Double',
      'Path',
      'AnyRef',
      seq('Inst', '<', $.identifier, '>'),
      seq('List', '<', $.type, '>'),
      $.identifier // type alias
    ),

    _fields: $ => seq(
      $.field, repeat(seq(optional(','), $.field)), optional(',')
    ),

    field: $ => seq(optional('flip'), $.field_id, ':', $.type),

    enum_variant: $ => seq($.identifier, optional(seq(':', $.type))),

    defname: $ => seq('defname', '=', $.identifier, $._newline),

    parameter: $ => seq(
      'parameter', $.identifier,
      '=',
      choice(
        $.number,
        $.string,
        $.double,
        $.raw_string
      ),
      $._newline
    ),

    // FIRRTL 3.x extmodule `ref a.b is "x.y"`
    ref_statement: $ => seq(
      'ref', $.expression, 'is', $.string, $._newline
    ),

    requires: $ => seq('requires', sep1(',', $.string), $._newline),

    intrinsic_spec: $ => seq(
      'intrinsic', '=', $.intrinsic_name, $._newline
    ),

    // spec "Layers"; 3.0 used declgroup
    layer: $ => seq(
      choice('layer', 'declgroup'), $.identifier,
      optional(seq(',', $.layer_convention, optional(seq(',', $.string)))),
      optional($.string),
      ':', optional($.info),
      block($, repeat($.layer))
    ),

    layer_convention: _ => choice('bind', 'inline'),

    // spec "Formal Unit Tests"
    formal: $ => seq(
      'formal', $.identifier, 'of', $.identifier,
      repeat(seq(',', $.identifier, '=', $._formal_value)),
      ':', optional($.info),
      block($, repeat($.formal_param))
    ),

    formal_param: $ => seq($.identifier, '=', $._formal_value, $._newline),

    _formal_value: $ => choice(
      $.number,
      $.string,
      $.raw_string,
      seq('[', optional(sep1(',', $._formal_value)), ']'),
      seq('{', optional(sep1(',', seq($.identifier, '=', $._formal_value))), '}')
    ),

    // spec "Type Alias"
    type_alias: $ => seq('type', $.identifier, '=', $.type, optional($.info)),

    // CIRCT instance choice options
    option: $ => seq(
      'option', $.identifier, ':', optional($.info),
      block($, repeat($.option_case))
    ),

    option_case: $ => seq($.identifier, optional($.info), $._newline),

    _reset: $ => seq('reset', '=>', '(', $.expression, ',', $.expression, ')'),

    reset: $ => choice(
      $._reset,
      seq('(', $._reset, ')')
    ),

    reset_block: $ => choice(
      seq($._indent, $.reset, optional($.info), $._newline, $._dedent),
      seq('(', $.reset, ')')
    ),

    statement: $ => choice(
      $.wire,
      $.cmem,
      $.smem,
      $.register,
      $.regreset,
      $.memory,
      $.rdwr,
      $.inst,
      $.instchoice,
      $.object,
      $.node,
      $.connection,
      $.partial_connection,
      $.is_invalid,
      $.connect,
      $.invalidate,
      $.define,
      $.propassign,
      $.force,
      $.when,
      $.match,
      $.layerblock,
      $.stop,
      $.printf,
      $.verif,
      $.propassert,
      $.intrinsic_statement,
      $.skip,
      $.attach
    ),

    wire: $ => seq('wire', $.identifier, ':', $.type, optional($.info)),

    cmem: $ => seq('cmem', $.identifier, ':', $.type, optional($.info)),

    smem: $ => seq('smem', $.identifier, ':', $.type, optional($.info)),

    register: $ => seq(
      'reg', $.identifier, ':', $.type, optional(','), $.expression,
      optional(seq('with', ':', $.reset_block)),
      optional($.info)
    ),

    regreset: $ => seq(
      'regreset', $.identifier, ':', $.type, ',',
      $.expression, ',', $.expression, ',', $.expression,
      optional($.info)
    ),

    memory: $ => seq(
      'mem', $.identifier, ':', optional($.info),
      $._indent, repeat($.memory_field), $._dedent
    ),

    rdwr: $ => seq(
      $.mdir, 'mport', $.identifier,
      '=',
      $.identifier, '[', $.expression, ']', ',', $.expression,
      optional($.info)
    ),

    inst: $ => seq('inst', $.identifier, 'of', $.identifier, optional($.info)),

    instchoice: $ => seq(
      'instchoice', $.identifier, 'of', $.identifier, ',', $.identifier,
      ':', optional($.info),
      block($, repeat($.instchoice_case))
    ),

    instchoice_case: $ => seq(
      $.identifier, '=>', $.identifier, optional($.info), $._newline
    ),

    object: $ => seq('object', $.identifier, 'of', $.identifier, optional($.info)),

    node: $ => seq('node', $.identifier, '=', $.expression, optional($.info)),

    connection: $ => seq($.expression, '<=', $.expression, optional($.info)),

    partial_connection: $ => seq($.expression, '<-', $.expression, optional($.info)),

    is_invalid: $ => seq($.expression, 'is', 'invalid', optional($.info)),

    connect: $ => seq('connect', $.expression, ',', $.expression, optional($.info)),

    invalidate: $ => seq('invalidate', $.expression, optional($.info)),

    define: $ => seq('define', $.expression, '=', $.expression, optional($.info)),

    propassign: $ => seq('propassign', $.expression, ',', $.expression, optional($.info)),

    force: $ => seq(
      choice('force', 'force_initial', 'release', 'release_initial'),
      '(', sep1(',', $.expression), ')', optional($.info)
    ),

    memory_field: $ => seq(
      choice(
        seq('data-type', '=>', $.type),
        seq(
          choice('depth', 'read-latency', 'write-latency'),
          '=>', $.number
        ),
        seq('read-under-write', '=>', $.ruw),
        seq(choice('reader', 'writer', 'readwriter'), '=>', sep1(',', $.identifier))
      ),
      $._newline
    ),

    suite: $ => choice(
      $.statement,
      seq($._indent, repeat1($.statement), $._dedent)
    ),

    when: $ => prec.right(seq(
      'when',
      $.expression,
      ':',
      optional($.info),
      optional($.suite),
      optional($.else)
    )),
    else: $ => seq(
      'else',
      choice(
        $.when,
        seq(':', optional($.info), $.suite)
      )
    ),

    match: $ => seq(
      'match', $.expression, ':', optional($.info),
      block($, repeat($.match_branch))
    ),

    match_branch: $ => prec.right(seq(
      $.identifier, optional(seq('(', $.identifier, ')')), ':',
      optional($.info), optional($.suite)
    )),

    // spec "Layer Blocks"; 3.0 used group
    layerblock: $ => seq(
      choice('layerblock', 'group'), $.identifier,
      optional(seq('of', $.identifier)), ':', optional($.info),
      block($, repeat($.port), repeat($.statement))
    ),

    _name: $ => seq(':', $.identifier),

    stop: $ => seq(
      'stop', '(', $.expression, ',', $.expression, ',', $.number, ')',
      optional($._name), optional($.info)
    ),

    printf: $ => seq(
      choice('printf', 'fprintf', 'fflush'),
      '(',
      sep1(',', choice($.expression, $.string)),
      ')',
      optional($._name),
      optional($.info)
    ),

    verif: $ => seq(
      choice('assert', 'assume', 'cover'),
      '(',
      $.expression, ',',
      $.expression, ',',
      $.expression, ',',
      $.string,
      repeat(seq(',', $.expression)),
      ')',
      optional($._name),
      optional($.info)
    ),

    propassert: $ => seq(
      'propassert', $.expression, ',', $.string, optional($.info)
    ),

    intrinsic_statement: $ => seq($.intrinsic, optional($.info)),

    skip: $ => seq('skip', optional($.info)),

    attach: $ => seq('attach', '(', sep1(',', $.expression), ')', optional($.info)),

    info: _ => /@\[.*\]/, // $.FileInfo,

    mdir: _ => choice('infer', 'read', 'write', 'rdwr'),

    ruw: _ => choice('old', 'new', 'undefined'),

    litType: $ => seq(
      choice('UInt', 'SInt'),
      optional(seq('<', $.number, '>'))
    ),

    expression: $ => choice(
      $.literal,
      $.identifier,
      $.keyword_identifier,
      $.sub_field,
      $.sub_index,
      $.sub_access,
      $.mux,
      $.conditionally_valid,
      $.primitive_operation,
      $.probe_operation,
      $.intrinsic,
      $.enum_expression,
      $.property_literal,
      $.list_expression
    ),

    literal: $ => seq(
      $.litType, '(', choice($.number, $.number_str, $.radix_int), ')'
    ),

    sub_field: $ => seq($.expression, '.', $.field_id),

    sub_index: $ => seq($.expression, '[', $.number, ']'),

    sub_access: $ => seq($.expression, '[', $.expression, ']'),

    mux: $ => seq('mux', '(', $.expression, ',', $.expression, ',', $.expression, ')'), // no commas in ANTLR

    conditionally_valid: $ => seq('validif', '(', $.expression, ',', $.expression, ')'),

    primitive_operation: $ => seq($.primop, '(', sep1(',', choice($.expression, $.number)), ')'), // no commas in ANTLR

    // spec "Probes": probe, rwprobe, read
    probe_operation: $ => seq(
      choice('probe', 'rwprobe', 'read'), '(', $.expression, ')'
    ),

    // spec "Intrinsics"
    intrinsic: $ => seq(
      'intrinsic', '(', $.intrinsic_name,
      optional(seq('<', sep1(',', $.intrinsic_param), '>')),
      optional(seq(':', $.type)),
      repeat(seq(',', $.expression)),
      ')'
    ),

    intrinsic_name: $ => sep1('.', $.identifier),

    intrinsic_param: $ => seq(
      $.identifier, '=', choice($.number, $.string, $.double, $.raw_string)
    ),

    enum_expression: $ => seq(
      '{|', repeat(seq($.enum_variant, optional(','))), '|}',
      '(', $.identifier, optional(seq(',', $.expression)), ')'
    ),

    // spec "Property Literal Expressions"
    property_literal: $ => seq(
      choice('Integer', 'String', 'Bool', 'Double', 'Path', 'path'),
      '(',
      choice($.number, $.double, $.string, 'true', 'false'),
      ')'
    ),

    list_expression: $ => seq(
      'List', '<', $.type, '>',
      '(', optional(sep1(',', $.expression)), ')'
    ),

    field_id: $ => choice(
      $.identifier,
      $.relaxed_identifier,
      $.uint
    ),

    primop: _ => choice(
      'add',
      'sub',
      'mul',
      'div',
      'rem',
      'mod',
      'lt',
      'leq',
      'gt',
      'geq',
      'eq',
      'neq',
      'pad',
      'asUInt',
      'asAsyncReset',
      'asReset',
      'asSInt',
      'asClock',
      'shl',
      'shr',
      'dshl',
      'dshlw',
      'dshr',
      'dshrw',
      'cvt',
      'neg',
      'not',
      'and',
      'or',
      'xor',
      'andr',
      'orr',
      'xorr',
      'cat',
      'bits',
      'head',
      'tail',
      'asFixedPoint',
      'bpshl',
      'bpshr',
      'bpset',
      // spec "Primitive Property Operations"
      'integer_add',
      'integer_mul',
      'integer_shr',
      'integer_shl',
      'list_concat',
      'string_concat',
      'prop_eq',
      'bool_and',
      'bool_or',
      'bool_xor'
    ),

    uint: _ => choice('0', /[1-9][0-9]*/),

    sint: _ => seq(choice('+', '-'), /[1-9][0-9]*/),

    number: $ => alias(choice($.uint, $.sint), $.number),

    number_str: _ => {
      const hex = /"h[+-]?[a-fA-F0-9]+"/;

      const octal = /"o[+-]?[0-7]+"/;

      const binary = /"b[+-]?[01]+"/;

      return token(choice(
        hex,
        octal,
        binary
      ));
    },

    // spec "Literals": radix-specified integer literals
    radix_int: _ => /[+-]?0(b[01]+|o[0-7]+|d[0-9]+|h[0-9a-fA-F]+)/,

    double: _ => /[+-]*[0-9]+\.[0-9]+(E[+-]?[0-9]+)?/,

    string: $ => seq(
      '"',
      repeat(choice(
        $.string_content,
        $._escape_sequence
      )),
      '"'
    ),

    raw_string: $ => seq(
      '\'',
      repeat(choice(
        alias($.raw_string_content, $.string_content),
        $._escape_sequence
      )),
      '\''
    ),

    string_content: _ => token(prec(-1, /[^"\\]+/)),
    raw_string_content: _ => token(prec(-1, /[^'\\]+/)),

    _escape_sequence: $ =>
      choice(
        prec(2, token.immediate(seq('\\', /[^abfnrtvxu'"\\?]/))),
        prec(1, $.escape_sequence)
      ),
    escape_sequence: _ => token.immediate(seq(
      '\\',
      choice(
        /[^xu0-7]/,
        /[0-7]{1,3}/,
        /x[0-9a-fA-F]{2}/,
        /u[0-9a-fA-F]{4}/,
        /u\{[0-9a-fA-F]+\}/
      ))),

    // LegalStartChar (LegalIdChar)*, or a spec 3.x literal identifier `...`
    identifier: _ => token(choice(
      /[a-zA-Z_][a-zA-Z0-9_$]*/,
      /`[a-zA-Z0-9_$]+`/
    )),
    relaxed_identifier: _ => /[a-zA-Z0-9_$]+/, // (LegalIdChar)+
    keyword_identifier: $ => prec(-3, alias(
      choice(
        $.primop,
        'mux',
        'read',
        'probe',
        'rwprobe',
        'intrinsic',
        'path'
      ),
      $.identifier
    )),

    comment: _ => token(seq(';', /.*/))
  }
});
