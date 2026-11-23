// A deliberately small JSON reader: the request is one flat object whose
// fields we care about are strings or integers. Unknown fields may hold any
// JSON value; they are validated and skipped.
#include "intent.h"

#include <string.h>

#define MAX_DEPTH 16

struct cur {
    const char *p;
    const char *end;
};

enum vtype { V_NONE, V_STRING, V_INT, V_OTHER };

struct value {
    enum vtype type;
    char str[32];  // string value, truncated (and flagged) if longer
    int str_too_long;
    long num;
};

static void skip_ws(struct cur *c) {
    while (c->p < c->end && (*c->p == ' ' || *c->p == '\t' || *c->p == '\n' || *c->p == '\r'))
        c->p++;
}

static int is_hex(char ch) {
    return (ch >= '0' && ch <= '9') || (ch >= 'a' && ch <= 'f') || (ch >= 'A' && ch <= 'F');
}

// Reads a string starting at the opening quote. Copies up to cap-1 bytes into
// buf (may be NULL); sets *too_long if it didn't fit. Returns 0 on success.
static int read_string(struct cur *c, char *buf, size_t cap, int *too_long) {
    size_t n = 0;
    if (too_long) *too_long = 0;
    if (c->p >= c->end || *c->p != '"') return -1;
    c->p++;
    while (c->p < c->end) {
        char ch = *c->p++;
        if (ch == '"') {
            if (buf) buf[n] = '\0';
            return 0;
        }
        if ((unsigned char)ch < 0x20) return -1;  // raw control chars are invalid JSON
        if (ch == '\\') {
            if (c->p >= c->end) return -1;
            char e = *c->p++;
            switch (e) {
            case '"': case '\\': case '/': ch = e; break;
            case 'b': ch = '\b'; break;
            case 'f': ch = '\f'; break;
            case 'n': ch = '\n'; break;
            case 'r': ch = '\r'; break;
            case 't': ch = '\t'; break;
            case 'u':
                if (c->end - c->p < 4) return -1;
                for (int i = 0; i < 4; i++)
                    if (!is_hex(c->p[i])) return -1;
                c->p += 4;
                ch = '?';  // none of our known values contain escapes
                break;
            default: return -1;
            }
        }
        if (buf) {
            if (n + 1 < cap) buf[n++] = ch;
            else if (too_long) *too_long = 1;
        }
    }
    return -1;  // unterminated
}

static int read_literal(struct cur *c, const char *word) {
    size_t n = strlen(word);
    if ((size_t)(c->end - c->p) < n || memcmp(c->p, word, n) != 0) return -1;
    c->p += n;
    return 0;
}

// Reads a JSON number. Sets *is_int and *num when it is an integer that fits.
static int read_number(struct cur *c, int *is_int, long *num) {
    int neg = 0, integral = 1, digits = 0;
    long v = 0;
    if (c->p < c->end && *c->p == '-') { neg = 1; c->p++; }
    while (c->p < c->end && *c->p >= '0' && *c->p <= '9') {
        if (v > 100000000L) integral = 0;  // too large to matter; still valid JSON
        else v = v * 10 + (*c->p - '0');
        c->p++;
        digits++;
    }
    if (digits == 0) return -1;
    if (c->p < c->end && *c->p == '.') {
        integral = 0;
        c->p++;
        int frac = 0;
        while (c->p < c->end && *c->p >= '0' && *c->p <= '9') { c->p++; frac++; }
        if (frac == 0) return -1;
    }
    if (c->p < c->end && (*c->p == 'e' || *c->p == 'E')) {
        integral = 0;
        c->p++;
        if (c->p < c->end && (*c->p == '+' || *c->p == '-')) c->p++;
        int exp = 0;
        while (c->p < c->end && *c->p >= '0' && *c->p <= '9') { c->p++; exp++; }
        if (exp == 0) return -1;
    }
    *is_int = integral;
    *num = neg ? -v : v;
    return 0;
}

static int read_value(struct cur *c, struct value *out, int depth);

static int read_container(struct cur *c, int depth) {
    char open = *c->p, close = open == '{' ? '}' : ']';
    if (depth >= MAX_DEPTH) return -1;
    c->p++;
    skip_ws(c);
    if (c->p < c->end && *c->p == close) { c->p++; return 0; }
    for (;;) {
        skip_ws(c);
        if (open == '{') {
            if (read_string(c, NULL, 0, NULL) < 0) return -1;
            skip_ws(c);
            if (c->p >= c->end || *c->p != ':') return -1;
            c->p++;
            skip_ws(c);
        }
        if (read_value(c, NULL, depth + 1) < 0) return -1;
        skip_ws(c);
        if (c->p >= c->end) return -1;
        if (*c->p == ',') { c->p++; continue; }
        if (*c->p == close) { c->p++; return 0; }
        return -1;
    }
}

// Reads any JSON value. When out is non-NULL, records strings and integers.
static int read_value(struct cur *c, struct value *out, int depth) {
    struct value scratch;
    if (!out) out = &scratch;
    out->type = V_OTHER;
    if (c->p >= c->end) return -1;
    char ch = *c->p;
    if (ch == '"') {
        out->type = V_STRING;
        return read_string(c, out->str, sizeof out->str, &out->str_too_long);
    }
    if (ch == '-' || (ch >= '0' && ch <= '9')) {
        int is_int;
        if (read_number(c, &is_int, &out->num) < 0) return -1;
        if (is_int) out->type = V_INT;
        return 0;
    }
    if (ch == '{' || ch == '[') return read_container(c, depth);
    if (ch == 't') return read_literal(c, "true");
    if (ch == 'f') return read_literal(c, "false");
    if (ch == 'n') return read_literal(c, "null");
    return -1;
}

