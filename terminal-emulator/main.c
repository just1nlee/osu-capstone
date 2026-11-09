#include <stdlib.h>
#include <termios.h>
#include <unistd.h>
#include <sys/ioctl.h>
#include <sys/select.h>
#ifdef __APPLE__
#include <util.h>
#else
#include <pty.h>
#endif

static struct termios orig;

static void restore(void) { tcsetattr(STDIN_FILENO, TCSANOW, &orig); }

int main(void) {
    struct winsize ws;
    tcgetattr(STDIN_FILENO, &orig);
    ioctl(STDIN_FILENO, TIOCGWINSZ, &ws);

    // Fork a child attached to a new PTY sized like the outer terminal.
    int master;
    pid_t pid = forkpty(&master, NULL, &orig, &ws);
    if (pid < 0) return 1;
    if (pid == 0) {
        char *shell = getenv("SHELL");
        execl(shell ? shell : "/bin/sh", shell ? shell : "/bin/sh", (char *)NULL);
        _exit(127);
    }

    // Raw mode: pass every keystroke straight to the PTY; the inner shell's
    // line discipline handles echo, ^C, etc.
    struct termios raw = orig;
    cfmakeraw(&raw);
    tcsetattr(STDIN_FILENO, TCSANOW, &raw);
    atexit(restore);

    // Shuttle bytes: stdin -> PTY, PTY -> stdout. The outer terminal renders
    // all escape sequences itself.
    char buf[4096];
    for (;;) {
        fd_set fds;
        FD_ZERO(&fds);
        FD_SET(STDIN_FILENO, &fds);
        FD_SET(master, &fds);
        if (select(master + 1, &fds, NULL, NULL, NULL) < 0) continue;

        if (FD_ISSET(STDIN_FILENO, &fds)) {
            ssize_t n = read(STDIN_FILENO, buf, sizeof buf);
            if (n <= 0) break;
            write(master, buf, n);
        }
        if (FD_ISSET(master, &fds)) {
            ssize_t n = read(master, buf, sizeof buf);
            if (n <= 0) break; // shell exited
            write(STDOUT_FILENO, buf, n);
        }
    }
    return 0;
}
