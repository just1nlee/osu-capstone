// Unit tests for intent parsing (docs/design.md, "Intent protocol").
// Test names cite the requirement they cover.
#include <stdio.h>
#include <string.h>

#include "../bus/intent.h"

static int failures, total;

static enum intent_err parse(const char *line, struct intent *out) {
    return intent_parse(line, strlen(line), out);
}

#define CHECK(cond)                                                       \
    do {                                                                  \
        total++;                                                          \
        if (!(cond)) {                                                    \
            failures++;                                                   \
            fprintf(stderr, "FAIL %s:%d: %s\n", __func__, __LINE__, #cond); \
        }                                                                 \
    } while (0)

#define EXPECT_ERR(line, err)                \
    do {                                     \
        struct intent in_;                   \
        CHECK(parse((line), &in_) == (err)); \
    } while (0)

static void test_fr5_focus_each_direction(void) {
    const char *dirs[] = { "left", "right", "up", "down" };
    enum intent_dir want[] = { DIR_LEFT, DIR_RIGHT, DIR_UP, DIR_DOWN };
    for (int i = 0; i < 4; i++) {
        char line[64];
        snprintf(line, sizeof line, "{\"v\":1,\"cmd\":\"focus\",\"dir\":\"%s\"}", dirs[i]);
        struct intent in;
        CHECK(parse(line, &in) == INTENT_OK);
        CHECK(in.cmd == CMD_FOCUS);
        CHECK(in.dir == want[i]);
        CHECK(in.src == SRC_UNKNOWN);
    }
}

static void test_fr6_split_pane_each_direction(void) {
    const char *dirs[] = { "left", "right", "up", "down" };
    enum intent_dir want[] = { DIR_LEFT, DIR_RIGHT, DIR_UP, DIR_DOWN };
    for (int i = 0; i < 4; i++) {
        char line[80];
        snprintf(line, sizeof line, "{\"v\":1,\"cmd\":\"split_pane\",\"dir\":\"%s\"}", dirs[i]);
        struct intent in;
        CHECK(parse(line, &in) == INTENT_OK);
        CHECK(in.cmd == CMD_SPLIT_PANE);
        CHECK(in.dir == want[i]);
    }
}

static void test_fr8_close_pane(void) {
    struct intent in;
    CHECK(parse("{\"v\":1,\"cmd\":\"close_pane\"}", &in) == INTENT_OK);
    CHECK(in.cmd == CMD_CLOSE_PANE);
    CHECK(in.dir == DIR_NONE);
    // dir is ignored on commands that don't take one, even if malformed.
    CHECK(parse("{\"v\":1,\"cmd\":\"close_pane\",\"dir\":\"sideways\"}", &in) == INTENT_OK);
    CHECK(in.dir == DIR_NONE);
}

static void test_draft_commands_kept(void) {
    struct intent in;
    CHECK(parse("{\"v\":1,\"cmd\":\"focus_next\"}", &in) == INTENT_OK);
    CHECK(in.cmd == CMD_FOCUS_NEXT);
    CHECK(parse("{\"v\":1,\"cmd\":\"next_layout\"}", &in) == INTENT_OK);
    CHECK(in.cmd == CMD_NEXT_LAYOUT);
}

static void test_src_field(void) {
    struct intent in;
    CHECK(parse("{\"v\":1,\"cmd\":\"close_pane\",\"src\":\"gesture\"}", &in) == INTENT_OK);
    CHECK(in.src == SRC_GESTURE);
    CHECK(parse("{\"v\":1,\"cmd\":\"close_pane\",\"src\":\"keyboard\"}", &in) == INTENT_OK);
    CHECK(in.src == SRC_KEYBOARD);
    EXPECT_ERR("{\"v\":1,\"cmd\":\"close_pane\",\"src\":\"mouse\"}", INTENT_INVALID_FIELD);
    EXPECT_ERR("{\"v\":1,\"cmd\":\"close_pane\",\"src\":\"unknown\"}", INTENT_INVALID_FIELD);
    EXPECT_ERR("{\"v\":1,\"cmd\":\"close_pane\",\"src\":3}", INTENT_INVALID_FIELD);
}

static void test_fr9_bad_json(void) {
    EXPECT_ERR("", INTENT_BAD_JSON);
    EXPECT_ERR("hello", INTENT_BAD_JSON);
    EXPECT_ERR("{\"v\":1,\"cmd\":\"focus\"", INTENT_BAD_JSON);           // unterminated
    EXPECT_ERR("{\"v\":1,,\"cmd\":\"focus_next\"}", INTENT_BAD_JSON);    // double comma
    EXPECT_ERR("{\"v\":1,\"cmd\":\"focus_next\"} x", INTENT_BAD_JSON);   // trailing garbage
    EXPECT_ERR("[1,2]", INTENT_BAD_JSON);
    EXPECT_ERR("{v:1}", INTENT_BAD_JSON);                                // unquoted key
}

static void test_fr9_unsupported_version(void) {
    EXPECT_ERR("{\"v\":2,\"cmd\":\"focus_next\"}", INTENT_UNSUPPORTED_VERSION);
    EXPECT_ERR("{\"v\":0,\"cmd\":\"focus_next\"}", INTENT_UNSUPPORTED_VERSION);
}

static void test_fr9_unknown_command(void) {
    EXPECT_ERR("{\"v\":1,\"cmd\":\"scroll\"}", INTENT_UNKNOWN_COMMAND);
    EXPECT_ERR("{\"v\":1,\"cmd\":\"\"}", INTENT_UNKNOWN_COMMAND);
}

static void test_fr9_invalid_field(void) {
    EXPECT_ERR("{\"cmd\":\"focus_next\"}", INTENT_INVALID_FIELD);                 // missing v
    EXPECT_ERR("{\"v\":\"1\",\"cmd\":\"focus_next\"}", INTENT_INVALID_FIELD);     // v not int
    EXPECT_ERR("{\"v\":1.0,\"cmd\":\"focus_next\"}", INTENT_INVALID_FIELD);       // v not int
    EXPECT_ERR("{\"v\":1}", INTENT_INVALID_FIELD);                                // missing cmd
    EXPECT_ERR("{\"v\":1,\"cmd\":7}", INTENT_INVALID_FIELD);                      // cmd not string
    EXPECT_ERR("{\"v\":1,\"cmd\":\"focus\"}", INTENT_INVALID_FIELD);              // missing dir
    EXPECT_ERR("{\"v\":1,\"cmd\":\"split_pane\",\"dir\":\"diagonal\"}", INTENT_INVALID_FIELD);
    EXPECT_ERR("{\"v\":1,\"cmd\":\"focus\",\"dir\":\"none\"}", INTENT_INVALID_FIELD);
    EXPECT_ERR("{\"v\":1,\"cmd\":\"focus\",\"dir\":1}", INTENT_INVALID_FIELD);
}

static void test_unknown_fields_ignored(void) {
    struct intent in;
    // gesture is no longer part of the protocol; old clients may still send it.
    CHECK(parse("{\"v\":1,\"cmd\":\"focus\",\"dir\":\"up\",\"gesture\":\"Open_Palm\"}", &in) ==
          INTENT_OK);
    CHECK(in.cmd == CMD_FOCUS && in.dir == DIR_UP);
    CHECK(parse("{\"extra\":{\"a\":[1,true,null,\"x\"]},\"v\":1,\"cmd\":\"close_pane\"}", &in) ==
          INTENT_OK);
    CHECK(parse("{\"a_very_long_unknown_key_name\":-3.5e2,\"v\":1,\"cmd\":\"close_pane\"}", &in) ==
          INTENT_OK);
}

static void test_whitespace_and_key_order(void) {
    struct intent in;
    CHECK(parse("  { \"dir\" : \"left\" , \"cmd\" : \"focus\" , \"v\" : 1 }  \r", &in) == INTENT_OK);
    CHECK(in.cmd == CMD_FOCUS && in.dir == DIR_LEFT);
}

int main(void) {
    test_fr5_focus_each_direction();
    test_fr6_split_pane_each_direction();
    test_fr8_close_pane();
    test_draft_commands_kept();
    test_src_field();
    test_fr9_bad_json();
    test_fr9_unsupported_version();
    test_fr9_unknown_command();
    test_fr9_invalid_field();
    test_unknown_fields_ignored();
    test_whitespace_and_key_order();
    printf("%d/%d checks passed\n", total - failures, total);
    return failures ? 1 : 0;
}