static const char *const cmd_names[] = {
    [CMD_FOCUS] = "focus",
    [CMD_SPLIT_PANE] = "split_pane",
    [CMD_CLOSE_PANE] = "close_pane",
    [CMD_FOCUS_NEXT] = "focus_next",
    [CMD_NEXT_LAYOUT] = "next_layout",
};
static const char *const dir_names[] = {
    [DIR_NONE] = "none", [DIR_LEFT] = "left", [DIR_RIGHT] = "right",
    [DIR_UP] = "up", [DIR_DOWN] = "down",
};
static const char *const src_names[] = {
    [SRC_UNKNOWN] = "unknown", [SRC_GESTURE] = "gesture", [SRC_KEYBOARD] = "keyboard",
};
static const char *const err_names[] = {
    [INTENT_OK] = "ok",
    [INTENT_BAD_JSON] = "bad_json",
    [INTENT_UNSUPPORTED_VERSION] = "unsupported_version",
    [INTENT_UNKNOWN_COMMAND] = "unknown_command",
    [INTENT_INVALID_FIELD] = "invalid_field",
};

#define COUNT(a) (int)(sizeof(a) / sizeof((a)[0]))

// Looks up a string value in a name table; returns the index or -1.
static int lookup(const struct value *v, const char *const *names, int n, int first) {
    if (v->type != V_STRING || v->str_too_long) return -1;
    for (int i = first; i < n; i++)
        if (strcmp(v->str, names[i]) == 0) return i;
    return -1;
}

enum intent_err intent_parse(const char *line, size_t len, struct intent *out) {
    struct cur c = { line, line + len };
    struct value v = { .type = V_NONE }, cmd = { .type = V_NONE };
    struct value dir = { .type = V_NONE }, src = { .type = V_NONE };

    // 1. Syntax: exactly one object, keeping the fields we know (last wins).
    skip_ws(&c);
    if (c.p >= c.end || *c.p != '{') return INTENT_BAD_JSON;
    c.p++;
    skip_ws(&c);
    if (c.p < c.end && *c.p == '}') {
        c.p++;
    } else {
        for (;;) {
            char key[8];
            int key_too_long;
            skip_ws(&c);
            if (read_string(&c, key, sizeof key, &key_too_long) < 0) return INTENT_BAD_JSON;
            skip_ws(&c);
            if (c.p >= c.end || *c.p != ':') return INTENT_BAD_JSON;
            c.p++;
            skip_ws(&c);

            struct value *slot = NULL;  // unknown fields are ignored
            if (!key_too_long) {
                if (strcmp(key, "v") == 0) slot = &v;
                else if (strcmp(key, "cmd") == 0) slot = &cmd;
                else if (strcmp(key, "dir") == 0) slot = &dir;
                else if (strcmp(key, "src") == 0) slot = &src;
            }
            if (read_value(&c, slot, 1) < 0) return INTENT_BAD_JSON;

            skip_ws(&c);
            if (c.p >= c.end) return INTENT_BAD_JSON;
            if (*c.p == ',') { c.p++; continue; }
            if (*c.p == '}') { c.p++; break; }
            return INTENT_BAD_JSON;
        }
    }
    skip_ws(&c);
    if (c.p != c.end) return INTENT_BAD_JSON;  // trailing garbage

    // 2. Version.
    if (v.type != V_INT) return INTENT_INVALID_FIELD;
    if (v.num != INTENT_VERSION) return INTENT_UNSUPPORTED_VERSION;

    // 3. Command.
    if (cmd.type != V_STRING) return INTENT_INVALID_FIELD;
    int ci = lookup(&cmd, cmd_names, COUNT(cmd_names), 0);
    if (ci < 0) return INTENT_UNKNOWN_COMMAND;
    out->cmd = (enum intent_cmd)ci;

    // 4. Optional source.
    out->src = SRC_UNKNOWN;
    if (src.type != V_NONE) {
        int si = lookup(&src, src_names, COUNT(src_names), SRC_GESTURE);
        if (si < 0) return INTENT_INVALID_FIELD;
        out->src = (enum intent_src)si;
    }

    // 5. Direction: required for focus and split_pane, ignored otherwise.
    out->dir = DIR_NONE;
    if (out->cmd == CMD_FOCUS || out->cmd == CMD_SPLIT_PANE) {
        int di = lookup(&dir, dir_names, COUNT(dir_names), DIR_LEFT);
        if (di < 0) return INTENT_INVALID_FIELD;
        out->dir = (enum intent_dir)di;
    }
    return INTENT_OK;
}

const char *intent_err_str(enum intent_err e) { return err_names[e]; }
const char *intent_cmd_str(enum intent_cmd c) { return cmd_names[c]; }
const char *intent_dir_str(enum intent_dir d) { return dir_names[d]; }
const char *intent_src_str(enum intent_src s) { return src_names[s]; }
