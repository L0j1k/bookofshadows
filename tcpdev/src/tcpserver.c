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

#include <arpa/inet.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <sys/socket.h>

#ifndef _TCPDEV_MAXCONN
#define _TCPDEV_MAXCONN 5
#endif

void error( char *message ) {
  printf("error: [%s]\n", message);
  exit(1);
}

void usage( char *name ) {
  printf("usage: %s [port]\n", name);
  printf("  [port]     TCP port to bind server on\n");
  exit(1);
}

int main( int argc, char **argv ) {
  typedef enum Boolean { false, true } Boolean;

  static const char *version = "0.0.1";
  static const char *phase = "prealpha";

  Boolean finished = false;
  struct sockaddr_in server;
  struct hostent *h;
  int listenport, listensock, serversock;
  char buffer[1024];

  if (argc != 2) usage(argv[0]);
  listenport = *argv[1];
  if (listenport < 1 || listenport > 65535) usage(argv[0]);

  printf("tcpserver -- TCP-based protocol development harness (server) v%s-%s\n", version, phase);
  printf("Written by L0j1k@L0j1k.com -- Released under BSD3\n\n");

  if ((serversock = socket(AF_INET, SOCK_STREAM, IPPROTO_TCP)) < 0) error("cannot create socket()");
  if ((listensock = listen(serversock, _TCPDEV_MAXCONN)) < 0) error("cannot listen()");

  while (!finished) {
    // @debug begin
    
    // @debug end
  }

  return 0;
}
