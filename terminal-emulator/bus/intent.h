// Intent protocol, version 1: parsing and validation of one request line.
// Pure functions, no I/O, so they can be unit-tested without a socket.
// The wire format is specified in docs/design.md, "Intent protocol".
#ifndef INTENT_H
#define INTENT_H

#include <stddef.h>

#define INTENT_VERSION 1

enum intent_cmd {
    CMD_FOCUS,       // move focus in a direction (needs dir)
    CMD_SPLIT_PANE,  // spawn a pane in a direction (needs dir)
    CMD_CLOSE_PANE,
    CMD_FOCUS_NEXT,
    CMD_NEXT_LAYOUT,
};

enum intent_dir { DIR_NONE, DIR_LEFT, DIR_RIGHT, DIR_UP, DIR_DOWN };

enum intent_src { SRC_UNKNOWN, SRC_GESTURE, SRC_KEYBOARD };

enum intent_err {
    INTENT_OK = 0,
    INTENT_BAD_JSON,
    INTENT_UNSUPPORTED_VERSION,
    INTENT_UNKNOWN_COMMAND,
    INTENT_INVALID_FIELD,
};

struct intent {
    enum intent_cmd cmd;
    enum intent_dir dir;  // DIR_NONE unless the command takes a direction
    enum intent_src src;  // SRC_UNKNOWN when the field is absent
};

// Parse one line (without its trailing newline). Returns INTENT_OK and fills
// *out, or an error code; *out is unspecified on error.
enum intent_err intent_parse(const char *line, size_t len, struct intent *out);

// Wire names: "bad_json", "focus", "left", "gesture", ...
const char *intent_err_str(enum intent_err e);
const char *intent_cmd_str(enum intent_cmd c);
const char *intent_dir_str(enum intent_dir d);
const char *intent_src_str(enum intent_src s);

#endif
