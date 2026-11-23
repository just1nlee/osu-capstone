#include "bus.h"

#include <errno.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <sys/socket.h>
#include <sys/stat.h>
#include <sys/un.h>
#include <unistd.h>

#ifndef MSG_NOSIGNAL
#define MSG_NOSIGNAL 0  // macOS: SO_NOSIGPIPE is set on each socket instead
#endif

struct client {
    int fd;              // -1 when the slot is free
    int discarding;      // inside an over-long line; skip to its newline
    size_t len;          // bytes buffered so far
    char buf[BUS_MAX_LINE + 1];  // one maximum-length line plus its newline
};

static int listen_fd = -1;
static bus_handler handler;
static struct client clients[BUS_MAX_CLIENTS];
static char sock_dir[sizeof(((struct sockaddr_un *)0)->sun_path)];
static char sock_path[sizeof(((struct sockaddr_un *)0)->sun_path)];

const char *bus_path(void) { return sock_path; }

static void no_sigpipe(int fd) {
#ifdef SO_NOSIGPIPE
    int one = 1;
    setsockopt(fd, SOL_SOCKET, SO_NOSIGPIPE, &one, sizeof one);
#else
    (void)fd;
#endif
}

// Builds the directory and socket paths and makes sure the directory exists,
// belongs to us, and is private (NFR-6).
static int prepare_dir(void) {
    const char *tmp = getenv("TMPDIR");
    if (!tmp || !*tmp) tmp = "/tmp";
    size_t tlen = strlen(tmp);
    while (tlen > 1 && tmp[tlen - 1] == '/') tlen--;

    unsigned uid = (unsigned)getuid();
    int n = snprintf(sock_dir, sizeof sock_dir, "%.*s/gesturemux-%u", (int)tlen, tmp, uid);
    if (n < 0 || (size_t)n >= sizeof sock_dir) goto too_long;
    n = snprintf(sock_path, sizeof sock_path, "%s/control.sock", sock_dir);
    if (n < 0 || (size_t)n >= sizeof sock_path) goto too_long;

    if (mkdir(sock_dir, 0700) < 0 && errno != EEXIST) {
        fprintf(stderr, "bus: mkdir %s: %s\n", sock_dir, strerror(errno));
        return -1;
    }
    struct stat st;
    if (lstat(sock_dir, &st) < 0) {
        fprintf(stderr, "bus: stat %s: %s\n", sock_dir, strerror(errno));
        return -1;
    }
    if (!S_ISDIR(st.st_mode) || st.st_uid != getuid()) {
        fprintf(stderr, "bus: %s is not a directory owned by you\n", sock_dir);
        return -1;
    }
    if ((st.st_mode & 077) && chmod(sock_dir, 0700) < 0) {
        fprintf(stderr, "bus: chmod %s: %s\n", sock_dir, strerror(errno));
        return -1;
    }
    return 0;

too_long:
    fprintf(stderr, "bus: socket path under %s is too long\n", tmp);
    return -1;
}

int bus_open(bus_handler h) {
    handler = h;
    for (int i = 0; i < BUS_MAX_CLIENTS; i++) clients[i].fd = -1;
    if (prepare_dir() < 0) return -1;

    struct sockaddr_un addr;
    memset(&addr, 0, sizeof addr);
    addr.sun_family = AF_UNIX;
    memcpy(addr.sun_path, sock_path, strlen(sock_path) + 1);

    // If something answers on the existing socket, another multiplexer owns
    // it. Otherwise the file (if any) is stale from a crash; remove it.
    int probe = socket(AF_UNIX, SOCK_STREAM, 0);
    if (probe < 0) {
        fprintf(stderr, "bus: socket: %s\n", strerror(errno));
        return -1;
    }
    int live = connect(probe, (struct sockaddr *)&addr, sizeof addr) == 0;
    close(probe);
    if (live) {
        fprintf(stderr, "bus: another multiplexer is already listening on %s\n", sock_path);
        sock_path[0] = '\0';  // not ours; bus_close() must not unlink it
        return -1;
    }
    if (unlink(sock_path) < 0 && errno != ENOENT) {
        fprintf(stderr, "bus: unlink %s: %s\n", sock_path, strerror(errno));
        return -1;
    }

    listen_fd = socket(AF_UNIX, SOCK_STREAM, 0);
    if (listen_fd < 0) {
        fprintf(stderr, "bus: socket: %s\n", strerror(errno));
        return -1;
    }
    if (bind(listen_fd, (struct sockaddr *)&addr, sizeof addr) < 0 ||
        listen(listen_fd, BUS_MAX_CLIENTS) < 0) {
        fprintf(stderr, "bus: bind/listen %s: %s\n", sock_path, strerror(errno));
        close(listen_fd);
        listen_fd = -1;
        return -1;
    }
    return 0;
}

