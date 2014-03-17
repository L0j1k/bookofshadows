/**
 * @project TCP-based Protocol Development Harness
 * Harness for TCP-based protocol development.
 * @file tcpserver.c
 * Simple TCP server.
 * @author L0j1k
 * @contact L0j1k@L0j1k.com
 * @license BSD3
 * @version 0.0.1-prealpha
 */

#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <sys/socket.h>

int main( int argc, char **argv ) {
  typedef enum Boolean { false, true } Boolean;

  static const char *version = "0.0.1";
  static const char *phase = "prealpha";

  struct sockaddr_in server;
  struct hostent *h;
  int srvsock;
  char buffer[1024];

  return 0;
}
