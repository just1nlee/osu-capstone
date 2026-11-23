set -e
mkdir -p bin
CFLAGS="-Wall -Wextra -std=c99 -D_DARWIN_C_SOURCE -D_DEFAULT_SOURCE"
gcc -o bin/terminal-emulator main.c
gcc $CFLAGS -o bin/command-bus bus/main.c bus/bus.c bus/intent.c
gcc $CFLAGS -o bin/test-intent tests/test_intent.c bus/intent.c