static void drop(struct client *cl) {
    close(cl->fd);
    cl->fd = -1;
    cl->len = 0;
    cl->discarding = 0;
}

// Sends one reply line. A client that can't take it right away (gone, or
// not reading) is dropped rather than allowed to stall every other client.
static void reply(struct client *cl, enum intent_err err) {
    char out[96];
    int n;
    if (err == INTENT_OK)
        n = snprintf(out, sizeof out, "{\"v\":%d,\"ok\":true}\n", INTENT_VERSION);
    else
        n = snprintf(out, sizeof out, "{\"v\":%d,\"ok\":false,\"error\":\"%s\"}\n",
                     INTENT_VERSION, intent_err_str(err));
    if (send(cl->fd, out, (size_t)n, MSG_DONTWAIT | MSG_NOSIGNAL) != n) drop(cl);
}

static void handle_line(struct client *cl, const char *line, size_t len) {
    struct intent in;
    enum intent_err err = intent_parse(line, len, &in);
    if (err == INTENT_OK) handler(&in);
    reply(cl, err);  // after the handler: ok means the command has run
}

static void client_read(struct client *cl) {
    ssize_t n = read(cl->fd, cl->buf + cl->len, sizeof cl->buf - cl->len);
    if (n <= 0) {  // closed or failed; a partial line is discarded
        drop(cl);
        return;
    }
    cl->len += (size_t)n;

    size_t start = 0;
    char *nl;
    while ((nl = memchr(cl->buf + start, '\n', cl->len - start)) != NULL) {
        size_t line_len = (size_t)(nl - (cl->buf + start));
        if (cl->discarding) {
            cl->discarding = 0;
            reply(cl, INTENT_BAD_JSON);  // the tail of an over-long line
        } else {
            handle_line(cl, cl->buf + start, line_len);
        }
        if (cl->fd < 0) return;  // dropped while replying
        start += line_len + 1;
    }
    memmove(cl->buf, cl->buf + start, cl->len - start);
    cl->len -= start;

    // Buffer full with no newline: the line is over the limit. Throw away
    // what we have and keep skipping until its newline arrives.
    if (cl->len == sizeof cl->buf) {
        cl->discarding = 1;
        cl->len = 0;
    }
}

static void accept_client(void) {
    int fd = accept(listen_fd, NULL, NULL);
    if (fd < 0) return;
    for (int i = 0; i < BUS_MAX_CLIENTS; i++) {
        if (clients[i].fd < 0) {
            no_sigpipe(fd);
            clients[i].fd = fd;
            clients[i].len = 0;
            clients[i].discarding = 0;
            return;
        }
    }
    close(fd);  // at the client cap
}

int bus_fill_fds(fd_set *set) {
    int max = -1;
    if (listen_fd >= 0) {
        FD_SET(listen_fd, set);
        max = listen_fd;
    }
    for (int i = 0; i < BUS_MAX_CLIENTS; i++) {
        if (clients[i].fd >= 0) {
            FD_SET(clients[i].fd, set);
            if (clients[i].fd > max) max = clients[i].fd;
        }
    }
    return max;
}

void bus_handle_ready(const fd_set *set) {
    for (int i = 0; i < BUS_MAX_CLIENTS; i++)
        if (clients[i].fd >= 0 && FD_ISSET(clients[i].fd, set)) client_read(&clients[i]);
    if (listen_fd >= 0 && FD_ISSET(listen_fd, set)) accept_client();
}

void bus_close(void) {
    for (int i = 0; i < BUS_MAX_CLIENTS; i++)
        if (clients[i].fd >= 0) drop(&clients[i]);
    if (listen_fd >= 0) {
        close(listen_fd);
        listen_fd = -1;
        if (sock_path[0]) unlink(sock_path);
    }
}
