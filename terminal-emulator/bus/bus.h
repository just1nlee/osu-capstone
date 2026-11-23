// Command bus: the multiplexer's end of the intent socket.
//
// Listens on $TMPDIR/gesturemux-$UID/control.sock and accepts several clients
// (for example a gesture recognizer and a keyboard client). Each complete
// request line is parsed, handed to the handler, and answered with one reply
// line before the next line is read, so commands run in the order they arrive
// regardless of which client sent them. See docs/design.md, "Intent protocol".
//
// The caller drives the event loop with select(), so the bus can share a loop
// with the multiplexer's stdin and PTY descriptors.
#ifndef BUS_H
#define BUS_H

#include <sys/select.h>

#include "intent.h"

#define BUS_MAX_CLIENTS 16
#define BUS_MAX_LINE 4096  // longer lines are discarded and get bad_json

// Called once per valid intent, before its reply is sent.
typedef void (*bus_handler)(const struct intent *in);

// Creates the socket directory (mode 0700) and socket, replacing a stale
// socket left by a crash. Returns 0, or -1 after printing why to stderr
// (including when another multiplexer already owns the socket).
int bus_open(bus_handler handler);

// Adds the bus's descriptors to *set and returns the highest one added.
int bus_fill_fds(fd_set *set);

// Accepts new clients and processes complete lines from ready clients.
void bus_handle_ready(const fd_set *set);

// Closes all connections and removes the socket file. Safe to call twice.
void bus_close(void);

// The socket path, valid after a successful bus_open().
const char *bus_path(void);

#endif
