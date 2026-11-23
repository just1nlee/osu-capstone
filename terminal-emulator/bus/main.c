// Standalone command bus. Until the multiplexer's layout tree exists, every
// valid command is printed instead of executed.
#include <errno.h>
#include <signal.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>

#include "bus.h"

static volatile sig_atomic_t stop;

static void on_signal(int sig) {
    (void)sig;
    stop = 1;
}

static void print_command(const struct intent *in) {
    printf("[bus] %s", intent_cmd_str(in->cmd));
    if (in->dir != DIR_NONE) printf(" dir=%s", intent_dir_str(in->dir));
    printf(" src=%s\n", intent_src_str(in->src));
    fflush(stdout);
}

int main(void) {
    // No SA_RESTART, so select() returns EINTR and the loop can exit cleanly.
    struct sigaction sa;
    memset(&sa, 0, sizeof sa);
    sa.sa_handler = on_signal;
    sigaction(SIGINT, &sa, NULL);
    sigaction(SIGTERM, &sa, NULL);

    if (bus_open(print_command) < 0) return 1;
    atexit(bus_close);
    printf("[bus] listening on %s\n", bus_path());
    fflush(stdout);

    while (!stop) {
        fd_set fds;
        FD_ZERO(&fds);
        int max = bus_fill_fds(&fds);
        if (select(max + 1, &fds, NULL, NULL, NULL) < 0) {
            if (errno == EINTR) continue;
            perror("select");
            return 1;
        }
        bus_handle_ready(&fds);
    }
    printf("[bus] shutting down\n");
    return 0;
}
